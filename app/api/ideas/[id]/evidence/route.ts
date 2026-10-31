import { NextResponse } from "next/server";
import { recordId } from "@/lib/contributions";
import { fieldErrors, ideaEvidenceSchema } from "@/lib/idea-schema";
import { getIdea } from "@/lib/ideas";
import { grantEvidence, revokeEvidence } from "@/lib/idea-writes";
import { badRequest, failure, withAuth } from "@/lib/withAuth";

// Section 14: evidence reaches an idea only through idea_evidence_grants, and the shared view named
// must be one the caller can read through lib/visible.ts. A copy that is suspended or gone cannot be
// attached, so a grant names only material the product owner is allowed to see.
const OPTIONS = {
  audience: (_req: unknown, ctx: { params: Record<string, string | string[]> }) => (getIdea(recordId(ctx.params)) ? "employee" : null),
  action: "idea.write",
  record: true,
} as const;

export const POST = withAuth(async (req, { actor, params }) => {
  const parsed = ideaEvidenceSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("name the shared item to attach", fieldErrors(parsed.error));

  const result = grantEvidence(actor!, recordId(params), parsed.data.shared_view_id);
  if (!result.ok) return failure(result.status, result.reason);

  return NextResponse.json({
    idea_id: result.ideaId,
    shared_view_id: result.sharedViewId,
    already_granted: !result.granted,
    note: result.granted
      ? "Attached. The idea can read this shared view and nothing else."
      : "This shared view was already attached to the idea.",
  });
}, OPTIONS);

export const DELETE = withAuth(async (req, { actor, params }) => {
  const parsed = ideaEvidenceSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("name the shared item to detach", fieldErrors(parsed.error));

  const result = revokeEvidence(actor!, recordId(params), parsed.data.shared_view_id);
  if (!result.ok) return failure(result.status, result.reason);

  return NextResponse.json({
    idea_id: result.ideaId,
    shared_view_id: result.sharedViewId,
    note: "Detached. The idea no longer reads that shared view.",
  });
}, OPTIONS);
