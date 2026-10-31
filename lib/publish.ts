import { audit } from "./audit";
import { getDb, nowIso, uuid } from "./db";
import { notify } from "./notify";
import { getContribution, type Author, type ContributionRow, type OpResult } from "./contributions";
import { canTransition, transitionRule } from "./lifecycle";
import { coarseQuarter, coarseRegion } from "./scanner";
import { suspendLiveViews } from "./view-state";

// Section 10.3. buildSharedView() is pure and copies a whitelist, so no code path can add a field to
// a shared payload by accident. The only writers of shared_views are here, withdraw.ts (purge),
// cohort.ts (the distinct-organisation count) and view-state.ts (the live/suspended flag a report or a
// moderator decision moves); everything that reads them for a user lives in visible.ts.

/**
 * The write-side shape. `contribution_id` and `version` exist only in this record: the payload a
 * client may receive is SharedViewDTO in visible.ts, which has neither.
 */
export type SharedViewDraft = {
  contribution_id: string;
  version: number;
  title: string;
  summary: string;
  topic: string;
  offering_slug: string;
  industry: string;
  region_coarse: string;
  period_quarter: string;
  evidence_type: string;
  confidence: string;
  attribution: string | null;
};

export type ModeratorPublishInput = {
  /** Moderator-written text. The author's body is never copied into a shared view. */
  summary: string;
  /** Only used when the author asked for credit and the moderator approved it. */
  attributionApproved: boolean;
  /** Optional wording for the credit; falls back to the organisation name. */
  attributionText?: string;
  /** Goes to moderation_decisions.internal_note and is never returned in a shared payload. */
  internalNote?: string | null;
  /** Name of the owning organisation, read from the tenant record by the caller. */
  orgName: string;
};

/**
 * The whitelist copy. Nothing outside this object can reach a shared row: `summary` is the
 * moderator's redacted text, region and period are coarsened here rather than taken from the input,
 * and attribution appears only when the author asked for credit and the moderator approved it.
 */
export function buildSharedView(contribution: ContributionRow, input: ModeratorPublishInput): SharedViewDraft {
  const attributionAllowed = contribution.attribution_requested === 1 && input.attributionApproved;
  const attribution = attributionAllowed ? input.attributionText?.trim() || input.orgName.trim() || null : null;

  return {
    contribution_id: contribution.id,
    version: contribution.version,
    title: contribution.title,
    summary: input.summary.trim(),
    topic: contribution.topic,
    offering_slug: contribution.offering_slug,
    industry: contribution.industry,
    region_coarse: coarseRegion(contribution.region),
    period_quarter: coarseQuarter(contribution.period),
    evidence_type: contribution.evidence_type,
    confidence: contribution.confidence,
    attribution,
  };
}

/** Unresolved scanner hints block publishing — Section 10.1. */
export function unresolvedFlagCount(contributionId: string): number {
  return (
    getDb()
      .prepare("SELECT COUNT(*) AS n FROM contribution_flags WHERE contribution_id = ? AND resolved = 0")
      .get(contributionId) as { n: number }
  ).n;
}

/**
 * Section 8 allows only this module, withdraw.ts and cohort.ts to read shared_views directly. The
 * moderation console is none of those, so the record it needs for its own screens — the owning
 * contribution, the state of the copy and the title the moderator last approved — comes from here.
 * Nothing in these two functions is a shared-content read for a client: visible.ts stays the only
 * path that returns shared text to a user.
 */
export type SharedViewRecord = { id: string; contribution_id: string; title: string; state: string; version: number };

export function sharedViewRecord(id: string): SharedViewRecord | null {
  const row = getDb()
    .prepare("SELECT id, contribution_id, title, state, version FROM shared_views WHERE id = ?")
    .get(id) as SharedViewRecord | undefined;
  return row ?? null;
}

export function sharedViewIdsFor(contributionId: string): string[] {
  return (
    getDb()
      .prepare("SELECT id FROM shared_views WHERE contribution_id = ? ORDER BY published_at DESC, rowid DESC")
      .all(contributionId) as { id: string }[]
  ).map((row) => row.id);
}

function liveSharedViewId(contributionId: string): string | null {
  const row = getDb()
    .prepare("SELECT id FROM shared_views WHERE contribution_id = ? AND state = 'live' ORDER BY published_at DESC LIMIT 1")
    .get(contributionId) as { id: string } | undefined;
  return row ? row.id : null;
}

function mostRecentSharedViewId(contributionId: string): string | null {
  const row = getDb()
    .prepare("SELECT id FROM shared_views WHERE contribution_id = ? ORDER BY published_at DESC, rowid DESC LIMIT 1")
    .get(contributionId) as { id: string } | undefined;
  return row ? row.id : null;
}

