import { NextResponse } from "next/server";
import { fieldErrors, reportSchema } from "@/lib/contribution-schema";
import { openReports } from "@/lib/moderation";
import { reportSharedView } from "@/lib/reports";
import { badRequest, failure, withAuth } from "@/lib/withAuth";

// Section 17: POST /api/reports (community) reports one shared copy. The reporter can only name a copy
// they can actually see, and the report opens against that shared view id.
export const POST = withAuth(async (req, { actor }) => {
  const parsed = reportSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("the shared item and a reason are required", fieldErrors(parsed.error));

  const result = reportSharedView(actor!, parsed.data.shared_view_id, parsed.data.reason);
  if (!result.ok) return failure(result.status, result.reason);

  return NextResponse.json({
    report_id: result.reportId,
    suspended: result.suspended,
    notice: result.suspended
      ? "Your report is stored and the shared copy is suspended now, so it is out of the feed, search and export. The author is notified. Nothing has been emailed, and a moderator decides whether to restore the copy or keep the item out."
      : "Your report is stored. This copy was already out of the feed, so nothing changed for readers; a moderator will decide from here.",
  });
}, { audience: "community", action: "shared.report" });

// GET is the moderator view of the same table: moderation.review needs the learning.moderate grant, so
// a reporter never sees who else reported what.
export const GET = withAuth(() => {
  return NextResponse.json({
    items: openReports().map((report) => ({
      id: report.id,
      shared_view_id: report.shared_view_id,
      contribution_id: report.contribution_id,
      shared_title: report.shared_title,
      view_state: report.view_state,
      contribution_state: report.contribution_state,
      reporter_email: report.reporter_email,
      reason: report.reason,
      status: report.status,
      at: report.at,
    })),
  });
}, { audience: "community", action: "moderation.review" });
