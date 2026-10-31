import Link from "next/link";
import { notFound } from "next/navigation";
import { StateBadge } from "@/components/state-badge";
import { ReviewActions } from "@/components/review-actions";
import { ScannerFlags } from "@/components/scanner-flags";
import { CONFIDENCE_LABELS, EVIDENCE_LABELS, TYPE_LABELS } from "@/lib/contribution-schema";
import { authorize } from "@/lib/authorize";
import { currentActor } from "@/lib/portal";
import { reviewBundle } from "@/lib/moderation";

export const metadata = {
  title: "Moderator review",
  description: "The original text beside the de-identified draft, with scanner hints and decisions.",
};

export default function ModerateReviewPage({ params }: { params: { id: string } }) {
  const actor = currentActor();
  // A review screen is record-scoped: an account that cannot review answers as a missing page, so the
  // private submission is never serialised into the response body. The page guards itself, not only the
  // layout, and uses the same action the API uses so the two cannot drift apart.
  if (!actor || !authorize(actor, "moderation.review", { audience: "employee" }).allow) notFound();
  const bundle = reviewBundle(actor, params.id);
  if (!bundle) notFound();

  const { row } = bundle;

  return (
    <div className="space-y-2xl">
      <div className="space-y-md">
        <Link href="/moderate" className="text-sm text-accent hover:underline">
          Back to the queue
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-md">
          <h1 className="font-display text-2xl font-semibold">{row.title}</h1>
          <StateBadge
            state={row.state}
            detail={bundle.unresolvedFlags > 0 ? `${bundle.unresolvedFlags} scanner hint(s) unresolved` : "no open hints"}
          />
        </div>
        <p className="text-sm text-content-muted">
          {bundle.orgName} · author {bundle.author.name} ({bundle.author.email}) · version {row.version} · sharing{" "}
          {row.sharing_choice}
          {row.attribution_requested === 1 ? " · author asked for credit" : " · no credit requested"}
        </p>
      </div>

      <div className="grid gap-lg lg:grid-cols-2">
        <section className="card space-y-md border-line bg-surface-sunken" aria-labelledby="private-source">
          <h2 id="private-source" className="font-display text-lg font-semibold">
            <span aria-hidden="true">🔒</span> Original text — private
          </h2>
          {bundle.sourceAllowed ? (
            <>
              <p className="text-sm text-content-muted">
                You can see this because the item is with a reviewer or is the subject of an open report. A colleague in the
                author&rsquo;s own organisation cannot open this text, and it is never copied into a shared payload.
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{row.body}</p>
            </>
          ) : (
            <p className="text-sm text-content-muted" role="status">
              The private text stays closed. A moderator may open it only while the item is Submitted, In review or Returned,
              or when an open report names it — never while it is a draft.
            </p>
          )}
          <dl className="grid gap-md sm:grid-cols-2">
            <Meta term="Type" value={TYPE_LABELS[row.type as keyof typeof TYPE_LABELS] ?? row.type} />
            <Meta term="Topic" value={row.topic} mono />
            <Meta term="Offering" value={row.offering_slug} mono />
            <Meta term="Period" value={row.period} mono />
            <Meta term="Evidence" value={EVIDENCE_LABELS[row.evidence_type as keyof typeof EVIDENCE_LABELS] ?? row.evidence_type} />
            <Meta term="Confidence" value={CONFIDENCE_LABELS[row.confidence as keyof typeof CONFIDENCE_LABELS] ?? row.confidence} />
            <Meta term="Industry" value={row.industry} />
            <Meta term="Region (fine)" value={row.region} note="coarsened at publish time" />
          </dl>
        </section>

        <div className="space-y-lg">
          <ScannerFlags
            flags={bundle.flags.map((flag) => ({ id: flag.id, kind: flag.kind, snippet: flag.snippet, resolved: flag.resolved === 1 }))}
            reviewable={bundle.sourceAllowed}
          />

          <ReviewActions
            contributionId={row.id}
            state={row.state}
            unresolvedFlags={bundle.unresolvedFlags}
            attributionRequested={row.attribution_requested === 1}
            orgName={bundle.orgName}
            liveSummary={bundle.sharedView?.summary ?? null}
          />
        </div>
      </div>

      <section className="card space-y-md" aria-labelledby="shared-copy">
        <h2 id="shared-copy" className="font-display text-lg font-semibold">
          <span aria-hidden="true">🌐</span> What the community can see right now
        </h2>
        {bundle.sharedView ? (
          <div className="space-y-sm rounded-card border border-accent/50 bg-accent/5 p-md">
            <p className="badge">
              <span aria-hidden="true">🌐</span> Shared · de-identified and moderator-reviewed
            </p>
            <h3 className="font-display text-base font-semibold">{bundle.sharedView.title}</h3>
            <p className="text-sm leading-relaxed">{bundle.sharedView.summary}</p>
            <p className="font-mono text-xs text-content-muted">
              {bundle.sharedView.offering_slug} · {bundle.sharedView.topic} · {bundle.sharedView.industry} ·{" "}
              {bundle.sharedView.region_coarse} · {bundle.sharedView.period_quarter}
            </p>
            <p className="text-sm text-content-muted">
              {bundle.sharedView.attribution
                ? `Credited to: ${bundle.sharedView.attribution}`
                : "No credit shown. The author did not ask, or a moderator did not approve it."}
            </p>
          </div>
        ) : (
          <p className="text-sm text-content-muted" role="status">
            Nothing. This item has no live shared copy, so it appears in no feed, search or export result.
          </p>
        )}
      </section>

      <section className="card space-y-md" aria-labelledby="decision-history">
        <h2 id="decision-history" className="font-display text-lg font-semibold">
          Decisions on this item
        </h2>
        {bundle.decisions.length === 0 ? (
          <p className="text-sm text-content-muted" role="status">
            No decision recorded yet. Every moderator action writes one, with its reason.
          </p>
        ) : (
          <ol className="list-none space-y-md">
            {bundle.decisions.map((decision) => (
              <li key={decision.id} className="space-y-xs border-l-4 border-line pl-md">
                <p className="text-sm font-semibold">
                  {decision.decision} <span className="font-normal text-content-muted">· {decision.at}</span>
                </p>
                <p className="text-sm">{decision.reason}</p>
                {decision.internal_note ? (
                  <p className="text-xs text-content-muted">
                    <span className="font-semibold">Reviewer note (internal, never shared):</span> {decision.internal_note}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="card space-y-md" aria-labelledby="consent-record">
        <h2 id="consent-record" className="font-display text-lg font-semibold">
          Consents the author recorded
        </h2>
        <ul className="list-none space-y-sm text-sm">
          {bundle.consents.map((consent) => (
            <li key={consent.purpose} className="flex flex-wrap items-center gap-sm">
              <span className="font-mono">{consent.purpose}</span>
              <span className={consent.granted === 1 ? "text-content" : "text-content-muted"}>
                {consent.granted === 1 ? "granted" : "not granted"}
              </span>
              <span className="text-xs text-content-muted">
                policy {consent.policy_version} · {consent.at}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-content-muted">
          Training is never granted: no model training programme is enabled, whatever the stored rows say.
        </p>
      </section>

      {bundle.openReports > 0 ? (
        <p className="card border-warning/60 text-sm" role="status">
          {bundle.openReports} open report(s) name the shared copy of this item. An open report is one of the allowed reasons
          to unpublish.
        </p>
      ) : null}
    </div>
  );
}

function Meta({ term, value, mono, note }: { term: string; value: string; mono?: boolean; note?: string }) {
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
