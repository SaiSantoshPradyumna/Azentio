import { getDb, nowIso, uuid } from "./db";

export type OutboxEntry = {
  id: string;
  kind: "otp" | "invitation";
  email: string;
  detail: string;
  at: string;
};

const OUTBOX_LIMIT = 50;

/** In-app notification (Section 15). Never described as "email delivered". */
export function notify(userId: string, kind: string, message: string, key: string): void {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO notifications (id, user_id, kind, message, idempotency_key, channel, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'in_app', 'stored', ?)`,
    )
    .run(uuid(), userId, kind, message, key, nowIso());
}

/**
 * Demo outbox entry. The row is the queue: reading it from the database survives a dev-server
 * recompile, unlike a module-level array. Nothing here was delivered by email.
 */
export function pushDevOutbox(input: {
  userId: string;
  kind: OutboxEntry["kind"];
  email: string;
  detail: string;
  key: string;
}): void {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO notifications (id, user_id, kind, message, idempotency_key, channel, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'dev_outbox', 'queued (demo)', ?)`,
    )
    .run(uuid(), input.userId, `dev_outbox.${input.kind}`, input.detail, input.key, nowIso());
}

export function readDevOutbox(): OutboxEntry[] {
  const rows = getDb()
    .prepare(
      `SELECT n.id AS id, n.kind AS kind, u.email AS email, n.message AS detail, n.created_at AS at
       FROM notifications n JOIN users u ON u.id = n.user_id
       WHERE n.channel = 'dev_outbox' ORDER BY n.rowid DESC LIMIT ?`,
    )
    .all(OUTBOX_LIMIT) as { id: string; kind: string; email: string; detail: string; at: string }[];

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind.endsWith("invitation") ? "invitation" : "otp",
    email: row.email,
    detail: row.detail,
    at: row.at,
  }));
}

export type NotificationRow = {
  id: string;
  kind: string;
  message: string;
  status: string;
  created_at: string;
  read_at: string | null;
};

/** In-app only: the dev outbox queue is a separate demo view, and nothing here was delivered by email. */
export function listNotifications(userId: string, limit = 50): NotificationRow[] {
  return getDb()
    .prepare(
      `SELECT id, kind, message, status, created_at, read_at FROM notifications
       WHERE user_id = ? AND channel = 'in_app' ORDER BY created_at DESC, rowid DESC LIMIT ?`,
    )
    .all(userId, limit) as NotificationRow[];
}

export function unreadCount(userId: string): number {
  return (
    getDb()
      .prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND channel = 'in_app' AND read_at IS NULL")
      .get(userId) as { n: number }
  ).n;
}

/** Own rows only: the id is paired with the session user, so another user's row reads as missing. */
export function markNotificationRead(userId: string, id: string): boolean {
  const result = getDb()
    .prepare("UPDATE notifications SET read_at = ?, status = 'read' WHERE id = ? AND user_id = ? AND read_at IS NULL")
    .run(nowIso(), id, userId);
  return result.changes > 0;
}
