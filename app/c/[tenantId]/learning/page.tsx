import Link from "next/link";
import { SharedItemReport } from "@/components/shared-item-report";
import { ThemeCard } from "@/components/theme-card";
import { CONFIDENCE_LABELS, EVIDENCE_LABELS } from "@/lib/contribution-schema";
import { cohortMin, themeVisibilities } from "@/lib/cohort";
import { currentActor } from "@/lib/portal";
import { visibleFacets, visibleSharedViews, type SharedViewFilters } from "@/lib/visible";

export const metadata = {
  title: "Shared learning",
  description: "De-identified, moderator-approved observations from other organisations.",
};

const FIELD_NAMES = ["offering", "industry", "region", "period", "topic", "q"] as const;

function filtersOf(searchParams: Record<string, string | string[] | undefined>): SharedViewFilters {
  const value = (key: (typeof FIELD_NAMES)[number]): string | undefined => {
    const raw = searchParams[key];
    return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
  };
  return {
    offering: value("offering"),
    industry: value("industry"),
    region: value("region"),
    period: value("period"),
    topic: value("topic"),
    q: value("q"),
  };
}

export default function LearningPage({
  params,
  searchParams,
}: {
  params: { tenantId: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const actor = currentActor();
  if (!actor || actor.activeTenantId !== params.tenantId) return null;

  const basePath = `/c/${actor.activeTenantId}/learning`;
  const filters = filtersOf(searchParams);
  const rows = visibleSharedViews(actor, filters);
  const facets = visibleFacets(actor);
  // Themes keep their own guard: only the quarter and the words narrow the counted set, and an offering
  // filter hides themes about a different offering rather than re-statistics them.
  const themeViews = themeVisibilities(actor, { period: filters.period, q: filters.q }).filter(
    (theme) => !filters.offering || theme.offering_slug === filters.offering,
  );
  const query = new URLSearchParams();
  for (const name of FIELD_NAMES) {
    const value = filters[name];
    if (value) query.set(name, value);
  }
  const exportSuffix = query.toString() ? `&${query}` : "";

  return (
    <div className="space-y-2xl">
      <section className="space-y-md" aria-labelledby="learning-title">
        <div className="flex flex-wrap items-start justify-between gap-md">
          <h1 id="learning-title" className="font-display text-2xl font-semibold">
            Shared learning
          </h1>
          <p className="badge">
            <span aria-hidden="true">🌐</span> Shared · de-identified and moderator-reviewed
          </p>
        </div>
        <p className="max-w-3xl text-sm leading-relaxed text-content-muted">
          Every card here is a summary a moderator wrote or approved. Your organisation&rsquo;s private observations, other
          organisations&rsquo; drafts and all unapproved text are not in this feed and are not searched. Nothing here is
          anonymous: a credit line appears only when the author asked for one and a moderator approved it.
        </p>
      </section>

      <section className="card space-y-md" aria-labelledby="learning-filters">
        <h2 id="learning-filters" className="font-display text-lg font-semibold">
          Filter and search
        </h2>
        <form method="get" action={basePath} className="grid gap-md sm:grid-cols-2 lg:grid-cols-3">
          <SearchField label="Search words" name="q" value={filters.q ?? ""} placeholder="seasonal cash flow" />
          <SelectField label="Offering" name="offering" value={filters.offering ?? ""} options={facets.offerings} />
          <SelectField label="Industry" name="industry" value={filters.industry ?? ""} options={facets.industries} />
          <SelectField label="Broad region" name="region" value={filters.region ?? ""} options={facets.regions} />
          <SelectField label="Quarter" name="period" value={filters.period ?? ""} options={facets.periods} />
          <SelectField label="Topic" name="topic" value={filters.topic ?? ""} options={facets.topics} />
          <div className="flex flex-wrap items-end gap-md">
            <button type="submit" className="btn-primary">
              Apply
            </button>
            <a href={basePath} className="btn-secondary">
              Clear
            </a>
          </div>
        </form>
        <p className="text-sm text-content-muted">
          Filter choices only list values that already appear in what you can see. Regions are broad and periods are quarters,
          because a fine-grained facet could re-identify a single contributor.
        </p>
      </section>

      <section className="space-y-lg">
        <div className="flex flex-wrap items-end justify-between gap-md">
          <p className="text-sm" role="status">
            <span className="font-semibold">{rows.length}</span> shared item{rows.length === 1 ? "" : "s"} in this result.
            <span className="text-content-muted"> A count of posts is not evidence of market prevalence.</span>
          </p>
          <p className="flex flex-wrap gap-md text-sm">
            <a href={`/api/export?format=csv${exportSuffix}`} className="text-accent hover:underline">
              Export as CSV
            </a>
            <a href={`/api/export?format=json${exportSuffix}`} className="text-accent hover:underline">
              Export as JSON
            </a>
          </p>
        </div>
        <p className="text-sm text-content-muted">
          An export is exactly this list of items and fields — the same reader, the same rows, another encoding. It is stored
          nowhere and cannot recall a file you already downloaded.
        </p>

        {rows.length === 0 ? (
          <div className="card border-dashed space-y-sm" role="status">
            <h2 className="font-display text-lg font-semibold">No shared items match</h2>
            <p className="text-sm text-content-muted">
              Either nothing has been published on that topic yet, or the filters are too narrow. Clear them to see the whole
              visible set.
            </p>
          </div>
        ) : (
          <ul className="list-none space-y-lg" role="list">
            {rows.map((row) => (
              <li
                key={row.id}
                className="space-y-md rounded-card border border-accent/50 bg-accent/5 p-lg"
                data-testid="shared-item"
              >
                <div className="flex flex-wrap items-start justify-between gap-md">
                  <h2 className="font-display text-lg font-semibold">{row.title}</h2>
                  <p className="badge">
                    <span aria-hidden="true">🌐</span> Shared learning
                  </p>
                </div>
                <p className="text-sm leading-relaxed">{row.summary}</p>
                <p className="font-mono text-xs text-content-muted">
                  {row.offering_slug} · {row.topic} · {row.industry} · {row.region_coarse} · {row.period_quarter}
                </p>
                <p className="text-xs text-content-muted">
                  Evidence: {EVIDENCE_LABELS[row.evidence_type as keyof typeof EVIDENCE_LABELS] ?? row.evidence_type} ·
                  Confidence: {CONFIDENCE_LABELS[row.confidence as keyof typeof CONFIDENCE_LABELS] ?? row.confidence} ·
                  published {row.published_at}
                </p>
                <p className="text-sm">
                  {row.attribution
                    ? `Credited to ${row.attribution}`
                    : "No credit shown — the author did not ask, or a moderator did not approve it."}
                </p>
                <SharedItemReport sharedViewId={row.id} title={row.title} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-lg" aria-labelledby="learning-themes">
        <div className="flex flex-wrap items-end justify-between gap-md">
          <h2 id="learning-themes" className="font-display text-lg font-semibold">
            Themes in this view
          </h2>
          <Link href={`/c/${actor.activeTenantId}/themes`} className="text-sm text-accent hover:underline">
            All themes
          </Link>
        </div>
        {themeViews.length === 0 ? (
          <p className="text-sm text-content-muted" role="status" data-testid="no-themes">
            No theme clears the cohort minimum for this filter. A theme needs published evidence from at least{" "}
            {cohortMin()} distinct organisations, and a filter that narrows the set narrows the count with it.
          </p>
        ) : (
          <ul className="list-none space-y-lg" role="list">
            {themeViews.map((theme) => (
              <ThemeCard key={theme.slug} actorBasePath={`/c/${actor.activeTenantId}`} theme={theme} />
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-sm" aria-labelledby="learning-notes">
        <h2 id="learning-notes" className="font-display text-lg font-semibold">
          How this list is built
        </h2>
        <ul className="list-disc space-y-xs pl-lg text-sm text-content-muted">
          <li>
            Only live, moderator-approved summaries appear. A withdrawn or unpublished item disappears from the feed, search,
            count, export and every theme at the same moment, because all of them read the same rows.
          </li>
          <li>
            Themes are guarded by the number of distinct organisations behind them (Section 13). A pattern that rests on one
            organisation is withheld rather than published as a statistic.
          </li>
          <li>No model training programme is enabled, and nothing in this feed is used to train a model.</li>
        </ul>
      </section>
    </div>
  );
}

function SearchField({ label, name, value, placeholder }: { label: string; name: string; value: string; placeholder: string }) {
  return (
    <label className="block text-sm">
      <span className="text-content-muted">{label}</span>
      <input
        className="mt-xs w-full rounded-card border border-line bg-surface px-sm py-xs text-sm"
        name={name}
        defaultValue={value}
        placeholder={placeholder}
        maxLength={120}
      />
    </label>
  );
}

function SelectField({ label, name, value, options }: { label: string; name: string; value: string; options: string[] }) {
  return (
    <label className="block text-sm">
      <span className="text-content-muted">{label}</span>
      <select
        className="mt-xs w-full rounded-card border border-line bg-surface px-sm py-xs text-sm"
        name={name}
        defaultValue={value}
      >
        <option value="">Any</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
