import { NextResponse } from "next/server";
import { recordId } from "@/lib/contributions";
import { startReview } from "@/lib/moderation-actions";
import { failure, withAuth } from "@/lib/withAuth";

// Section 9: Submitted to In review. No body is read, so nothing about the item comes from the request.
export const POST = withAuth((_req, { actor, params }) => {
  const moved = startReview(actor!, recordId(params));
  if (!moved.ok) return failure(moved.status, moved.reason);

  return NextResponse.json({ item: { id: moved.row.id, state: moved.row.state }, note: "The item is marked as in review with you." });
}, { audience: "employee", action: "moderation.review" });
