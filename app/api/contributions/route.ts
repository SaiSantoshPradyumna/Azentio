import { NextResponse } from "next/server";
import { contributionDraftSchema, fieldErrors } from "@/lib/contribution-schema";
import { contributionDTO, listContributions } from "@/lib/contributions";
import { createDraft } from "@/lib/contribution-writes";
import { badRequest, failure, withAuth, type AudienceContext } from "@/lib/withAuth";

// Section 17: audience tenant:<active>, taken from the session, never from the request (7.5). An
// actor with no active organisation gets an invalid audience, which the policy engine denies.
function tenantAudience(_req: Request, ctx: AudienceContext): string {
  return ctx.actor?.activeTenantId ? `tenant:${ctx.actor.activeTenantId}` : "";
}

export const GET = withAuth((req, { actor }) => {
  const tab = req.nextUrl.searchParams.get("tab") === "org" ? "org" : "mine";
  const items = listContributions(actor!, tab).map((row) => contributionDTO(row, actor!.userId));
  return NextResponse.json({ tab, items });
}, { audience: tenantAudience, action: "read.contributions" });

export const POST = withAuth(async (req, { actor }) => {
  const parsed = contributionDraftSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("invalid contribution", fieldErrors(parsed.error));

  const created = createDraft(actor!, parsed.data);
  if (!created.ok) return failure(created.status, created.reason);

  return NextResponse.json({ item: contributionDTO(created.row, actor!.userId) }, { status: 201 });
}, { audience: tenantAudience, action: "contribution.create" });
