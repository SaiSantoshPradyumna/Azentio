// Two-person platform grant flow (Section 7.3). Pending requests live in config as JSON
// because Section 5 has no grant_requests table (see DECISIONS.md).

import { getDb, nowIso, uuid } from "./db";
import type { Actor } from "./authorize";
import { audit } from "./audit";
import { notify } from "./notify";
import { PLATFORM_PERMISSIONS, type PlatformPermission } from "./platform-permissions";

export { PLATFORM_PERMISSIONS, type PlatformPermission };

const PREFIX = "grant_request:";

export type GrantRequest = {
  id: string;
  targetUserId: string;
  targetEmail: string;
  permission: string;
  requestedBy: string;
  requestedByEmail: string;
  requestedAt: string;
  status: "pending" | "approved" | "rejected";
  approvedBy?: string;
  approvedByEmail?: string;
  decidedAt?: string;
};

function key(id: string): string {
  return `${PREFIX}${id}`;
}

function readRequest(id: string): GrantRequest | null {
  const row = getDb().prepare("SELECT value FROM config WHERE key = ?").get(key(id)) as { value: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.value) as GrantRequest;
  } catch {
    return null;
  }
}

function writeRequest(req: GrantRequest): void {
  getDb()
    .prepare(
      `INSERT INTO config (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(key(req.id), JSON.stringify(req));
}

export function listGrantRequests(): GrantRequest[] {
  const rows = getDb()
    .prepare("SELECT key, value FROM config WHERE key LIKE ? ORDER BY key")
    .all(`${PREFIX}%`) as { key: string; value: string }[];
  return rows
    .map((r) => {
      try {
        return JSON.parse(r.value) as GrantRequest;
      } catch {
        return null;
      }
    })
    .filter((r): r is GrantRequest => !!r)
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
}

export function requestPlatformGrant(
  actor: NonNullable<Actor>,
  input: { email: string; permission: string },
): { ok: true; request: GrantRequest } | { ok: false; status: 400 | 404; reason: string } {
  if (!(PLATFORM_PERMISSIONS as readonly string[]).includes(input.permission)) {
    return { ok: false, status: 400, reason: "unknown platform permission" };
  }
  const email = input.email.trim().toLowerCase();
  const user = getDb().prepare("SELECT id, email FROM users WHERE email = ?").get(email) as
    | { id: string; email: string }
    | undefined;
  if (!user) return { ok: false, status: 404, reason: "user not found" };

  const provisioned = getDb()
    .prepare("SELECT active FROM employee_provisioning WHERE email = ?")
    .get(email) as { active: number } | undefined;
  if (!provisioned || provisioned.active !== 1) {
    return { ok: false, status: 400, reason: "target must be an active provisioned employee" };
  }

  const id = uuid();
  const request: GrantRequest = {
    id,
    targetUserId: user.id,
    targetEmail: user.email,
    permission: input.permission,
    requestedBy: actor.userId,
    requestedByEmail: actor.email,
    requestedAt: nowIso(),
    status: "pending",
  };
  writeRequest(request);
  audit(actor, "role.grant.platform", "employee", "allow", `requested ${input.permission} for ${email}`);
  notify(
    actor.userId,
    "grant.requested",
    `Platform grant request stored for ${email} → ${input.permission}. A second holder of platform.role.grant must approve.`,
    `grant.req:${id}`,
  );
  return { ok: true, request };
}

export function decidePlatformGrant(
  actor: NonNullable<Actor>,
  requestId: string,
  decision: "approve" | "reject",
): { ok: true; request: GrantRequest } | { ok: false; status: 400 | 404 | 409; reason: string } {
  const request = readRequest(requestId);
  if (!request) return { ok: false, status: 404, reason: "grant request not found" };
  if (request.status !== "pending") return { ok: false, status: 409, reason: "request already decided" };
  if (request.requestedBy === actor.userId) {
    return { ok: false, status: 400, reason: "two different users are required — the requester cannot approve" };
  }

  if (decision === "reject") {
    const updated: GrantRequest = {
      ...request,
      status: "rejected",
      approvedBy: actor.userId,
      approvedByEmail: actor.email,
      decidedAt: nowIso(),
    };
    writeRequest(updated);
    audit(actor, "role.grant.platform", "employee", "allow", `rejected ${requestId}`);
    return { ok: true, request: updated };
  }

  getDb()
    .prepare("INSERT OR IGNORE INTO platform_grants (user_id, permission) VALUES (?, ?)")
    .run(request.targetUserId, request.permission);

  const updated: GrantRequest = {
    ...request,
    status: "approved",
    approvedBy: actor.userId,
    approvedByEmail: actor.email,
    decidedAt: nowIso(),
  };
  writeRequest(updated);
  audit(
    actor,
    "role.grant.platform",
    "employee",
    "allow",
    `approved ${request.permission} for ${request.targetEmail} (requested by ${request.requestedByEmail})`,
  );
  notify(
    request.targetUserId,
    "grant.approved",
    `Platform permission ${request.permission} was approved by a second administrator.`,
    `grant.ok:${requestId}`,
  );
  return { ok: true, request: updated };
}

export function listPlatformGrants(): Array<{ email: string; permission: string }> {
  return getDb()
    .prepare(
      `SELECT u.email AS email, g.permission AS permission
       FROM platform_grants g JOIN users u ON u.id = g.user_id
       ORDER BY u.email, g.permission`,
    )
    .all() as Array<{ email: string; permission: string }>;
}
