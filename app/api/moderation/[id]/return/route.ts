import { NextResponse } from "next/server";
import { decisionReasonSchema, fieldErrors } from "@/lib/contribution-schema";
import { recordId } from "@/lib/contributions";
import { returnToAuthor } from "@/lib/moderation-actions";
import { badRequest, failure, withAuth } from "@/lib/withAuth";

// Section 9: In review to Returned. The guard is "reason required", and the reason is what the author sees.
export const POST = withAuth(async (req, { actor, params }) => {
  const parsed = decisionReasonSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("a reason is required", fieldErrors(parsed.error));

  const moved = returnToAuthor(actor!, recordId(params), parsed.data.reason, parsed.data.internal_note ?? null);
  if (!moved.ok) return failure(moved.status, moved.reason);

  return NextResponse.json({
    item: { id: moved.row.id, state: moved.row.state },
    note: "Returned to the author with your reason. The author gets an in-app notification.",
  });
}, { audience: "employee", action: "moderation.review" });
