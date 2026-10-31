import { NextResponse } from "next/server";
import { contributionSubmitSchema, fieldErrors } from "@/lib/contribution-schema";
import { contributionDTO, ownerAudienceOf, recordId } from "@/lib/contributions";
import { submitContribution } from "@/lib/contribution-writes";
import { badRequest, failure, withAuth } from "@/lib/withAuth";

// Section 9: Draft or Returned to Submitted. The consents named here are the ones Section 11 records.
export const POST = withAuth(async (req, { actor, params }) => {
  const parsed = contributionSubmitSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("invalid sharing choice", fieldErrors(parsed.error));

  const submitted = submitContribution(actor!, recordId(params), parsed.data);
  if (!submitted.ok) return failure(submitted.status, submitted.reason);

  return NextResponse.json({ item: contributionDTO(submitted.row, actor!.userId) });
}, { audience: (_req, ctx) => ownerAudienceOf(ctx.params), action: "contribution.submit", record: true });
