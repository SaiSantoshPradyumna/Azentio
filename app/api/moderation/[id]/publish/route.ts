import { NextResponse } from "next/server";
import { fieldErrors, publishInputSchema } from "@/lib/contribution-schema";
import { getContribution, recordId } from "@/lib/contributions";
import { organisationName } from "@/lib/moderation";
import { publishContribution } from "@/lib/publish";
import { badRequest, failure, notFound, withAuth } from "@/lib/withAuth";

// Section 10.3: the shared copy is built from the moderator's summary and the record's own metadata,
// never from this request. Region and period are coarsened inside buildSharedView.
export const POST = withAuth(async (req, { actor, params }) => {
  const parsed = publishInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("a de-identified summary is required", fieldErrors(parsed.error));

  const existing = getContribution(recordId(params));
  if (!existing) return notFound();

  const published = publishContribution(actor!, existing.id, {
    summary: parsed.data.summary,
    attributionApproved: parsed.data.attribution_approved,
    attributionText: parsed.data.attribution_text,
    internalNote: parsed.data.internal_note ?? null,
    orgName: organisationName(existing.tenant_id),
  });
  if (!published.ok) return failure(published.status, published.reason);

  return NextResponse.json({
    item: { id: published.row.id, state: published.row.state, version: published.row.version },
    note: "Published. The shared copy is the summary you wrote; the original text stays private.",
  });
}, { audience: "employee", action: "moderation.publish" });
