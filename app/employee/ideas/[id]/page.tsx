import Link from "next/link";
import { notFound } from "next/navigation";
import { IdeaWorkspace } from "@/components/idea-workspace";
import { authorize } from "@/lib/authorize";
import { isIdeaStatus, nextIdeaStatuses, type IdeaStatus } from "@/lib/idea-lifecycle";
import {
  getIdea,
  grantableViews,
  ideaCounters,
  ideaEvidence,
  ideaHistory,
  ideaUpdates,
  themeTitle,
  unavailableGrants,
} from "@/lib/ideas";
import { currentActor } from "@/lib/portal";

export const metadata = {
  title: "Idea workspace",
  description: "Status moves, evidence grants and the client-facing update for one improvement idea.",
};

// One idea, internal view. Evidence comes from ideaEvidence(), which maps the grant rows through
// lib/visible.ts, so a product owner reads exactly what this idea was granted — and a copy a report
// suspended disappears from this screen as it does from the feed.
export default function EmployeeIdeaDetailPage({ params }: { params: { id: string } }) {
  const actor = currentActor();
  if (!actor || !authorize(actor, "idea.write", { audience: "employee" }).allow) return null;

  const idea = getIdea(params.id);
  if (!idea) notFound();

  const status = isIdeaStatus(idea.status) ? (idea.status as IdeaStatus) : null;
  const evidence = ideaEvidence(actor, idea.id);
  const counters = ideaCounters(idea.id);
  const history = ideaHistory(idea.id);
  const updates = ideaUpdates(idea.id);
  const offList = unavailableGrants(idea.id, evidence.map((item) => item.id));

  return (
    <div className="space-y-2xl">
      <section className="space-y-md">
        <Link href="/employee/ideas" className="text-sm text-accent hover:underline">
          All ideas
        </Link>
        <h1 className="font-display text-2xl font-semibold">{idea.title}</h1>
        <p className="badge" data-testid="idea-status">
          {idea.status} · {counters.grants} evidence · {counters.updates} update(s)
          {counters.pending > 0 ? ` · ${counters.pending} awaiting approval` : ""}
        </p>
      </section>

      <section className="card space-y-md" aria-labelledby="idea-internal">
        <h2 id="idea-internal" className="font-display text-lg font-semibold">
          Internal record
        </h2>
        <dl className="grid gap-md sm:grid-cols-2">
          <div>
            <dt className="text-sm text-content-muted">Offering</dt>
            <dd className="mt-xs font-mono text-sm">{idea.offering_slug}</dd>
          </div>
          <div>
            <dt className="text-sm text-content-muted">Owning team</dt>
            <dd className="mt-xs text-sm">{idea.owner_team}</dd>
          </div>
          <div>
            <dt className="text-sm text-content-muted">Priority (never shown to a client)</dt>
            <dd className="mt-xs text-sm">{idea.priority}</dd>
          </div>
          <div>
            <dt className="text-sm text-content-muted">Related theme</dt>
            <dd className="mt-xs text-sm">{themeTitle(idea.theme_id) ?? "none"}</dd>
          </div>
        </dl>
        <div>
          <p className="text-sm text-content-muted">Problem</p>
          <p className="mt-xs text-sm leading-relaxed">{idea.problem}</p>
        </div>
        <div>
          <p className="text-sm text-content-muted">Outcome</p>
          <p className="mt-xs text-sm leading-relaxed">{idea.outcome}</p>
        </div>
        <p className="text-xs text-content-muted">
          Updated {idea.updated_at}. These fields, the priority and the history reasons below never appear in a client
          response; /api/client/ideas returns the title, a plain-language status, the team and approved text only.
        </p>
      </section>

      <IdeaWorkspace
        ideaId={idea.id}
        status={idea.status}
        nextStatuses={status ? nextIdeaStatuses(status) : []}
        evidence={evidence}
        grantable={grantableViews(actor, idea.id).map((item) => ({ id: item.id, title: item.title }))}
        updates={updates}
      />

      {offList.length > 0 ? (
        <section className="card space-y-sm" aria-labelledby="idea-off-list">
          <h2 id="idea-off-list" className="font-display text-lg font-semibold">
            Granted but no longer readable
          </h2>
          <ul className="list-none space-y-xs text-sm" role="list">
            {offList.map((item) => (
              <li key={item.id} className="font-mono text-xs text-content-muted">
                {item.id} — {item.state}
              </li>
            ))}
          </ul>
          <p className="text-xs text-content-muted">
            A withdrawal deletes the grant rows outright; this list is for a copy a report suspended or a moderator took
            out of the feed. The grant is kept so the record stays truthful, and the content itself is not readable here.
          </p>
        </section>
      ) : null}

      <section className="card space-y-md" aria-labelledby="idea-history">
        <h2 id="idea-history" className="font-display text-lg font-semibold">
          Status history (internal)
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-content-muted" role="status">
            No move recorded yet.
          </p>
        ) : (
          <ol className="list-none space-y-md" role="list">
            {history.map((entry) => (
              <li key={entry.id} className="space-y-xs border-l-4 border-line pl-md">
                <p className="text-sm font-semibold">
                  {entry.from_status ?? "opened"} &rarr; {entry.to_status}
                </p>
                <p className="text-sm">{entry.reason}</p>
                <p className="font-mono text-xs text-content-muted">
                  {entry.actor_email} · {entry.at}
                </p>
              </li>
            ))}
          </ol>
        )}
        <p className="text-xs text-content-muted">
          These reasons are the record of a decision. They are never shown to a client and never imply a delivery date.
        </p>
      </section>
    </div>
  );
}
