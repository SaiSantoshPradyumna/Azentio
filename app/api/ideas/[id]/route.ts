import { NextResponse } from "next/server";
import { fieldErrors, ideaEditSchema } from "@/lib/idea-schema";
import { recordId } from "@/lib/contributions";
import { editIdea } from "@/lib/idea-writes";
import {
  evidenceGrantIds,
  getIdea,
  grantableViews,
  ideaCounters,
  ideaEvidence,
  ideaHistory,
  ideaUpdates,
  themeTitle,
  unavailableGrants,
} from "@/lib/ideas";
import { isIdeaStatus, nextIdeaStatuses, type IdeaStatus } from "@/lib/idea-lifecycle";
import { badRequest, failure, withAuth } from "@/lib/withAuth";

// One idea, internal view. The audience comes from the database row, so an idea id that is not there
// answers 404 (Section 7.4); the employee audience plus idea.write keeps the internal fields away from
// anyone without the product.owner grant.

const OPTIONS = {
  audience: (_req: unknown, ctx: { params: Record<string, string | string[]> }) => (getIdea(recordId(ctx.params)) ? "employee" : null),
  action: "idea.write",
  record: true,
} as const;

export const GET = withAuth((req, { actor, params }) => {
  const idea = getIdea(recordId(params))!;
  const evidence = ideaEvidence(actor, idea.id);
  const status = isIdeaStatus(idea.status) ? idea.status : null;

  return NextResponse.json({
    item: {
      ...idea,
      ...ideaCounters(idea.id),
      theme_title: themeTitle(idea.theme_id),
      evidence_ids: evidenceGrantIds(idea.id),
    },
    evidence,
    unavailable_grants: unavailableGrants(idea.id, evidence.map((row) => row.id)),
    grantable: grantableViews(actor, idea.id).map((row) => ({ id: row.id, title: row.title })),
    history: ideaHistory(idea.id),
    updates: ideaUpdates(idea.id),
    next_statuses: status ? nextIdeaStatuses(status as IdeaStatus) : [],
    notice: "Evidence is exactly what this idea was granted, read through the shared-content reader.",
  });
}, OPTIONS);

export const PATCH = withAuth(async (req, { actor, params }) => {
  const parsed = ideaEditSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("nothing to change, or the fields are invalid", fieldErrors(parsed.error));

  const result = editIdea(actor!, recordId(params), parsed.data);
  if (!result.ok) return failure(result.status, result.reason);

  return NextResponse.json({
    item: result.idea,
    notice: "Idea fields updated. A status move goes to PATCH /api/ideas/<id>/status, where the reason is recorded.",
  });
}, OPTIONS);
