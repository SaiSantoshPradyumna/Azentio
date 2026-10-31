import { authorize } from "./authorize";
import { audit } from "./audit";
import { getDb, nowIso, uuid } from "./db";
import { notify } from "./notify";
import type { Author } from "./contributions";
import { canMoveIdea, ideaTransitionRule, isIdeaStatus, type IdeaStatus } from "./idea-lifecycle";
import { getIdea, type IdeaRow } from "./ideas";
import { visibleSharedViewById } from "./visible";

// Section 14 writes. Every one of them asks the policy engine the same question the route asked, so a
// module called from a page cannot skip the grant check, and every one of them writes an audit row.
// A status move additionally writes idea_status_history, because the reason is the record.

export type IdeaResult =
  | { ok: true; idea: IdeaRow }
  | { ok: false; status: 403 | 404 | 409; reason: string };

export type EvidenceResult =
  | { ok: true; ideaId: string; sharedViewId: string; granted: boolean }
  | { ok: false; status: 403 | 404 | 409; reason: string };

/** Section 14: only a product owner creates ideas, moves their status or writes client-facing text. */
function ownerDenial(actor: Author, action = "idea.write"): string | null {
  const decision = authorize(actor, action, { audience: "employee" });
  return decision.allow ? null : decision.reason;
}

function exists(table: "products" | "themes", idOrSlug: string): boolean {
  const column = table === "products" ? "slug" : "id";
  const row = getDb().prepare(`SELECT 1 AS ok FROM ${table} WHERE ${column} = ?`).get(idOrSlug) as { ok: number } | undefined;
  return !!row;
}

/**
 * A new idea always opens as Proposed. The Section 14 machine has no edge into Proposed, so creation
 * writes its own history row with from_status null — the trail starts at the first record, not at the
 * first move.
 */
export function createIdea(
  actor: Author,
  input: { title: string; problem: string; outcome: string; owner_team: string; offering_slug: string; priority: string; theme_id?: string },
): IdeaResult {
  const denied = ownerDenial(actor);
  if (denied) return { ok: false, status: 403, reason: denied };

  if (!exists("products", input.offering_slug)) {
    return { ok: false, status: 409, reason: `${input.offering_slug} is not one of the products` };
  }
  const themeId = input.theme_id?.trim() || null;
  if (themeId && !exists("themes", themeId)) {
    return { ok: false, status: 409, reason: "the theme for this idea does not exist" };
  }

  const id = uuid();
  const ts = nowIso();
  const write = getDb().transaction(() => {
    getDb()
      .prepare(
        `INSERT INTO ideas (id, title, problem, offering_slug, outcome, owner_team, priority, status, theme_id, created_by, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Proposed', ?, ?, ?)`,
      )
      .run(id, input.title, input.problem, input.offering_slug, input.outcome, input.owner_team, input.priority, themeId, actor.userId, ts);
    getDb()
      .prepare("INSERT INTO idea_status_history (id, idea_id, from_status, to_status, reason, actor_id, at) VALUES (?, ?, NULL, ?, ?, ?, ?)")
      .run(uuid(), id, "Proposed", "Opened by the product owner.", actor.userId, ts);
  });
  write();

  const idea = getIdea(id)!;
  audit(actor, "idea.write", "employee", "allow", `created idea ${id} (${idea.status})`);
  return { ok: true, idea };
}

const EDITABLE: Record<string, string> = {
  title: "title",
  problem: "problem",
  outcome: "outcome",
  owner_team: "owner_team",
  priority: "priority",
  theme_id: "theme_id",
};

/** Field edits. The status is never one of them, so an edit cannot smuggle a move past the machine. */
export function editIdea(
  actor: Author,
  ideaId: string,
  patch: { title?: string; problem?: string; outcome?: string; owner_team?: string; priority?: string; theme_id?: string | null },
): IdeaResult {
  const denied = ownerDenial(actor);
  if (denied) return { ok: false, status: 403, reason: denied };

  const idea = getIdea(ideaId);
  if (!idea) return { ok: false, status: 404, reason: "not found" };

  const columns: string[] = [];
  const values: (string | null)[] = [];
  for (const [key, value] of Object.entries(patch)) {
    const column = EDITABLE[key];
    if (!column || value === undefined) continue;
    if (column === "theme_id" && value !== null && !exists("themes", String(value))) {
      return { ok: false, status: 409, reason: "the theme for this idea does not exist" };
    }
    columns.push(`${column} = ?`);
    values.push(value === null || value === "" ? null : String(value));
  }
  if (columns.length === 0) return { ok: true, idea };

  getDb().prepare(`UPDATE ideas SET ${columns.join(", ")}, updated_at = ? WHERE id = ?`).run(...values, nowIso(), idea.id);
  audit(actor, "idea.write", "employee", "allow", `edited idea ${idea.id}: ${columns.map((c) => c.split(" = ")[0]).join(", ")}`);
  return { ok: true, idea: getIdea(idea.id)! };
}

