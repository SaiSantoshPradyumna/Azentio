import { NextResponse } from "next/server";
import { recordId } from "@/lib/contributions";
import { fieldErrors, reportResolveSchema } from "@/lib/contribution-schema";
import { resolveReport } from "@/lib/reports";
import { badRequest, failure, withAuth } from "@/lib/withAuth";

// Section 22's report decision. `restore` puts the same copy back into the reads; `keep_out` runs the
// Published to Unpublished move. Both need learning.moderate, and a report that is no longer open
// answers 409 rather than silently resolving twice.
export const POST = withAuth(async (req, { actor, params }) => {
  const parsed = reportResolveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("choose restore or keep_out", fieldErrors(parsed.error));

  const result = resolveReport(actor!, recordId(params), parsed.data.decision, parsed.data.note ?? "");
  if (!result.ok) return failure(result.status, result.reason);

  return NextResponse.json({
    report_id: result.reportId,
    decision: result.decision,
    restored: result.restored,
    note:
      result.decision === "restore"
        ? "Report resolved. The shared copy is back in the feed, search and export, and both the reporter and the author were notified."
        : "Report upheld. The item is Unpublished, the report is closed, and the reporter was notified.",
  });
}, { audience: "employee", action: "moderation.review" });
