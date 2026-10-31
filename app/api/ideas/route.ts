import { NextResponse } from "next/server";
import { fieldErrors, ideaCreateSchema } from "@/lib/idea-schema";
import { ideaCounters, listIdeas } from "@/lib/ideas";
import { createIdea } from "@/lib/idea-writes";
import { badRequest, failure, withAuth } from "@/lib/withAuth";

// Section 17: the idea workspace is employee-audience and the action is idea.write, which the policy
// engine maps to the product.owner grant. So the internal fields — priority, the raw status, the
// history reasons — are only ever returned here, never from /api/client/ideas.

const OPTIONS = { audience: "employee", action: "idea.write" } as const;

export const GET = withAuth((req) => {
  const params = req.nextUrl.searchParams;
  const items = listIdeas({ offering: params.get("offering") ?? undefined, status: params.get("status") ?? undefined });

  return NextResponse.json({
    items: items.map((idea) => ({ ...idea, ...ideaCounters(idea.id) })),
    count: items.length,
    notice: "Internal view. Priority and status history reasons are never shown to a client.",
  });
}, OPTIONS);

export const POST = withAuth(async (req, { actor }) => {
  const parsed = ideaCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("the idea needs a title, problem, outcome, team, offering and priority", fieldErrors(parsed.error));

  const result = createIdea(actor!, parsed.data);
  if (!result.ok) return failure(result.status, result.reason);

  return NextResponse.json({
    item: { ...result.idea, ...ideaCounters(result.idea.id) },
    notice: "Idea opened as Proposed. Attach evidence from the shared feed and move the status when the team decides.",
  });
}, OPTIONS);
