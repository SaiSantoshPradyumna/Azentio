import Link from "next/link";
import { StateBadge } from "@/components/state-badge";
import { entitledOfferings, listContributions, statusCounts } from "@/lib/contributions";
import { CONTRIBUTION_STATES, type ContributionState } from "@/lib/lifecycle";
import { clientIdeas } from "@/lib/ideas";
import { currentActor, tenantNameById } from "@/lib/portal";
import { unreadCount } from "@/lib/notify";
import { effectivePermissions } from "@/lib/authorize";
import { visibleSharedViews } from "@/lib/visible";
import { isPlaygroundScenario } from "@/lib/playground";

// The client dashboard. Counts come from the same reads the API uses, and the shared numbers come only
// through visibleSharedViews() — the one reader of shared content, so the dashboard can never show an
// item the feed itself would refuse. Ideas use clientIdeas(), the same DTO /api/client/ideas returns.

export default function ClientDashboard({ params }: { params: { tenantId: string } }) {
  // The workspace layout already ran protectPage() against the session; a page only reads the actor.
  const actor = currentActor();
  if (!actor || !actor.activeTenantId || actor.activeTenantId !== params.tenantId) return null;

  const tenantId = actor.activeTenantId;
  const offerings = entitledOfferings(tenantId);
  const rows = listContributions(actor, "org");
  const counts = statusCounts(rows);
  const ideas = clientIdeas(tenantId);
  const canCreate = effectivePermissions(actor).includes("contribution.create");
  const unread = unreadCount(actor.userId);
  const shared = visibleSharedViews(actor, {});

  return (
    <div className="space-y-2xl">
      <section aria-labelledby="dashboard-offerings" className="space-md">
        <h2 id="dashboard-offerings" className="font-display text-xl font-semibold">
          Entitled offerings
        </h2>
        {offerings.length === 0 ? (
          <div className="card border-dashed" role="status">
            <h3 className="font-display text-lg font-semibold">No entitlements on this organisation</h3>
            <p className="mt-sm text-sm text-content-muted">
              {tenantNameById(tenantId)} holds no entitled offering, so there is nothing to observe against and no demo
              to open. An Azentio administrator adds entitlements; a client admin cannot add one.
            </p>
          </div>
        ) : (
          <ul className="grid gap-md sm:grid-cols-2" role="list">
            {offerings.map((offering) => (
              <li key={offering.slug} className="card">
                <h3 className="font-display text-lg font-semibold">{offering.name}</h3>
                <p className="mt-xs font-mono text-xs text-content-muted">{offering.slug}</p>
                {isPlaygroundScenario(offering.slug) ? (
                  <>
                    <p className="mt-sm text-sm text-content-muted">
                      Entitled demo — synthetic playground for this offering.
                    </p>
                    <Link
                      href={`/c/${tenantId}/demo/${offering.slug}`}
                      className="mt-md inline-flex text-sm font-semibold text-accent hover:underline"
                    >
                      Open demo
                    </Link>
                  </>
                ) : (
                  <p className="mt-sm text-sm text-content-muted">
                    Entitled offering. No guided playground scenario is defined for this product in the demo.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="dashboard-status" className="space-md">
        <div className="flex flex-wrap items-end justify-between gap-md">
          <h2 id="dashboard-status" className="font-display text-xl font-semibold">
            Observations in {tenantNameById(tenantId)}
          </h2>
          <Link href={`/c/${tenantId}/observations`} className="btn-secondary">
            Open observations
          </Link>
        </div>

        <dl className="grid gap-md sm:grid-cols-2 lg:grid-cols-4">
          {CONTRIBUTION_STATES.map((state) => (
            <div key={state} className="card">
              <dt className="text-sm text-content-muted">{state}</dt>
              <dd className="mt-xs font-display text-2xl font-semibold">{counts[state as ContributionState] ?? 0}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-content-muted">
          Counts cover the observations this session may open: yours, and your organisation&rsquo;s. A private draft of
          someone else is never counted.
        </p>
      </section>

      {rows.length > 0 ? (
        <section aria-labelledby="dashboard-recent" className="space-md">
          <h2 id="dashboard-recent" className="font-display text-xl font-semibold">
            Recent activity
          </h2>
          <ul className="card divide-y divide-line list-none" role="list">
            {rows.slice(0, 5).map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-sm py-sm">
                <Link href={`/c/${tenantId}/observations/${row.id}`} className="font-semibold text-accent hover:underline">
                  {row.title}
                </Link>
                <StateBadge state={row.state} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="dashboard-shared" className="space-md">
        <div className="flex flex-wrap items-end justify-between gap-md">
          <h2 id="dashboard-shared" className="font-display text-xl font-semibold">
            Shared learning
          </h2>
          <Link href={`/c/${tenantId}/learning`} className="btn-secondary">
            Open the shared feed
          </Link>
        </div>
        <p className="badge">
          <span aria-hidden="true">🌐</span> Shared · de-identified and moderator-reviewed · {shared.length} item
          {shared.length === 1 ? "" : "s"} visible to you
        </p>
        {shared.length === 0 ? (
          <p className="text-sm text-content-muted" role="status">
            Nothing has been approved for sharing yet.
          </p>
        ) : (
          <ul className="card list-none divide-y divide-line" role="list">
            {shared.slice(0, 3).map((item) => (
              <li key={item.id} className="space-y-xs py-sm">
                <p className="font-semibold">{item.title}</p>
                <p className="text-sm text-content-muted">{item.summary}</p>
                <p className="font-mono text-xs text-content-muted">
                  {item.offering_slug} · {item.region_coarse} · {item.period_quarter}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-content-muted">
          These are moderator-written summaries from other organisations, not their original text. A count here is not a
          market statistic; cross-organisation patterns live in{" "}
          <Link href={`/c/${actor.activeTenantId}/themes`} className="text-accent hover:underline">
            Themes
          </Link>
          , which stay hidden until enough independent organisations contribute.
        </p>
      </section>

      <section aria-labelledby="dashboard-ideas" className="space-md">
        <div className="flex flex-wrap items-end justify-between gap-md">
          <h2 id="dashboard-ideas" className="font-display text-xl font-semibold">
            Improvement ideas relevant to your offerings
          </h2>
          <Link href={`/c/${tenantId}/ideas`} className="btn-secondary">
            All ideas
          </Link>
        </div>
        {ideas.length === 0 ? (
          <p className="text-sm text-content-muted" role="status">
            No improvement idea has been opened against an offering you hold. Ideas come from shared themes once three
            organisations describe the same gap.
          </p>
        ) : (
          <ul className="grid gap-md sm:grid-cols-2" role="list">
            {ideas.slice(0, 4).map((idea) => (
              <li key={idea.id} className="card space-y-xs">
                <h3 className="font-display text-lg font-semibold">{idea.title}</h3>
                <p className="text-sm">{idea.status_plain}</p>
                <p className="text-sm text-content-muted">Owned by {idea.owner_team}</p>
                {idea.approved_text ? (
                  <p className="border-l-4 border-line pl-md text-sm leading-relaxed">
                    {idea.approved_text}
                    <span className="mt-xs block font-mono text-xs text-content-muted">Last update {idea.last_update_at}</span>
                  </p>
                ) : (
                  <p className="text-xs text-content-muted">No approved update for this idea yet.</p>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-content-muted">
          Plain status and approved text only. A status describes a state, never a delivery date, and Azentio does not
          publish how it ranks one idea against another.
        </p>
      </section>

      <section aria-labelledby="dashboard-you" className="card space-y-sm">
        <h2 id="dashboard-you" className="font-display text-lg font-semibold">
          This session
        </h2>
        <p className="text-sm">
          {unread > 0 ? (
            <>
              <Link href="/notifications" className="font-semibold text-accent hover:underline">
                {unread} unread notification{unread === 1 ? "" : "s"}
              </Link>{" "}
              — the bell in the header marks them read.
            </>
          ) : (
            <>
              <Link href="/notifications" className="font-semibold text-accent hover:underline">
                Notifications
              </Link>{" "}
              — nothing unread.
            </>
          )}
        </p>
        {canCreate ? null : (
          <p className="text-sm text-content-muted">
            Your role in this organisation is {actor.clientRole}. Your role can read organisation observations but not
            create them, so there is no &ldquo;New observation&rdquo; button here.
          </p>
        )}
      </section>
    </div>
  );
}
