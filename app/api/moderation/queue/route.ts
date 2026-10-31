import { NextResponse } from "next/server";
import { moderationQueue, openReports } from "@/lib/moderation";
import { withAuth } from "@/lib/withAuth";

// Section 17: GET /api/moderation/queue, audience employee plus moderation.review. The queue is
// deliberately cross-tenant — a moderator reviews every organisation — so it takes no tenant from the
// request and no tenant filter is applied.
export const GET = withAuth(() => {
  const queue = moderationQueue();
  return NextResponse.json({
    submitted: queue.submitted,
    in_review: queue.inReview,
    returned: queue.returned,
    open_reports: openReports().map((report) => ({
      id: report.id,
      shared_view_id: report.shared_view_id,
      contribution_id: report.contribution_id,
      shared_title: report.shared_title,
      reporter_email: report.reporter_email,
      reason: report.reason,
      at: report.at,
    })),
  });
}, { audience: "employee", action: "moderation.review" });
