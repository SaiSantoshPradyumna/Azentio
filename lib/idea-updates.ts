import { authorize } from "./authorize";
import { audit } from "./audit";
import { getDb, nowIso, uuid } from "./db";
import { notify } from "./notify";
import type { Author } from "./contributions";
import { getIdea, getIdeaUpdate, type IdeaUpdateRow } from "./ideas";

// Section 14's client-facing text, kept apart from the idea record and its status machine in
// ./idea-writes.ts because it answers to a different grant: a product owner writes it, and only a
// moderator's account makes it real for a client.
//
// idea_public_updates has no pending flag, so the approval is expressed as data: a text counts as
// approved when the account named in approved_by holds learning.moderate (lib/ideas.ts MODERATOR_APPROVED).
// A product owner's post therefore stores truthfully — their own account stands behind it — and stays
// out of every client read until a moderator approves it.

export type UpdateResult =
  | { ok: true; update: IdeaUpdateRow; approved: boolean }
  | { ok: false; status: 403 | 404 | 409; reason: string };

function ownerDenial(actor: Author): string | null {
  const decision = authorize(actor, "idea.public_update", { audience: "employee" });
  return decision.allow ? null : decision.reason;
}

function moderatorDenial(actor: Author): string | null {
  const decision = authorize(actor, "moderation.review", { audience: "employee" });
  return decision.allow ? null : decision.reason;
}

function moderatorIds(): string[] {
  return (
    getDb()
      .prepare("SELECT user_id FROM platform_grants WHERE permission = 'learning.moderate'")
      .all() as { user_id: string }[]
  ).map((row) => row.user_id);
}

/**
 * Write the client-facing update. Posted by an account that already holds learning.moderate it is
 * approved on the spot; posted by a product owner it goes to the moderators' bells and to the console
 * queue, and a client sees nothing.
 */
export function proposePublicUpdate(actor: Author, ideaId: string, text: string): UpdateResult {
  const denied = ownerDenial(actor);
  if (denied) return { ok: false, status: 403, reason: denied };

  const idea = getIdea(ideaId);
  if (!idea) return { ok: false, status: 404, reason: "not found" };

  const id = uuid();
  const ts = nowIso();
  const alreadyApproved = actor.platformPerms.has("learning.moderate");

  const write = getDb().transaction(() => {
    getDb()
      .prepare("INSERT INTO idea_public_updates (id, idea_id, text, approved_by, at) VALUES (?, ?, ?, ?, ?)")
      .run(id, idea.id, text, actor.userId, ts);
    if (!alreadyApproved) {
      for (const moderatorId of moderatorIds()) {
        notify(
          moderatorId,
          "idea.update.pending",
          `A client-facing update for "${idea.title}" awaits a moderator's approval: ${text}`,
          `idea-update-${id}-${moderatorId}`,
        );
      }
    }
  });
  write();

  const update = getIdeaUpdate(id)!;
  audit(actor, "idea.public_update", "employee", "allow", `client update ${id} on idea ${idea.id}, client-visible=${update.approved}`);
  return { ok: true, update, approved: update.approved };
}

/** The moderator names the text they stand behind; the row then becomes client-visible. */
export function approvePublicUpdate(actor: Author, ideaId: string, updateId: string): UpdateResult {
  const denied = moderatorDenial(actor);
  if (denied) return { ok: false, status: 403, reason: denied };

  const idea = getIdea(ideaId);
  if (!idea) return { ok: false, status: 404, reason: "not found" };

  const update = getIdeaUpdate(updateId);
  if (!update || update.idea_id !== idea.id) return { ok: false, status: 404, reason: "not found" };
  if (update.approved) return { ok: false, status: 409, reason: "a moderator already approved this text" };

  const ts = nowIso();
  const write = getDb().transaction(() => {
    getDb().prepare("UPDATE idea_public_updates SET approved_by = ?, at = ? WHERE id = ?").run(actor.userId, ts, update.id);
    notify(
      idea.created_by,
      "idea.update.approved",
      `A moderator approved the client update for "${idea.title}". It is now visible to clients.`,
      `idea-update-approved-${update.id}`,
    );
  });
  write();

  const approved = getIdeaUpdate(update.id)!;
  audit(actor, "moderation.review", "employee", "allow", `approved client update ${approved.id} on idea ${idea.id}`);
  return { ok: true, update: approved, approved: true };
}
