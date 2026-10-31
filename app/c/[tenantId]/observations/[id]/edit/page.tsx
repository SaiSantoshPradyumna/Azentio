import Link from "next/link";
import { notFound } from "next/navigation";
import { ObservationForm } from "@/components/observation-form";
import {
  CONFIDENCE_LEVELS,
  CONTRIBUTION_TYPES,
  EVIDENCE_TYPES,
  type ConfidenceLevel,
  type ContributionType,
  type EvidenceType,
} from "@/lib/contribution-schema";
import { canReadContribution, entitledOfferings, getContribution } from "@/lib/contributions";
import { currentActor } from "@/lib/portal";

export const metadata = { title: "Edit observation", description: "Change the fields of a draft observation." };

/** Seed the form from the row; an unknown stored value falls back to the first allowed option. */
function pick<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export default function EditObservationPage({ params }: { params: { tenantId: string; id: string } }) {
  const actor = currentActor();
  if (!actor || actor.activeTenantId !== params.tenantId) notFound();

  const row = getContribution(params.id);
  if (!row || !canReadContribution(actor, row)) notFound();

  const tenantId = actor.activeTenantId;
  const basePath = `/c/${tenantId}`;
  const isAuthor = row.author_id === actor.userId;
  const editable = isAuthor && (row.state === "Draft" || row.state === "Returned");

  if (!editable) {
    return (
      <div className="card max-w-2xl" role="alert">
        <h1 className="font-display text-xl font-semibold">This observation cannot be edited here</h1>
        <p className="mt-sm text-sm text-content-muted">
          {isAuthor
            ? `Only a draft or an item a moderator returned can be edited. This one is ${row.state}.`
            : "Only its author can edit it."}
        </p>
        <p className="mt-md">
          <Link href={`${basePath}/observations/${row.id}`} className="btn-secondary">
            Back to the observation
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-xl">
      <div>
        <h1 className="font-display text-2xl font-semibold">Edit observation</h1>
        <p className="mt-xs text-sm text-content-muted">
          Saving changes the fields and the &ldquo;updated&rdquo; time. It does not change who can see the item, does not
          create a notification, and does not move it out of {row.state}.
        </p>
      </div>

      <ObservationForm
        mode="edit"
        contributionId={row.id}
        basePath={basePath}
        offerings={entitledOfferings(tenantId)}
        initial={{
          title: row.title,
          body: row.body,
          type: pick<ContributionType>(row.type, CONTRIBUTION_TYPES, "market_observation"),
          topic: row.topic,
          offering_slug: row.offering_slug,
          period: row.period,
          evidence_type: pick<EvidenceType>(row.evidence_type, EVIDENCE_TYPES, "anecdotal"),
          confidence: pick<ConfidenceLevel>(row.confidence, CONFIDENCE_LEVELS, "medium"),
          sharing_choice: row.sharing_choice,
          attribution_requested: row.attribution_requested === 1,
        }}
      />
    </div>
  );
}
