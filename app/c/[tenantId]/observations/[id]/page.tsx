import Link from "next/link";
import { notFound } from "next/navigation";
import { ObservationActions } from "@/components/observation-actions";
import { StateBadge } from "@/components/state-badge";
import { VisibilityInspector } from "@/components/visibility-inspector";
import { readConsents } from "@/lib/consents";
import { EVIDENCE_LABELS, TYPE_LABELS, CONFIDENCE_LABELS } from "@/lib/contribution-schema";
import { canReadContribution, getContribution, isOrgAdmin } from "@/lib/contributions";
import { currentActor } from "@/lib/portal";

export const metadata = { title: "Observation", description: "One observation and its visibility record." };

export default function ObservationDetailPage({ params }: { params: { tenantId: string; id: string } }) {
  const actor = currentActor();
  if (!actor || actor.activeTenantId !== params.tenantId) notFound();

  const row = getContribution(params.id);
  // A record outside the active organisation, or a colleague's private draft, answers exactly like a
  // missing page so existence never leaks.
  if (!row || !canReadContribution(actor, row)) notFound();

  const isAuthor = row.author_id === actor.userId;
  const basePath = `/c/${actor.activeTenantId}`;
  return (
    <div className="space-y-2xl">
      <div className="space-y-md">
        <Link href={`${basePath}/observations`} className="text-sm text-accent hover:underline">
          Back to observations
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-md">
          <h1 className="font-display text-2xl font-semibold">{row.title}</h1>
          <StateBadge state={row.state} detail={isAuthor ? "yours" : "colleague"} />
        </div>
        <p className="text-sm text-content-muted">
          Version {row.version} · created {row.created_at} · updated {row.updated_at}
        </p>
      </div>

      <section className="card max-w-2xl space-y-md" aria-labelledby="observation-detail">
        <h2 id="observation-detail" className="font-display text-lg font-semibold">
          What was recorded
        </h2>
        <dl className="grid gap-md sm:grid-cols-2">
          <Detail
            term="Type"
            value={TYPE_LABELS[row.type as keyof typeof TYPE_LABELS] ?? row.type}
          />
          <Detail term="Topic" value={row.topic} mono />
          <Detail term="Offering" value={row.offering_slug} mono />
          <Detail term="Period observed" value={row.period} mono />
          <Detail term="Evidence" value={EVIDENCE_LABELS[row.evidence_type as keyof typeof EVIDENCE_LABELS] ?? row.evidence_type} />
          <Detail term="Confidence" value={CONFIDENCE_LABELS[row.confidence as keyof typeof CONFIDENCE_LABELS] ?? row.confidence} />
          <Detail term="Industry" value={row.industry} note="taken from the organisation record" />
          <Detail term="Region" value={row.region} note="taken from the organisation record" />
        </dl>

        <div>
          <h3 className="text-sm font-semibold">Text</h3>
          {isAuthor ? (
            <p className="mt-xs whitespace-pre-wrap text-sm">{row.body}</p>
          ) : (
            <p className="mt-xs text-sm text-content-muted" role="status">
              The full text belongs to its author. Colleagues opening this record see its fields and its state, not the
              private draft — that is the author&rsquo;s own text, and a de-identified summary only exists after a
              moderator publishes it.
            </p>
          )}
        </div>
      </section>

      <VisibilityInspector row={row} consents={readConsents(row.id)} />

      <ObservationActions
        contributionId={row.id}
        basePath={basePath}
        state={row.state}
        sharingChoice={row.sharing_choice}
        attributionRequested={row.attribution_requested === 1}
        isAuthor={isAuthor}
        isOrgAdmin={isOrgAdmin(actor)}
      />
    </div>
  );
}

function Detail({ term, value, mono, note }: { term: string; value: string; mono?: boolean; note?: string }) {
  return (
    <div>
      <dt className="text-xs text-content-muted">{term}</dt>
      <dd className={`text-sm ${mono ? "font-mono" : ""}`}>
        {value}
        {note ? <span className="ml-xs text-xs text-content-muted">({note})</span> : null}
      </dd>
    </div>
  );
}
