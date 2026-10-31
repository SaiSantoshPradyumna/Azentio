import { NextResponse } from "next/server";
import { contributionEditSchema, fieldErrors } from "@/lib/contribution-schema";
import { readConsents } from "@/lib/consents";
import { canReadContribution, contributionDTO, getContribution, ownerAudienceOf, recordId } from "@/lib/contributions";
import { editContribution } from "@/lib/contribution-writes";
import { badRequest, failure, notFound, withAuth } from "@/lib/withAuth";

// Section 17: GET/PATCH /api/contributions/[id] with audience tenant:<owner> taken from the record.
export const GET = withAuth((_req, { actor, params }) => {
  const row = getContribution(recordId(params))!;
  if (!canReadContribution(actor!, row)) return notFound();

  return NextResponse.json({
    item: contributionDTO(row, actor!.userId),
    consents: readConsents(row.id),
    editable: actor!.userId === row.author_id && (row.state === "Draft" || row.state === "Returned"),
  });
}, { audience: (_req, ctx) => ownerAudienceOf(ctx.params), action: "read.contribution", record: true });

export const PATCH = withAuth(async (req, { actor, params }) => {
  const parsed = contributionEditSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("invalid contribution", fieldErrors(parsed.error));

  const edited = editContribution(actor!, recordId(params), parsed.data);
  if (!edited.ok) return failure(edited.status, edited.reason);

  return NextResponse.json({ item: contributionDTO(edited.row, actor!.userId) });
}, { audience: (_req, ctx) => ownerAudienceOf(ctx.params), action: "contribution.edit", record: true });
