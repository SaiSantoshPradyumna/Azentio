import type { Actor } from "./authorize";
import { readConsents, type ConsentRow } from "./consents";
import { getContribution, type ContributionRow } from "./contributions";
import { getDb } from "./db";
import { sharedViewIdsFor, sharedViewRecord } from "./publish";
import { visibleSharedViewById, type SharedViewDTO } from "./visible";

// Moderation reads (Section 10, 17 and 18). The console is employee-audience: a moderator sees the
// private source of an item that is waiting for them, which a colleague never sees. Section 7.3 limits
// that to Submitted, In review, Returned, or an item that is the subject of an open report — never a
// Draft — and every read of it is audited by the route.

export type FlagRow = {
  id: string;
  contribution_id: string;
  kind: string;
  snippet: string;
  resolved: number;
  resolved_by: string | null;
};

export type DecisionRow = {
  id: string;
  contribution_id: string;
  moderator_id: string;
  decision: string;
  reason: string;
  internal_note: string | null;
  at: string;
};

export type ReportRow = {
  id: string;
  shared_view_id: string;
  reporter_user_id: string;
  reporter_email: string;
  contribution_id: string | null;
  shared_title: string | null;
  /** The copy's own state, so the console can say plainly that a reported item is suspended. */
  view_state: string | null;
  /** The record's lifecycle state, so the console only offers a restore the Section 9 machine allows. */
  contribution_state: string | null;
  reason: string;
  status: string;
  at: string;
};

export type QueueEntry = {
  id: string;
  title: string;
  state: ContributionRow["state"];
  offering_slug: string;
  topic: string;
  period: string;
  updated_at: string;
  tenant_name: string;
  author_name: string;
  author_email: string;
  unresolved_flags: number;
  open_reports: number;
};

const QUEUE_SQL = `SELECT c.id, c.title, c.state, c.offering_slug, c.topic, c.period, c.updated_at,
    t.name AS tenant_name, u.name AS author_name, u.email AS author_email,
    (SELECT COUNT(*) FROM contribution_flags f WHERE f.contribution_id = c.id AND f.resolved = 0) AS unresolved_flags
  FROM contributions c JOIN tenants t ON t.id = c.tenant_id JOIN users u ON u.id = c.author_id
  WHERE c.state IN ('Submitted','In review','Returned')
  ORDER BY c.updated_at ASC, c.id ASC`;

export function moderationQueue(): { submitted: QueueEntry[]; inReview: QueueEntry[]; returned: QueueEntry[] } {
  const rows = getDb().prepare(QUEUE_SQL).all() as Omit<QueueEntry, "open_reports">[];
  // Open reports are matched through the shared-view ids, because this module may not read
  // shared_views itself (Section 8).
  const reported = new Set(openReports().map((report) => report.shared_view_id));
  const entries: QueueEntry[] = rows.map((row) => ({
    ...row,
    open_reports: sharedViewIdsFor(row.id).filter((id) => reported.has(id)).length,
  }));

  return {
    submitted: entries.filter((row) => row.state === "Submitted"),
    inReview: entries.filter((row) => row.state === "In review"),
    returned: entries.filter((row) => row.state === "Returned"),
  };
}

export function flagsFor(contributionId: string): FlagRow[] {
  return getDb()
    .prepare("SELECT id, contribution_id, kind, snippet, resolved, resolved_by FROM contribution_flags WHERE contribution_id = ? ORDER BY kind, id")
    .all(contributionId) as FlagRow[];
}

export function decisionsFor(contributionId: string): DecisionRow[] {
  return getDb()
    .prepare("SELECT id, contribution_id, moderator_id, decision, reason, internal_note, at FROM moderation_decisions WHERE contribution_id = ? ORDER BY at DESC, rowid DESC")
    .all(contributionId) as DecisionRow[];
}

export function openReportCount(contributionId: string): number {
  return openReports().filter((report) => report.contribution_id === contributionId).length;
}

/** Newest first. A report is about a shared view, so it names the copy and who raised it. */
export function openReports(): ReportRow[] {
  const rows = getDb()
    .prepare(
      `SELECT r.id, r.shared_view_id, r.reporter_user_id, r.reason, r.status, r.at, u.email AS reporter_email
       FROM reports r JOIN users u ON u.id = r.reporter_user_id
       WHERE r.status = 'open' ORDER BY r.at DESC, r.rowid DESC`,
    )
    .all() as Omit<ReportRow, "contribution_id" | "shared_title">[];

  return rows.map((row) => {
    const record = sharedViewRecord(row.shared_view_id);
    const contribution = record ? getContribution(record.contribution_id) : null;
    return {
      ...row,
      contribution_id: record?.contribution_id ?? null,
      shared_title: record?.title ?? null,
      view_state: record?.state ?? null,
      contribution_state: contribution?.state ?? null,
    };
  });
}

/**
 * Section 7.3: the private source is readable only while the item is with the reviewer, or when an
 * open report makes it necessary. A Draft is never readable, even for a moderator.
 */
export function canReadModeratorSource(actor: Actor, row: ContributionRow): boolean {
  if (!actor) return false;
  if (!actor.isEmployee || !actor.platformPerms.has("learning.moderate")) return false;
  if (row.state === "Draft") return false;
  if (row.state === "Submitted" || row.state === "In review" || row.state === "Returned") return true;
  return openReportCount(row.id) > 0;
}

export type ReviewBundle = {
  row: ContributionRow;
  author: { name: string; email: string };
  sourceAllowed: boolean;
  flags: FlagRow[];
  unresolvedFlags: number;
  decisions: DecisionRow[];
  consents: ConsentRow[];
  /** The copy a client can currently see, if any. Read through visible.ts, never a direct select. */
  sharedView: SharedViewDTO | null;
  openReports: number;
  orgName: string;
};

/** Everything the review screen needs, or null when no such contribution exists. */
export function reviewBundle(actor: Actor, contributionId: string): ReviewBundle | null {
  const row = getContribution(contributionId);
  if (!row || !actor) return null;

  const flags = flagsFor(row.id);
  const liveId = sharedViewIdsFor(row.id)
    .map((id) => sharedViewRecord(id))
    .find((record) => record?.state === "live")?.id;

  const author = getDb()
    .prepare("SELECT name, email FROM users WHERE id = ?")
    .get(row.author_id) as { name: string; email: string } | undefined;

  return {
    row,
    author: author ?? { name: "Unknown author", email: row.author_id },
    sourceAllowed: canReadModeratorSource(actor, row),
    flags,
    unresolvedFlags: flags.filter((flag) => flag.resolved === 0).length,
    decisions: decisionsFor(row.id),
    consents: readConsents(row.id),
    sharedView: liveId ? visibleSharedViewById(actor, liveId) : null,
    openReports: openReportCount(row.id),
    orgName: organisationName(row.tenant_id),
  };
}

/** Read for the console's own display of the item under review, not for a shared payload. */
export function organisationName(tenantId: string): string {
  const row = getDb().prepare("SELECT name FROM tenants WHERE id = ?").get(tenantId) as { name: string } | undefined;
  return row ? row.name : "Unknown organisation";
}
