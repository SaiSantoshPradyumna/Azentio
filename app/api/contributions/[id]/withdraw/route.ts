import { NextResponse } from "next/server";
import { contributionDTO, ownerAudienceOf, recordId } from "@/lib/contributions";
import { withdrawContribution } from "@/lib/withdraw";
import { failure, withAuth } from "@/lib/withAuth";

// Section 12: the withdrawal transaction plus the clock. The clock only exists when the item had a
// shared row to purge; a draft never reached anyone, and the response says so instead of inventing a
// timing result.
export const POST = withAuth((_req, { actor, params }) => {
  const withdrawn = withdrawContribution(actor!, recordId(params));
  if (!withdrawn.ok) return failure(withdrawn.status, withdrawn.reason);

  return NextResponse.json({
    item: contributionDTO(withdrawn.row, actor!.userId),
    clock: withdrawn.clock,
    notice: withdrawn.clock
      ? "Withdrawn. The shared summary and its evidence links were removed in the same transaction, and the visibility counter moved on."
      : "Withdrawn. A draft is visible only to you, so there is no shared copy to recall.",
  });
}, { audience: (_req, ctx) => ownerAudienceOf(ctx.params), action: "contribution.withdraw", record: true });
