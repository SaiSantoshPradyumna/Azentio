import { NextResponse } from "next/server";
import { recordId } from "@/lib/contributions";
import { fieldErrors, ideaUpdateSchema } from "@/lib/idea-schema";
import { getIdea } from "@/lib/ideas";
import { proposePublicUpdate } from "@/lib/idea-updates";
import { badRequest, failure, withAuth } from "@/lib/withAuth";

// Section 14: the client-facing text is written by a product owner and stays out of every client read
// until a moderator's account stands behind it. This endpoint only writes the text; the approval is a
// separate move under moderation.review.
const OPTIONS = {
  audience: (_req: unknown, ctx: { params: Record<string, string | string[]> }) => (getIdea(recordId(ctx.params)) ? "employee" : null),
  action: "idea.public_update",
  record: true,
} as const;

export const POST = withAuth(async (req, { actor, params }) => {
  const parsed = ideaUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("the client update needs at least 20 characters", fieldErrors(parsed.error));

  const result = proposePublicUpdate(actor!, recordId(params), parsed.data.text);
  if (!result.ok) return failure(result.status, result.reason);

  return NextResponse.json({
    item: result.update,
    approved: result.approved,
    note: result.approved
      ? "Stored. The account writing this holds the moderation grant, so the text is client-visible now."
      : "Stored and held back. Every moderator account was notified; the text reaches client pages only after a moderator approves it.",
  });
}, OPTIONS);
