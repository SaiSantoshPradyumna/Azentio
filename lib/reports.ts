import { authorize, type Actor } from "./authorize";
import { audit } from "./audit";
import { getDb, nowIso, uuid } from "./db";
import { notify } from "./notify";
import { getContribution, type Author } from "./contributions";
import { openReportCount } from "./moderation";
import { sharedViewRecord, unpublishContribution } from "./publish";
import { restoreSharedView, suspendSharedView } from "./view-state";
import { visibleSharedViewById } from "./visible";

// Section 9 and Section 22's report flow. A report is raised by a reader of the shared feed, so it can
// only ever name a copy that reader can already see; the copy then leaves every read path at once
// (visible.ts filters on state = 'live') and the author is told. The moderator owns the decision:
// restore the copy, or keep it out and move the record to Unpublished through the Section 9 machine.

export type ReportResult =
  | { ok: true; reportId: string; suspended: boolean }
  | { ok: false; status: 403 | 404 | 409; reason: string };

export type ReportDecision = "restore" | "keep_out";

export type ResolveResult =
  | { ok: true; reportId: string; decision: ReportDecision; restored: boolean }
  | { ok: false; status: 403 | 404 | 409; reason: string };

function moderatorIds(): string[] {
  return (
    getDb()
      .prepare("SELECT user_id FROM platform_grants WHERE permission = 'learning.moderate'")
      .all() as { user_id: string }[]
  ).map((row) => row.user_id);
}

/**
 * Section 12's rule, applied to a report: the shared copy is taken out of the reads, the record itself
 * stays where the state machine put it, and the author is notified in the same transaction that stores
 * the report — so a report is never on file against an item that is still in the feed.
 */
export function reportSharedView(actor: Author, sharedViewId: string, reason: string): ReportResult {
  const visible = visibleSharedViewById(actor, sharedViewId);
  if (!visible) return { ok: false, status: 404, reason: "not found" };

  const record = sharedViewRecord(sharedViewId);
  if (!record || record.state !== "live") return { ok: false, status: 404, reason: "not found" };

  const contribution = getContribution(record.contribution_id);
  if (!contribution) return { ok: false, status: 404, reason: "not found" };

  const stamp = Date.now();
  const reportId = uuid();
  let suspended = false;

  const write = getDb().transaction(() => {
    getDb()
      .prepare("INSERT INTO reports (id, shared_view_id, reporter_user_id, reason, status, at) VALUES (?, ?, ?, ?, 'open', ?)")
      .run(reportId, sharedViewId, actor.userId, reason, nowIso());
    suspended = suspendSharedView(sharedViewId);

    notify(
      contribution.author_id,
      "report.suspension",
      `Your published observation "${contribution.title}" is hidden from shared learning while a report is open. A moderator decides whether to restore it or take it down.`,
      `report-suspend-${sharedViewId}-${stamp}`,
    );
    for (const moderatorId of moderatorIds()) {
      notify(
        moderatorId,
        "moderation.report",
        `A shared item "${visible.title}" was reported and is suspended: ${reason}`,
        `report-${reportId}-${moderatorId}`,
      );
    }
  });
  write();

  // Audit names the copy, never the reporter's organisation: a report is community-audience content.
  audit(actor, "shared.report", "community", "allow", `reported ${sharedViewId} of contribution ${record.contribution_id}, copy suspended=${suspended}`);
  return { ok: true, reportId, suspended };
}

/** Open reports still naming one shared copy, after a given report has been set aside. */
function otherOpenReports(sharedViewId: string, exceptReportId: string): number {
  return (
    getDb()
      .prepare("SELECT COUNT(*) AS n FROM reports WHERE shared_view_id = ? AND status = 'open' AND id <> ?")
      .get(sharedViewId, exceptReportId) as { n: number }
  ).n;
}

function setStatus(reportId: string, status: string): void {
  getDb().prepare("UPDATE reports SET status = ? WHERE id = ?").run(status, reportId);
}

/**
 * The moderator's decision on one open report. `restore` puts the same copy back — only if the record
 * is still Published and no other report names it; `keep_out` runs the Published to Unpublished move,
 * which records the decision and notifies the author through the Section 9 path.
 */
export function resolveReport(actor: Author, reportId: string, decision: ReportDecision, note: string): ResolveResult {
  const permission = authorize(actor, "moderation.review", { audience: "employee" });
  if (!permission.allow) return { ok: false, status: 403, reason: permission.reason };

  const report = getDb()
    .prepare("SELECT id, shared_view_id, reporter_user_id, reason, status, at FROM reports WHERE id = ?")
    .get(reportId) as { id: string; shared_view_id: string; reporter_user_id: string; reason: string; status: string; at: string } | undefined;
  if (!report) return { ok: false, status: 404, reason: "not found" };
  if (report.status !== "open") return { ok: false, status: 409, reason: `this report is already ${report.status}` };

  const record = sharedViewRecord(report.shared_view_id);
  if (!record) return { ok: false, status: 404, reason: "not found" };
  const contribution = getContribution(record.contribution_id);
  if (!contribution) return { ok: false, status: 404, reason: "not found" };

  if (decision === "keep_out") {
    setStatus(report.id, "closed");
    if (contribution.state === "Published") {
      const unpublished = unpublishContribution(actor, contribution.id, `A report on the shared copy was upheld: ${report.reason}`, note || null);
      if (!unpublished.ok) return { ok: false, status: unpublished.status, reason: unpublished.reason };
    }
    notify(report.reporter_user_id, "report.decision", `Your report on "${record.title}" was upheld: the item stays out of shared learning.`, `report-decision-${report.id}`);
    audit(actor, "moderation.review", "community", "allow", `report ${report.id} upheld, item ${contribution.id} kept out`);
    return { ok: true, reportId: report.id, decision, restored: false };
  }

  if (contribution.state !== "Published") {
    return {
      ok: false,
      status: 409,
      reason: `the item is ${contribution.state}; publishing it again is the moderator move that would bring the copy back`,
    };
  }

  // Nothing is written until the restore is actually possible: a report stays open if another report
  // still names the same copy, so the suspended state never ends with an unreported-but-hidden item.
  const remaining = otherOpenReports(report.shared_view_id, report.id);
  if (remaining > 0) {
    return {
      ok: false,
      status: 409,
      reason: `${remaining} other report(s) still name this copy; it stays suspended until none remain`,
    };
  }

  setStatus(report.id, "resolved");
  const restored = restoreSharedView(report.shared_view_id);
  notify(
    report.reporter_user_id,
    "report.decision",
    `A moderator closed your report on "${record.title}" and put the item back in shared learning.`,
    `report-decision-${report.id}`,
  );
  notify(
    contribution.author_id,
    "report.decision",
    `The report on your published observation "${contribution.title}" was closed and the shared copy is back.`,
    `report-author-${report.id}`,
  );

  audit(actor, "moderation.review", "community", "allow", `report ${report.id} resolved, copy ${report.shared_view_id} live=${restored}`);
  return { ok: true, reportId: report.id, decision, restored };
}

/** True when an item already carries an open report — the guard the unpublish reason cites. */
export function hasOpenReport(contributionId: string): boolean {
  return openReportCount(contributionId) > 0;
}
