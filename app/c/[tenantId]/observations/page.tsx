import Link from "next/link";
import { StateBadge } from "@/components/state-badge";
import { effectivePermissions } from "@/lib/authorize";
import { listContributions } from "@/lib/contributions";
import { STATE_PLAIN } from "@/lib/lifecycle";
import { currentActor, tenantNameById } from "@/lib/portal";

type Tab = "mine" | "org";

function tabOf(value: string | undefined): Tab {
  return value === "org" ? "org" : "mine";
}

export default function ObservationsPage({
  params,
  searchParams,
}: {
  params: { tenantId: string };
  searchParams: { tab?: string };
}) {
  const actor = currentActor();
  if (!actor || actor.activeTenantId !== params.tenantId) return null;

  const tenantId = actor.activeTenantId;
  const tab = tabOf(searchParams.tab);
  const rows = listContributions(actor, tab);
  const canCreate = effectivePermissions(actor).includes("contribution.create");

  return (
    <div className="space-y-xl">
      <div className="flex flex-wrap items-end justify-between gap-md">
        <div>
          <h1 className="font-display text-2xl font-semibold">Observations</h1>
          <p className="mt-xs text-sm text-content-muted">
            Private notes your organisation files about what it sees. Nothing here reaches another organisation until a
            moderator approves a de-identified summary.
          </p>
        </div>
        {canCreate ? (
          <Link href={`/c/${tenantId}/observations/new`} className="btn-primary">
            New observation
          </Link>
        ) : (
          <p className="text-sm text-content-muted">Your role in this organisation can read but not create.</p>
        )}
      </div>

      <nav aria-label="Observation lists" className="flex gap-md border-b border-line">
        <TabLink href={`/c/${tenantId}/observations?tab=mine`} active={tab === "mine"} label="My observations" />
        <TabLink href={`/c/${tenantId}/observations?tab=org`} active={tab === "org"} label={`Our organisation · ${tenantNameById(tenantId)}`} />
      </nav>

      {tab === "mine" ? (
        <p className="text-sm text-content-muted">Only you appear in this list, including every draft you kept private.</p>
      ) : (
        <p className="text-sm text-content-muted">
          Items your session may open in this organisation. Another member&rsquo;s private draft is not here.
        </p>
      )}

      {rows.length === 0 ? (
        <div className="card border-dashed" role="status">
          <h2 className="font-display text-lg font-semibold">Nothing to show</h2>
          <p className="mt-sm text-sm text-content-muted">
            {tab === "mine"
              ? "You have not filed an observation in this organisation yet. A draft stays private until you submit it."
              : "No observation in this organisation is open to your session right now."}
          </p>
        </div>
      ) : (
        <ul className="card divide-y divide-line list-none" role="list">
          {rows.map((row) => (
            <li key={row.id} className="space-y-sm py-md">
              <div className="flex flex-wrap items-start justify-between gap-md">
                <Link href={`/c/${tenantId}/observations/${row.id}`} className="font-display text-lg font-semibold text-accent hover:underline">
                  {row.title}
                </Link>
                <StateBadge state={row.state} detail={row.author_id === actor.userId ? "yours" : "colleague"} />
              </div>
              <p className="text-sm text-content-muted">{STATE_PLAIN[row.state]}</p>
              <p className="font-mono text-xs text-content-muted">
                {row.offering_slug} · {row.topic} · {row.period} · v{row.version}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TabLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <a
      href={href}
      aria-current={active ? "page" : undefined}
      className={`-mb-px border-b-2 px-sm py-sm text-sm font-semibold ${
        active ? "border-accent text-content" : "border-transparent text-content-muted hover:text-content"
      }`}
    >
      {label}
    </a>
  );
}