function writeSharedView(id: string, draft: SharedViewDraft, publishedAt: string): void {
  getDb()
    .prepare(
      `UPDATE shared_views SET title = ?, summary = ?, topic = ?, offering_slug = ?, industry = ?,
        region_coarse = ?, period_quarter = ?, evidence_type = ?, confidence = ?, attribution = ?,
        state = 'live', published_at = ? WHERE id = ?`,
    )
    .run(
      draft.title,
      draft.summary,
      draft.topic,
      draft.offering_slug,
      draft.industry,
      draft.region_coarse,
      draft.period_quarter,
      draft.evidence_type,
      draft.confidence,
      draft.attribution,
      publishedAt,
      id,
    );
}

export function recordDecision(contributionId: string, moderatorId: string, decision: string, reason: string, internalNote: string | null): void {
  getDb()
    .prepare(
      `INSERT INTO moderation_decisions (id, contribution_id, moderator_id, decision, reason, internal_note, at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(uuid(), contributionId, moderatorId, decision, reason, internalNote, nowIso());
}

/**
 * In review to Published, and Unpublished to Published with a decision recorded (Section 9). Writes
 * the shared row, moves the state, records the decision and notifies the author in one transaction,
 * so a live shared view can never exist without its Published state.
 */
export function publishContribution(actor: Author, contributionId: string, input: ModeratorPublishInput): OpResult {
  if (!actor.platformPerms.has("learning.moderate")) {
    return { ok: false, status: 403, reason: "learning.moderate is required to publish" };
  }

  const row = getContribution(contributionId);
  if (!row) return { ok: false, status: 404, reason: "not found" };

  const rule = transitionRule(row.state, "Published");
  if (!rule || !canTransition(row.state, "Published")) {
    return { ok: false, status: 409, reason: `cannot publish an item in state ${row.state}` };
  }

  const unresolved = unresolvedFlagCount(row.id);
  if (unresolved > 0) {
    return {
      ok: false,
      status: 409,
      reason: `${unresolved} scanner hint(s) unresolved; publishing stays blocked until a moderator resolves each one`,
    };
  }

  const summary = input.summary.trim();
  if (summary.length < 20) {
    return { ok: false, status: 409, reason: "the redacted summary is too short to stand on its own" };
  }

  const draft = buildSharedView(row, { ...input, summary });
  const ts = nowIso();
  const alreadyPublished = liveSharedViewId(row.id) ?? (row.state === "Unpublished" ? mostRecentSharedViewId(row.id) : null);

  const write = getDb().transaction(() => {
    if (alreadyPublished) {
      // Republishing, or a material edit that re-uses the same view: update rather than stack rows.
      writeSharedView(alreadyPublished, draft, ts);
    } else {
      getDb()
        .prepare(
          `INSERT INTO shared_views (id, contribution_id, version, title, summary, topic, offering_slug, industry,
            region_coarse, period_quarter, evidence_type, confidence, attribution, state, published_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'live', ?)`,
        )
        .run(
          `shared-view-${row.id}`,
          draft.contribution_id,
          draft.version,
          draft.title,
          draft.summary,
          draft.topic,
          draft.offering_slug,
          draft.industry,
          draft.region_coarse,
          draft.period_quarter,
          draft.evidence_type,
          draft.confidence,
          draft.attribution,
          ts,
        );
    }

    getDb().prepare("UPDATE contributions SET state = 'Published', updated_at = ? WHERE id = ?").run(ts, row.id);
    recordDecision(row.id, actor.userId, "Published", `transition to Published (${rule.guard})`, input.internalNote ?? null);
    notify(row.author_id, "moderation.decision", `Your observation "${row.title}" is published to shared learning.`, `published-${row.id}-${Date.now()}`);
  });
  write();

  audit(actor, "moderation.publish", `tenant:${row.tenant_id}`, "allow", `published ${row.id}`);
  return { ok: true, row: getContribution(row.id)! };
}

/** Published to Unpublished: the shared row stops being live for every read path at once. */
export function unpublishContribution(
  actor: Author,
  contributionId: string,
  reason: string,
  internalNote: string | null,
): OpResult {
  if (!actor.platformPerms.has("learning.moderate")) {
    return { ok: false, status: 403, reason: "learning.moderate is required to unpublish" };
  }

  const row = getContribution(contributionId);
  if (!row) return { ok: false, status: 404, reason: "not found" };

  const rule = transitionRule(row.state, "Unpublished");
  if (!rule || !canTransition(row.state, "Unpublished")) {
    return { ok: false, status: 409, reason: `cannot unpublish an item in state ${row.state}` };
  }

  const ts = nowIso();
  const suspend = getDb().transaction(() => {
    const changes = suspendLiveViews(row.id);
    getDb().prepare("UPDATE contributions SET state = 'Unpublished', updated_at = ? WHERE id = ?").run(ts, row.id);
    recordDecision(row.id, actor.userId, "Unpublished", reason, internalNote);
    notify(row.author_id, "moderation.decision", `Your observation "${row.title}" is unpublished. Reason: ${reason}`, `unpublished-${row.id}-${Date.now()}`);
    return changes;
  });
  const suspended = suspend();

  audit(actor, "moderation.unpublish", `tenant:${row.tenant_id}`, "allow", `unpublished ${row.id}, ${suspended} shared view(s) suspended`);
  return { ok: true, row: getContribution(row.id)! };
}
