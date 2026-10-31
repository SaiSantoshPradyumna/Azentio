import Link from "next/link";
import { IdeaForm } from "@/components/idea-form";
import { authorize, effectivePermissions } from "@/lib/authorize";
import { listProducts } from "@/lib/public-db";
import { themes } from "@/lib/cohort";
import { IDEA_STATUSES } from "@/lib/idea-lifecycle";
import { ideaCounters, listIdeas } from "@/lib/ideas";
import { currentActor } from "@/lib/portal";

export const metadata = {
  title: "Improvement ideas",
  description: "The product owner's idea list: internal status, priority and evidence counts.",
};

// Section 14 and 18: /employee/ideas is the product-owner workspace. The same action the API uses
// guards the screen, so an employee without the grant gets no list and no form, and the attempt is
// audited by the endpoint they would have called.
export default function EmployeeIdeasPage() {
  const actor = currentActor();
  if (!actor || !authorize(actor, "idea.write", { audience: "employee" }).allow) return null;

  const ideas = listIdeas();
  const offerings = listProducts().map((product) => ({ slug: product.slug, name: product.name }));
  const themeOptions = themes().map((theme) => ({ id: theme.id, title: theme.title }));
  const permissions = effectivePermissions(actor);

  return (
    <div className="space-y-2xl">
      <section className="space-y-md">
        <h1 className="font-display text-2xl font-semibold">Improvement ideas</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-content-muted">
          This is the internal view: raw status, internal priority and the reasons behind each move. A client page shows the
          title, a plain-language status, the owning team, the last update and only the text a moderator approved. Nothing
          on this screen is written to a client response.
        </p>
        <p className="badge" data-testid="idea-permissions">
          {permissions.includes("product.owner") ? "product.owner" : "idea access by another route"} · {ideas.length} idea
          {ideas.length === 1 ? "" : "s"}
        </p>
      </section>

      <section aria-labelledby="ideas-list" className="space-md">
        <h2 id="ideas-list" className="font-display text-lg font-semibold">
          All ideas
        </h2>
        {ideas.length === 0 ? (
          <p className="card border-dashed text-sm text-content-muted" role="status">
            No idea has been opened yet. Ideas usually come from a shared theme, once three organisations describe the same
            gap.
          </p>
        ) : (
          <ul className="card divide-y divide-line list-none" role="list">
            {ideas.map((idea) => {
              const counters = ideaCounters(idea.id);
              return (
                <li key={idea.id} className="space-y-xs py-md">
                  <div className="flex flex-wrap items-start justify-between gap-md">
                    <Link href={`/employee/ideas/${idea.id}`} className="font-display text-lg font-semibold text-accent hover:underline">
                      {idea.title}
                    </Link>
                    <span className="badge">{idea.status}</span>
                  </div>
                  <p className="text-sm text-content-muted">
                    {idea.offering_slug} · {idea.owner_team} · priority {idea.priority}
                  </p>
                  <p className="font-mono text-xs text-content-muted">
                    {counters.grants} evidence · {counters.updates} update(s)
                    {counters.pending > 0 ? ` · ${counters.pending} awaiting a moderator` : ""} · updated {idea.updated_at}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-content-muted">
          Statuses move in one direction only: {IDEA_STATUSES.join(" → ")} is the happy path, and every state except the last
          two can turn into Not proceeding with a reason.
        </p>
      </section>

      <IdeaForm basePath="/employee" options={{ offerings, themes: themeOptions }} />
    </div>
  );
}
