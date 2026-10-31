import { NextResponse } from "next/server";
import { decisionReasonSchema, fieldErrors } from "@/lib/contribution-schema";
import { getContribution, recordId } from "@/lib/contributions";
import { unpublishContribution } from "@/lib/publish";
import { badRequest, failure, notFound, withAuth } from "@/lib/withAuth";

// Section 9: Published to Unpublished. The shared copy stops appearing in every read path at once,
// because the feed, search and export all select live rows only.
export const POST = withAuth(async (req, { actor, params }) => {
  const parsed = decisionReasonSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("a reason is required", fieldErrors(parsed.error));

  const existing = getContribution(recordId(params));
  if (!existing) return notFound();

  const moved = unpublishContribution(actor!, existing.id, parsed.data.reason, parsed.data.internal_note ?? null);
  if (!moved.ok) return failure(moved.status, moved.reason);

  return NextResponse.json({
    item: { id: moved.row.id, state: moved.row.state },
    note: "Unpublished. The shared copy is suspended, so no feed, search or export result contains it.",
  });
}, { audience: "employee", action: "moderation.unpublish" });
