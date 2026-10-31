import crypto from "node:crypto";
import { getDb, nowIso, uuid } from "./db";
import type { Actor, ClientRole } from "./authorize";
import { CLIENT_ROLE_PERMISSIONS } from "./authorize";
import { audit } from "./audit";
import { notify, pushDevOutbox } from "./notify";

const INVITE_TTL_MS = 72 * 60 * 60 * 1000;
const CLIENT_ROLES: ClientRole[] = ["client_admin", "contributor", "viewer"];

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

export function isClientRole(value: string): value is ClientRole {
  return (CLIENT_ROLES as string[]).includes(value);
}

export type InvitationRow = {
  id: string;
  tenant_id: string;
  email: string;
  client_role: ClientRole;
  expires_at: string;
  used_at: string | null;
  created_by: string;
};

export function createInvitation(
  actor: NonNullable<Actor>,
  input: { email: string; clientRole: string },
):
  | { ok: true; invitation: InvitationRow; token: string; acceptPath: string }
  | { ok: false; status: 400 | 403; reason: string } {
  if (!actor.activeTenantId) return { ok: false, status: 403, reason: "no active organisation" };
  if (!isClientRole(input.clientRole)) {
    return {
      ok: false,
      status: 400,
      reason: "role must be one of client_admin, contributor, viewer — platform roles cannot be invited by a client admin",
    };
  }

  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) return { ok: false, status: 400, reason: "a valid email is required" };

  const token = crypto.randomBytes(32).toString("hex");
  const id = uuid();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();

  getDb()
    .prepare(
      `INSERT INTO invitations (id, token_hash, tenant_id, email, client_role, expires_at, used_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
    )
    .run(id, sha256(token), actor.activeTenantId, email, input.clientRole, expiresAt, actor.userId);

  const invitation = getDb().prepare("SELECT * FROM invitations WHERE id = ?").get(id) as InvitationRow;
  const acceptPath = `/accept-invite/${token}`;
  const base = process.env.BASE_URL ?? "http://localhost:3000";

  pushDevOutbox({
    userId: actor.userId,
    kind: "invitation",
    email,
    detail: `Invitation for ${email} as ${input.clientRole} — open ${base}${acceptPath} (queued demo, not emailed). Expires ${expiresAt}.`,
    key: `invite:${id}`,
  });
  notify(
    actor.userId,
    "invitation.created",
    `Invitation stored for ${email} (${input.clientRole}). Link is in the Dev outbox — nothing was emailed.`,
    `invite.notify:${id}`,
  );
  audit(actor, "invite.create", `tenant:${actor.activeTenantId}`, "allow", `invited ${email} as ${input.clientRole}`);

  return { ok: true, invitation, token, acceptPath };
}

export function acceptInvitation(
  actor: NonNullable<Actor>,
  token: string,
): { ok: true; membershipId: string; tenantId: string } | { ok: false; status: 400 | 403 | 404; reason: string } {
  const hash = sha256(token);
  const row = getDb()
    .prepare("SELECT * FROM invitations WHERE token_hash = ?")
    .get(hash) as
    | (InvitationRow & { token_hash: string })
    | undefined;

  if (!row) return { ok: false, status: 404, reason: "invitation not found" };
  if (row.used_at) return { ok: false, status: 400, reason: "invitation already used" };
  if (Date.now() > new Date(row.expires_at).getTime()) {
    return { ok: false, status: 400, reason: "invitation expired" };
  }
  if (actor.email.toLowerCase() !== row.email.toLowerCase()) {
    return { ok: false, status: 403, reason: "signed-in email does not match the invitation" };
  }

  const db = getDb();
  const existing = db
    .prepare("SELECT id, status FROM memberships WHERE user_id = ? AND tenant_id = ?")
    .get(actor.userId, row.tenant_id) as { id: string; status: string } | undefined;

  let membershipId: string;
  if (existing) {
    db.prepare("UPDATE memberships SET status = 'active', client_role = ? WHERE id = ?").run(
      row.client_role,
      existing.id,
    );
    membershipId = existing.id;
  } else {
    membershipId = uuid();
    db.prepare(
      "INSERT INTO memberships (id, user_id, tenant_id, client_role, status) VALUES (?, ?, ?, ?, 'active')",
    ).run(membershipId, actor.userId, row.tenant_id, row.client_role);
  }

  db.prepare("UPDATE invitations SET used_at = ? WHERE id = ?").run(nowIso(), row.id);
  audit(actor, "invite.accept", `tenant:${row.tenant_id}`, "allow", `accepted invitation ${row.id}`);
  return { ok: true, membershipId, tenantId: row.tenant_id };
}

export function listInvitationsForTenant(tenantId: string): InvitationRow[] {
  return getDb()
    .prepare(
      `SELECT id, tenant_id, email, client_role, expires_at, used_at, created_by FROM invitations
       WHERE tenant_id = ? ORDER BY expires_at DESC`,
    )
    .all(tenantId) as InvitationRow[];
}

export function listMembers(tenantId: string): Array<{
  membershipId: string;
  userId: string;
  email: string;
  name: string;
  role: ClientRole;
  status: string;
}> {
  return getDb()
    .prepare(
      `SELECT m.id AS membershipId, u.id AS userId, u.email AS email, u.name AS name,
              m.client_role AS role, m.status AS status
       FROM memberships m JOIN users u ON u.id = m.user_id
       WHERE m.tenant_id = ? ORDER BY u.email`,
    )
    .all(tenantId) as Array<{
    membershipId: string;
    userId: string;
    email: string;
    name: string;
    role: ClientRole;
    status: string;
  }>;
}

export function setClientRole(
  actor: NonNullable<Actor>,
  membershipId: string,
  role: string,
): { ok: true } | { ok: false; status: 400 | 403 | 404; reason: string } {
  if (!actor.activeTenantId) return { ok: false, status: 403, reason: "no active organisation" };
  if (!isClientRole(role)) {
    return { ok: false, status: 400, reason: "only client_admin, contributor or viewer may be granted" };
  }
  const row = getDb()
    .prepare("SELECT id, tenant_id FROM memberships WHERE id = ?")
    .get(membershipId) as { id: string; tenant_id: string } | undefined;
  if (!row || row.tenant_id !== actor.activeTenantId) {
    return { ok: false, status: 404, reason: "membership not found" };
  }
  getDb().prepare("UPDATE memberships SET client_role = ? WHERE id = ?").run(role, membershipId);
  audit(actor, "role.grant.client", `tenant:${actor.activeTenantId}`, "allow", `set ${membershipId} to ${role}`);
  void CLIENT_ROLE_PERMISSIONS; // keep import used for documentation of derived perms
  return { ok: true };
}
