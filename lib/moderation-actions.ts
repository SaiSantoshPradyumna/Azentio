import { audit } from "./audit";
import { type Author, getContribution, type OpResult } from "./contributions";
import { getDb, nowIso } from "./db";
import { recordDecision } from "./publish";
import { notify } from "./notify";
import { canTransition, transitionRule, type ContributionState } from "./lifecycle";
import { flagsFor } from "./moderation";

// Moderation writes. Each one moves the Section 9 machine, records a moderation_decisions row,
// notifies the author and writes an audit row — the transition table, not the handler, decides what
// is legal, so an illegal move is a 409 here exactly as it is over HTTP.

function requireModerator(actor: Author): OpResult | null {
  if (!actor.isEmployee || !actor.platformPerms.has("learning.moderate")) {
    return { ok: false, status: 403, reason: "learning.moderate is required" };
  }
  return null;
}

/** Loads the record and checks the machine; returns either an OpResult failure or the row. */
function moveable(
  id: string,
  to: ContributionState,
  stateHint: string,
): { failure: OpResult } | { row: NonNullable<ReturnType<typeof getContribution>> } {
  const row = getContribution(id);
  if (!row) return { failure: { ok: false, status: 404, reason: "not found" } };
  if (!canTransition(row.state, to)) {
    return { failure: { ok: false, status: 409, reason: `cannot move a ${row.state} item to ${stateHint}` } };
  }
  return { row };
}

function applyMove(rowId: string, to: ContributionState): void {
  getDb().prepare("UPDATE contributions SET state = ?, updated_at = ? WHERE id = ?").run(to, nowIso(), rowId);
}

/** Submitted to In review: the item is now with this moderator. */
export function startReview(actor: Author, id: string): OpResult {
  const denied = requireModerator(actor);
  if (denied) return denied;

  const target = moveable(id, "In review", "review");
  if ("failure" in target) return target.failure;
  const row = target.row;
  const rule = transitionRule(row.state, "In review");

  const write = getDb().transaction(() => {
    applyMove(row.id, "In review");
    recordDecision(row.id, actor.userId, "In review", rule?.guard ?? "moderator took the item", null);
    notify(row.author_id, "moderation.decision", `A moderator has opened your observation "${row.title}" for review.`, `inreview-${row.id}-${Date.now()}`);
  });
  write();

  audit(actor, "moderation.review", `tenant:${row.tenant_id}`, "allow", "started review");
  return { ok: true, row: getContribution(row.id)! };
}

/** In review to Returned: the author must change something before it can be submitted again. */
export function returnToAuthor(actor: Author, id: string, reason: string, internalNote: string | null): OpResult {
  const denied = requireModerator(actor);
  if (denied) return denied;

  const target = moveable(id, "Returned", "the author");
  if ("failure" in target) return target.failure;
  const row = target.row;

  const write = getDb().transaction(() => {
    applyMove(row.id, "Returned");
    recordDecision(row.id, actor.userId, "Returned", reason, internalNote);
    notify(row.author_id, "moderation.decision", `Your observation "${row.title}" was returned: ${reason}`, `returned-${row.id}-${Date.now()}`);
  });
  write();

  audit(actor, "moderation.review", `tenant:${row.tenant_id}`, "allow", "returned to author with a reason");
  return { ok: true, row: getContribution(row.id)! };
}

/** In review to Rejected, with the reason the author is told. */
export function rejectContribution(actor: Author, id: string, reason: string, internalNote: string | null): OpResult {
  const denied = requireModerator(actor);
  if (denied) return denied;

  const target = moveable(id, "Rejected", "rejected");
  if ("failure" in target) return target.failure;
  const row = target.row;

  const write = getDb().transaction(() => {
    applyMove(row.id, "Rejected");
    recordDecision(row.id, actor.userId, "Rejected", reason, internalNote);
    notify(row.author_id, "moderation.decision", `Your observation "${row.title}" was not accepted: ${reason}`, `rejected-${row.id}-${Date.now()}`);
  });
  write();

  audit(actor, "moderation.review", `tenant:${row.tenant_id}`, "allow", "rejected with a reason");
  return { ok: true, row: getContribution(row.id)! };
}

export type FlagResolution = "redacted" | "not_sensitive";

/**
 * A scan is a hint, so resolving a flag is a recorded human decision. The reason lives in
 * moderation_decisions (the flags table has no reason column); the flag row only stops counting as
 * unresolved.
 */
export function resolveFlag(actor: Author, flagId: string, resolution: FlagResolution, reason: string): OpResult {
  const denied = requireModerator(actor);
  if (denied) return denied;

  const flag = getDb().prepare("SELECT id, contribution_id, kind, snippet, resolved FROM contribution_flags WHERE id = ?").get(flagId) as
    | { id: string; contribution_id: string; kind: string; snippet: string; resolved: number }
    | undefined;
  if (!flag) return { ok: false, status: 404, reason: "not found" };
  if (flag.resolved === 1) return { ok: false, status: 409, reason: "this hint is already resolved" };

  const row = getContribution(flag.contribution_id);
  if (!row) return { ok: false, status: 404, reason: "not found" };
  if (row.state === "Draft") return { ok: false, status: 403, reason: "a draft is not open for review" };

  const text = resolution === "redacted" ? "redaction applied" : "reviewed, not sensitive";
  const write = getDb().transaction(() => {
    getDb()
      .prepare("UPDATE contribution_flags SET resolved = 1, resolved_by = ? WHERE id = ?")
      .run(actor.userId, flag.id);
    recordDecision(row.id, actor.userId, `Flag ${resolution}`, `${flag.kind}: ${flag.snippet} — ${text}`, reason);
  });
  write();

  const left = flagsFor(row.id).filter((entry) => entry.resolved === 0).length;
  audit(actor, "moderation.review", `tenant:${row.tenant_id}`, "allow", `flag ${flag.kind} resolved as ${resolution}, ${left} unresolved`);
  return { ok: true, row: getContribution(row.id)! };
}

// Reports — raising one, suspending the copy and the moderator's decision — live in ./reports.
