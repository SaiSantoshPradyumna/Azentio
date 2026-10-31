import crypto from "node:crypto";
import { getDb, nowIso, uuid } from "./db";
import type { Actor, ClientRole } from "./authorize";

export const SESSION_COOKIE = "sid";
export const IDLE_MS = 30 * 60 * 1000;
export const ABSOLUTE_MS = 8 * 60 * 60 * 1000;
export const OTP_TTL_MS = 10 * 60 * 1000;
export const EMPLOYEE_DOMAIN = "@azentio.com";

export type SessionRow = {
  id: string;
  user_id: string;
  active_tenant_id: string | null;
  created_at: string;
  last_seen: string;
  expires_at: string;
  revoked: number;
};

export type Membership = { tenantId: string; tenantName: string; role: ClientRole };

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function later(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}

function isPast(iso: string): boolean {
  return Date.now() > new Date(iso).getTime();
}

/* ------------------------------------------------------------------ rate limit */

const windows = new Map<string, number[]>();

function takeSlot(bucket: string, max: number): boolean {
  const now = Date.now();
  const hits = (windows.get(bucket) ?? []).filter((t) => now - t < 10 * 60 * 1000);
  if (hits.length >= max) {
    windows.set(bucket, hits);
    return false;
  }
  hits.push(now);
  windows.set(bucket, hits);
  return true;
}

export function allowOtpRequest(email: string): boolean {
  return takeSlot(`otp:${email.toLowerCase()}`, 5);
}

export function allowVerifyAttempt(email: string): boolean {
  return takeSlot(`verify:${email.toLowerCase()}`, 10);
}

/* ----------------------------------------------------------------------- otp */

export function createOtp(email: string): { code: string | null } {
  const db = getDb();
  const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase()) as
    | { id: string }
    | undefined;
  // No account enumeration: callers always report success, and no code exists for unknown addresses.
  if (!user) return { code: null };

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  db.prepare("INSERT INTO otp_codes (email, code_hash, expires_at, used) VALUES (?, ?, ?, 0)").run(
    email.toLowerCase(),
    sha256(code),
    later(OTP_TTL_MS),
  );
  return { code };
}

export function verifyOtp(email: string, code: string): { ok: boolean; userId?: string; reason?: string } {
  const db = getDb();
  const rows = db
    .prepare("SELECT rowid AS rid, code_hash, expires_at, used FROM otp_codes WHERE email = ? ORDER BY rowid DESC")
    .all(email.toLowerCase()) as { rid: number; code_hash: string; expires_at: string; used: number }[];

  const hash = sha256(code);
  const match = rows.find((r) => r.used === 0 && r.code_hash === hash && !isPast(r.expires_at));
  if (!match) return { ok: false, reason: "code is invalid or expired" };

  db.prepare("UPDATE otp_codes SET used = 1 WHERE rowid = ?").run(match.rid);
  const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase()) as { id: string } | undefined;
  if (!user) return { ok: false, reason: "no such user" };
  return { ok: true, userId: user.id };
}

/* ------------------------------------------------------------------- session */

export function createSession(userId: string): {
  sessionId: string;
  activeTenantId: string | null;
  membershipCount: number;
} {
  const db = getDb();
  const id = uuid();
  const ts = nowIso();
  // Exactly one active membership is selected automatically; several require an explicit choice.
  const active = db
    .prepare("SELECT tenant_id FROM memberships WHERE user_id = ? AND status = 'active'")
    .all(userId) as { tenant_id: string }[];
  const activeTenantId = active.length === 1 ? active[0].tenant_id : null;

  db.prepare(
    "INSERT INTO sessions (id, user_id, active_tenant_id, created_at, last_seen, expires_at, revoked) VALUES (?, ?, ?, ?, ?, ?, 0)",
  ).run(id, userId, activeTenantId, ts, ts, later(ABSOLUTE_MS));
  return { sessionId: id, activeTenantId, membershipCount: active.length };
}

export function loadSession(sessionId: string): SessionRow | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId) as SessionRow | undefined;
  if (!row) return null;
  if (row.revoked === 1) return null;
  if (isPast(row.expires_at)) return null;
  if (Date.now() - new Date(row.last_seen).getTime() > IDLE_MS) return null;

  db.prepare("UPDATE sessions SET last_seen = ? WHERE id = ?").run(nowIso(), sessionId);
  return row;
}

export function revokeSession(sessionId: string): void {
  getDb().prepare("UPDATE sessions SET revoked = 1 WHERE id = ?").run(sessionId);
}

export function setActiveTenant(sessionId: string, tenantId: string): boolean {
  const db = getDb();
  const session = db.prepare("SELECT user_id FROM sessions WHERE id = ? AND revoked = 0").get(sessionId) as
    | { user_id: string }
    | undefined;
  if (!session) return false;
  const member = db
    .prepare("SELECT tenant_id FROM memberships WHERE user_id = ? AND tenant_id = ? AND status = 'active'")
    .get(session.user_id, tenantId) as { tenant_id: string } | undefined;
  if (!member) return false;
  db.prepare("UPDATE sessions SET active_tenant_id = ? WHERE id = ?").run(tenantId, sessionId);
  return true;
}

/* --------------------------------------------------------------------- actor */

export function membershipsForUser(userId: string): Membership[] {
  return getDb()
    .prepare(
      `SELECT m.tenant_id AS tenantId, t.name AS tenantName, m.client_role AS role
       FROM memberships m JOIN tenants t ON t.id = m.tenant_id
       WHERE m.user_id = ? AND m.status = 'active' ORDER BY t.name`,
    )
    .all(userId) as Membership[];
}

export function isEmployeeEmail(email: string): boolean {
  if (!email.toLowerCase().endsWith(EMPLOYEE_DOMAIN)) return false;
  const row = getDb()
    .prepare("SELECT active FROM employee_provisioning WHERE email = ?")
    .get(email.toLowerCase()) as { active: number } | undefined;
  return !!row && row.active === 1;
}

export function buildActor(session: SessionRow): Actor {
  const db = getDb();
  const user = db.prepare("SELECT id, email FROM users WHERE id = ?").get(session.user_id) as
    | { id: string; email: string }
    | undefined;
  if (!user) return null;

  const grants = db.prepare("SELECT permission FROM platform_grants WHERE user_id = ?").all(user.id) as {
    permission: string;
  }[];

  const memberships = membershipsForUser(user.id);
  let activeTenantId = session.active_tenant_id;
  if (activeTenantId && !memberships.some((m) => m.tenantId === activeTenantId)) activeTenantId = null;

  const entitled = activeTenantId
    ? (db
        .prepare(
          `SELECT p.slug FROM entitlements e JOIN products p ON p.id = e.product_id WHERE e.tenant_id = ?`,
        )
        .all(activeTenantId) as { slug: string }[])
    : [];

  return {
    userId: user.id,
    email: user.email,
    isEmployee: isEmployeeEmail(user.email),
    platformPerms: new Set(grants.map((g) => g.permission)),
    activeTenantId,
    clientRole: memberships.find((m) => m.tenantId === activeTenantId)?.role ?? null,
    entitledProducts: new Set(entitled.map((e) => e.slug)),
  };
}

export function actorFromSessionId(sessionId: string | undefined): { session: SessionRow | null; actor: Actor } {
  if (!sessionId) return { session: null, actor: null };
  const session = loadSession(sessionId);
  if (!session) return { session: null, actor: null };
  return { session, actor: buildActor(session) };
}
