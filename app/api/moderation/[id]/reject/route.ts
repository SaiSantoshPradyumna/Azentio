import { NextResponse } from "next/server";
import { decisionReasonSchema, fieldErrors } from "@/lib/contribution-schema";
import { recordId } from "@/lib/contributions";
import { rejectContribution } from "@/lib/moderation-actions";
import { badRequest, failure, withAuth } from "@/lib/withAuth";

// Section 9: In review to Rejected, and Unpublished to Rejected. A reason is required either way.
export const POST = withAuth(async (req, { actor, params }) => {
  const parsed = decisionReasonSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("a reason is required", fieldErrors(parsed.error));

  const moved = rejectContribution(actor!, recordId(params), parsed.data.reason, parsed.data.internal_note ?? null);
  if (!moved.ok) return failure(moved.status, moved.reason);

  return NextResponse.json({
    item: { id: moved.row.id, state: moved.row.state },
    note: "Rejected with your reason recorded. Nothing of this item is shared.",
  });
}, { audience: "employee", action: "moderation.review" });
