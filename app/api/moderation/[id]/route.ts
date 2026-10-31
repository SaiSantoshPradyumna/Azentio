import { NextResponse } from "next/server";
import { reviewBundle } from "@/lib/moderation";
import { recordId } from "@/lib/contributions";
import { notFound, withAuth } from "@/lib/withAuth";

// Section 7.3: a moderator may read the private source only while the item is Submitted, In review or
// Returned, or when an open report names it — never a Draft. That rule decides whether `body` appears
// in this response; everything else on the screen is review metadata.
// `internal_note` is left out of the API response on purpose: it lives in moderation_decisions and is
// rendered server-side on the console, so it never travels through a JSON payload.
export const GET = withAuth((_req, { actor, params }) => {
  const bundle = reviewBundle(actor, recordId(params));
  if (!bundle) return notFound();

  return NextResponse.json({
    item: {
      id: bundle.row.id,
      title: bundle.row.title,
      type: bundle.row.type,
      topic: bundle.row.topic,
      offering_slug: bundle.row.offering_slug,
      industry: bundle.row.industry,
      region: bundle.row.region,
      period: bundle.row.period,
      evidence_type: bundle.row.evidence_type,
      confidence: bundle.row.confidence,
      sharing_choice: bundle.row.sharing_choice,
      attribution_requested: bundle.row.attribution_requested === 1,
      state: bundle.row.state,
      version: bundle.row.version,
      created_at: bundle.row.created_at,
      updated_at: bundle.row.updated_at,
      body: bundle.sourceAllowed ? bundle.row.body : null,
    },
    organisation: bundle.orgName,
    flags: bundle.flags.map((flag) => ({ id: flag.id, kind: flag.kind, snippet: flag.snippet, resolved: flag.resolved === 1 })),
    unresolved_flags: bundle.unresolvedFlags,
    decisions: bundle.decisions.map((decision) => ({
      id: decision.id,
      decision: decision.decision,
      reason: decision.reason,
      at: decision.at,
    })),
    consents: bundle.consents.map((consent) => ({
      purpose: consent.purpose,
      granted: consent.granted === 1,
      policy_version: consent.policy_version,
      at: consent.at,
    })),
    shared_view: bundle.sharedView,
    open_reports: bundle.openReports,
  });
}, { audience: "employee", action: "moderation.review" });
