import crypto from "node:crypto";
import { getDb, nowIso } from "./db";
import type { Actor } from "./authorize";

const ZERO_HASH = "0".repeat(64);

export type AuditRow = {
  id: number;
  ts: string;
  actor_id: string | null;
  active_tenant_id: string | null;
  action: string;
  resource: string;
  decision: string;
  reason: string;
  prev_hash: string;
  hash: string;
};

function digest(input: {
  prevHash: string;
  ts: string;
  actor: string;
  action: string;
  resource: string;
  decision: string;
  reason: string;
}): string {
  return crypto
    .createHash("sha256")
    .update(input.prevHash + input.ts + input.actor + input.action + input.resource + input.decision + input.reason)
    .digest("hex");
}

/** Appends one audit row. Denied attempts are recorded as well as allowed ones. */
export function audit(
  actor: Actor,
  action: string,
  resource: string,
  decision: "allow" | "deny",
  reason: string,
): void {
  const db = getDb();
  const ts = nowIso();
  const actorId = actor ? actor.userId : "";
  const activeTenantId = actor && actor.activeTenantId ? actor.activeTenantId : "";

  const append = db.transaction(() => {
    const last = db.prepare("SELECT hash FROM audit_log ORDER BY id DESC LIMIT 1").get() as { hash: string } | undefined;
    const prevHash = last ? last.hash : ZERO_HASH;
    const hash = digest({ prevHash, ts, actor: actorId, action, resource, decision, reason });
    db.prepare(
      `INSERT INTO audit_log (ts, actor_id, active_tenant_id, action, resource, decision, reason, prev_hash, hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(ts, actorId || null, activeTenantId || null, action, resource, decision, reason, prevHash, hash);
  });
  append();
}

export function readAudit(limit = 50): AuditRow[] {
  return getDb()
    .prepare("SELECT * FROM audit_log ORDER BY id DESC LIMIT ?")
    .all(limit) as AuditRow[];
}

export function verifyChain(): { ok: boolean; rows: number; firstBadId: number | null } {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM audit_log ORDER BY id ASC").all() as AuditRow[];
  let prevHash = ZERO_HASH;
  for (const row of rows) {
    const expected = digest({
      prevHash: row.prev_hash,
      ts: row.ts,
      actor: row.actor_id ?? "",
      action: row.action,
      resource: row.resource,
      decision: row.decision,
      reason: row.reason,
    });
    if (row.prev_hash !== prevHash || row.hash !== expected) {
      return { ok: false, rows: rows.length, firstBadId: row.id };
    }
    prevHash = row.hash;
  }
  return { ok: true, rows: rows.length, firstBadId: null };
}