/** One edge of the Section 14 machine, with the reason that the internal history keeps. */
export function moveIdeaStatus(actor: Author, ideaId: string, to: string, reason: string): IdeaResult {
  const denied = ownerDenial(actor);
  if (denied) return { ok: false, status: 403, reason: denied };

  const idea = getIdea(ideaId);
  if (!idea) return { ok: false, status: 404, reason: "not found" };
  if (!isIdeaStatus(idea.status)) return { ok: false, status: 409, reason: `this idea carries a status the machine does not know (${idea.status})` };
  if (!isIdeaStatus(to)) return { ok: false, status: 409, reason: `${to} is not an idea status` };
  if (idea.status === to) return { ok: false, status: 409, reason: `this idea is already ${to}` };

  const rule = ideaTransitionRule(idea.status as IdeaStatus, to as IdeaStatus);
  if (!rule || !canMoveIdea(idea.status as IdeaStatus, to as IdeaStatus)) {
    return { ok: false, status: 409, reason: `cannot move an idea from ${idea.status} to ${to}` };
  }

  const ts = nowIso();
  const write = getDb().transaction(() => {
    getDb().prepare("UPDATE ideas SET status = ?, updated_at = ? WHERE id = ?").run(to, ts, idea.id);
    getDb()
      .prepare("INSERT INTO idea_status_history (id, idea_id, from_status, to_status, reason, actor_id, at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(uuid(), idea.id, idea.status, to, reason, actor.userId, ts);
    // The owner of the record is the product owner who opened it, and they are told when somebody
    // else moved it. A moderator reading a status never sees the internal reason.
    if (idea.created_by !== actor.userId) {
      notify(
        idea.created_by,
        "idea.status",
        `Your idea "${idea.title}" moved from ${idea.status} to ${to}: ${reason}`,
        `idea-status-${idea.id}-${to}-${Date.now()}`,
      );
    }
  });
  write();

  audit(actor, "idea.write", "employee", "allow", `idea ${idea.id} ${idea.status} to ${to} (${rule})`);
  return { ok: true, idea: getIdea(idea.id)! };
}

/**
 * Section 14: evidence reaches an idea only through a grant, and only a shared copy the owner can
 * already see can be granted. A private contribution, another tenant's source text or a withdrawn
 * record is not attachable, and a copy the owner cannot see reads as missing.
 */
export function grantEvidence(actor: Author, ideaId: string, sharedViewId: string): EvidenceResult {
  const denied = ownerDenial(actor);
  if (denied) return { ok: false, status: 403, reason: denied };

  if (!getIdea(ideaId)) return { ok: false, status: 404, reason: "not found" };
  if (!visibleSharedViewById(actor, sharedViewId)) return { ok: false, status: 404, reason: "not found" };

  const result = getDb()
    .prepare("INSERT OR IGNORE INTO idea_evidence_grants (idea_id, shared_view_id) VALUES (?, ?)")
    .run(ideaId, sharedViewId);

  audit(actor, "idea.write", "employee", "allow", `${result.changes ? "granted" : "already granted"} evidence ${sharedViewId} on idea ${ideaId}`);
  return { ok: true, ideaId, sharedViewId, granted: result.changes > 0 };
}

export function revokeEvidence(actor: Author, ideaId: string, sharedViewId: string): EvidenceResult {
  const denied = ownerDenial(actor);
  if (denied) return { ok: false, status: 403, reason: denied };

  if (!getIdea(ideaId)) return { ok: false, status: 404, reason: "not found" };
  const result = getDb()
    .prepare("DELETE FROM idea_evidence_grants WHERE idea_id = ? AND shared_view_id = ?")
    .run(ideaId, sharedViewId);
  if (result.changes === 0) return { ok: false, status: 404, reason: "that evidence is not attached to this idea" };

  audit(actor, "idea.write", "employee", "allow", `revoked evidence ${sharedViewId} on idea ${ideaId}`);
  return { ok: true, ideaId, sharedViewId, granted: false };
}

// The client-facing text and the moderator's approval of it live in ./idea-updates.
