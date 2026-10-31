import { NextResponse } from "next/server";
import { recordId } from "@/lib/contributions";
import { getIdea } from "@/lib/ideas";
import { ideaStatusSchema, fieldErrors } from "@/lib/idea-schema";
import { moveIdeaStatus } from "@/lib/idea-writes";
import { badRequest, failure, withAuth } from "@/lib/withAuth";

// Section 14: the only way an idea changes status. The edge must exist in lib/idea-lifecycle.ts, the
// reason is required, and an illegal move answers 409 — the same shape as the contribution lifecycle.
const OPTIONS = {
  audience: (_req: unknown, ctx: { params: Record<string, string | string[]> }) => (getIdea(recordId(ctx.params)) ? "employee" : null),
  action: "idea.write",
  record: true,
} as const;

export const PATCH = withAuth(async (req, { actor, params }) => {
  const parsed = ideaStatusSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("a status and a reason are required", fieldErrors(parsed.error));

  const result = moveIdeaStatus(actor!, recordId(params), parsed.data.status, parsed.data.reason);
  if (!result.ok) return failure(result.status, result.reason);

  return NextResponse.json({
    item: { id: result.idea.id, status: result.idea.status },
    note: "Status moved. The reason is in the internal history and the audit; it is never shown on a client page.",
  });
}, OPTIONS);
