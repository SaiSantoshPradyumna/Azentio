import { NextResponse } from "next/server";
import { recordId } from "@/lib/contributions";
import { fieldErrors, ideaUpdateApprovalSchema } from "@/lib/idea-schema";
import { getIdea } from "@/lib/ideas";
import { approvePublicUpdate } from "@/lib/idea-updates";
import { badRequest, failure, withAuth } from "@/lib/withAuth";

// The moderator's half of Section 14. idea_public_updates has no pending flag, so approval is the
// approved_by column naming an account that holds learning.moderate; this endpoint is the only move
// that re-points it, and it answers to moderation.review rather than idea.public_update.
const OPTIONS = {
  audience: (_req: unknown, ctx: { params: Record<string, string | string[]> }) => (getIdea(recordId(ctx.params)) ? "employee" : null),
  action: "moderation.review",
  record: true,
} as const;

export const POST = withAuth(async (req, { actor, params }) => {
  const parsed = ideaUpdateApprovalSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("name the update you are approving", fieldErrors(parsed.error));

  const result = approvePublicUpdate(actor!, recordId(params), parsed.data.update_id);
  if (!result.ok) return failure(result.status, result.reason);

  return NextResponse.json({
    item: result.update,
    approved: true,
    note: "Approved. The text is client-visible now, and the idea's author was notified.",
  });
}, OPTIONS);
