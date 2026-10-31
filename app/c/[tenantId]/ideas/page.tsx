import Link from "next/link";
import { getProduct } from "@/lib/public-db";
import { clientIdeas } from "@/lib/ideas";
import { currentActor, tenantNameById } from "@/lib/portal";

export const metadata = {
  title: "Improvement ideas",
  description: "Ideas against the offerings your organisation holds, in plain language.",
};

// Section 18: /c/[tenantId]/ideas shows a client only what clientIdeaDTO() allows — title, a
// plain-language status, the owning team, the last update and the text a moderator approved. The raw
// status, the internal priority and every history reason stay on the employee side.
export default function ClientIdeasPage({ params }: { params: { tenantId: string } }) {
  const actor = currentActor();
  if (!actor || !actor.activeTenantId || actor.activeTenantId !== params.tenantId) return null;

  const ideas = clientIdeas(actor.activeTenantId);

  return (
    <div className="space-y-xl">
      <section className="space-y-md">
        <h1 className="font-display text-2xl font-semibold">Improvement ideas</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-content-muted">
          These are the ideas Azentio has opened against the offerings {tenantNameById(actor.activeTenantId)} holds. Each
          card gives a plain-language status and, when a moderator has approved it, the update the team is willing to put
          its name to.
        </p>
        <p className="badge" data-testid="client-ideas-count">
          {ideas.length} idea{ideas.length === 1 ? "" : "s"} · no dates, no priorities, no internal reasons
        </p>
      </section>

      {ideas.length === 0 ? (
        <p className="card border-dashed text-sm text-content-muted" role="status">
          No idea has been opened against your offerings yet. Ideas usually start from a shared theme, once three
          organisations describe the same gap.
        </p>
      ) : (
        <ul className="grid gap-md sm:grid-cols-2" role="list">
          {ideas.map((idea) => (
            <li key={idea.id} className="card space-y-sm">
              <h2 className="font-display text-lg font-semibold">{idea.title}</h2>
              <p className="text-sm">
                Status: <span className="font-semibold">{idea.status_plain}</span>
              </p>
              <p className="text-sm text-content-muted">
                Owned by {idea.owner_team} · {getProduct(idea.offering_slug)?.name ?? idea.offering_slug}
              </p>
              {idea.approved_text ? (
                <blockquote className="border-l-4 border-line pl-md text-sm leading-relaxed">
                  {idea.approved_text}
                  <span className="mt-xs block font-mono text-xs text-content-muted">Last update {idea.last_update_at}</span>
                </blockquote>
              ) : (
                <p className="text-sm text-content-muted" role="status">
                  No approved update for this idea yet.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <section className="card space-y-sm" aria-labelledby="client-ideas-note">
        <h2 id="client-ideas-note" className="font-display text-lg font-semibold">
          What this page does not tell you
        </h2>
        <ul className="list-disc space-y-xs pl-lg text-sm text-content-muted">
          <li>No delivery date and no commitment. &ldquo;Planned&rdquo; and &ldquo;In progress&rdquo; describe a state, not a schedule.</li>
          <li>No internal priority. Azentio does not publish how it ranks one idea against another.</li>
          <li>No history reasons. Why a status moved stays in the product team&rsquo;s record; ask your contact and the team answers directly.</li>
          <li>Only text a moderator approved appears above. A product owner&rsquo;s draft update is never rendered here.</li>
        </ul>
        <p className="text-xs text-content-muted">
          Product information is indicative and subject to validation. Ideas relevant to your observations start in the{" "}
          <Link href={`/c/${actor.activeTenantId}/learning`} className="text-accent hover:underline">
            shared feed
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
