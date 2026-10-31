import { getDb, nowIso, uuid } from "./db";
import { audit } from "./audit";
import { notify } from "./notify";
import { recordConsents } from "./consents";
import { canTransition, transitionRule } from "./lifecycle";
import { scan } from "./scanner";
import type { ContributionDraftInput, ContributionEditInput, ContributionSubmitInput } from "./contribution-schema";
import { getContribution, isEntitled, type Author, type ContributionRow, type OpResult } from "./contributions";

// The write half of the observations module. Reads, visibility rules and the DTO live in
// ./contributions so that pages and the API can import what they show without importing mutations.

export type { ContributionRow, OpResult } from "./contributions";

/**
 * Replaces the stored hints with a fresh scan of the text as it stands. Old resolutions are dropped
 * on purpose: a resolved flag stops meaning anything once the sentence it pointed at has been edited.
 */
function storeFlags(contributionId: string, body: string): number {
  const db = getDb();
  db.prepare("DELETE FROM contribution_flags WHERE contribution_id = ?").run(contributionId);
  const insert = db.prepare(
    "INSERT INTO contribution_flags (id, contribution_id, kind, snippet, resolved, resolved_by) VALUES (?, ?, ?, ?, 0, NULL)",
  );
  const flags = scan(body);
  for (const flag of flags) insert.run(uuid(), contributionId, flag.kind, flag.snippet);
  return flags.length;
}

function insert(input: {
  id: string;
  tenant_id: string;
  author_id: string;
  type: string;
  title: string;
  body: string;
  topic: string;
  offering_slug: string;
  industry: string;
  region: string;
  period: string;
  evidence_type: string;
  confidence: string;
  sharing_choice: ContributionDraftInput["sharing_choice"];
  attribution_requested: number;
  state: ContributionRow["state"];
  version: number;
  created_at: string;
  updated_at: string;
}): void {
  getDb()
    .prepare(
      `INSERT INTO contributions (id, tenant_id, author_id, type, title, body, topic, offering_slug, industry, region,
        period, evidence_type, confidence, sharing_choice, attribution_requested, state, version, created_at, updated_at)
       VALUES (@id, @tenant_id, @author_id, @type, @title, @body, @topic, @offering_slug, @industry, @region,
        @period, @evidence_type, @confidence, @sharing_choice, @attribution_requested, @state, @version, @created_at, @updated_at)`,
    )
    .run(input);
}

/** Tenant, author, industry and region all come from the session and the tenant row — never the body. */
export function createDraft(actor: Author, input: ContributionDraftInput): OpResult {
  const tenantId = actor.activeTenantId;
  if (!tenantId) return { ok: false, status: 403, reason: "no active organisation" };
  if (!isEntitled(tenantId, input.offering_slug)) {
    return { ok: false, status: 409, reason: "offering is not entitled to this organisation" };
  }

  const org = getDb()
    .prepare("SELECT industry, region FROM tenants WHERE id = ?")
    .get(tenantId) as { industry: string; region: string } | undefined;
  if (!org) return { ok: false, status: 404, reason: "organisation not found" };

  const ts = nowIso();
  const id = uuid();
  insert({
    id,
    tenant_id: tenantId,
    author_id: actor.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    topic: input.topic,
    offering_slug: input.offering_slug,
    industry: org.industry,
    region: org.region,
    period: input.period,
    evidence_type: input.evidence_type,
    confidence: input.confidence,
    sharing_choice: input.sharing_choice,
    attribution_requested: input.attribution_requested ? 1 : 0,
    state: "Draft",
    version: 1,
    created_at: ts,
    updated_at: ts,
  });

  audit(actor, "contribution.create", `tenant:${tenantId}`, "allow", "draft created");
  return { ok: true, row: getContribution(id)! };
}

/** Only the author may edit, and only while the item is a Draft or has been Returned (Section 17). */
export function editContribution(actor: Author, id: string, patch: ContributionEditInput): OpResult {
  const row = getContribution(id);
  if (!row || row.tenant_id !== actor.activeTenantId) return { ok: false, status: 404, reason: "not found" };
  if (row.author_id !== actor.userId) return { ok: false, status: 403, reason: "only the author can edit" };
  if (row.state !== "Draft" && row.state !== "Returned") {
    return { ok: false, status: 409, reason: `an item in state ${row.state} cannot be edited` };
  }
  if (!isEntitled(row.tenant_id, patch.offering_slug)) {
    return { ok: false, status: 409, reason: "offering is not entitled to this organisation" };
  }

  getDb()
    .prepare(
      `UPDATE contributions SET title = ?, body = ?, type = ?, topic = ?, offering_slug = ?, period = ?,
        evidence_type = ?, confidence = ?, updated_at = ? WHERE id = ?`,
    )
    .run(
      patch.title,
      patch.body,
      patch.type,
      patch.topic,
      patch.offering_slug,
      patch.period,
      patch.evidence_type,
      patch.confidence,
      nowIso(),
      row.id,
    );

  audit(actor, "contribution.edit", `tenant:${row.tenant_id}`, "allow", "draft fields updated");
  return { ok: true, row: getContribution(row.id)! };
}

/** Draft or Returned → Submitted: consents are recorded here, never silently widened. */
export function submitContribution(actor: Author, id: string, input: ContributionSubmitInput): OpResult {
  const row = getContribution(id);
  if (!row || row.tenant_id !== actor.activeTenantId) return { ok: false, status: 404, reason: "not found" };
  if (row.author_id !== actor.userId) return { ok: false, status: 403, reason: "only the author can submit" };

  const rule = transitionRule(row.state, "Submitted");
  if (!rule || !canTransition(row.state, "Submitted")) {
    return { ok: false, status: 409, reason: `cannot submit an item in state ${row.state}` };
  }

  let hints = 0;
  const write = getDb().transaction(() => {
    recordConsents(row.id, actor.userId, input.sharing_choice, input.attribution_requested);
    getDb()
      .prepare("UPDATE contributions SET state = 'Submitted', sharing_choice = ?, attribution_requested = ?, updated_at = ? WHERE id = ?")
      .run(input.sharing_choice, input.attribution_requested ? 1 : 0, nowIso(), row.id);
    // Section 10.1: the scan runs on every submit, including a re-submit after a return, so the
    // moderator always sees the hints belonging to the text that is in front of them now.
    hints = storeFlags(row.id, row.body);

    notify(actor.userId, "contribution.submitted", `Your observation "${row.title}" is submitted and waits for review.`, `submitted-${row.id}-${Date.now()}`);
    for (const moderatorId of moderatorIds()) {
      notify(moderatorId, "moderation.queue", `A submitted observation "${row.title}" is ready for review.`, `review-${row.id}-${Date.now()}`);
    }
  });
  write();

  audit(actor, "contribution.submit", `tenant:${row.tenant_id}`, "allow", `transition Draft or Returned to Submitted (${rule.guard}, ${hints} scanner hint(s))`);
  return { ok: true, row: getContribution(row.id)! };
}

// Withdrawal, including the Section 12 shared-view purge, lives in ./withdraw.

export function moderatorIds(): string[] {
  return (getDb().prepare("SELECT user_id FROM platform_grants WHERE permission = 'learning.moderate'").all() as {
    user_id: string;
  }[]).map((row) => row.user_id);
}
