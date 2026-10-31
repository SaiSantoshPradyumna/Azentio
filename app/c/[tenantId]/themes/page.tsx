import Link from "next/link";
import { notFound } from "next/navigation";
import { ThemeCard } from "@/components/theme-card";
import { themeVisibilities, cohortMin, type ThemeFilters } from "@/lib/cohort";
import { currentActor } from "@/lib/portal";
import { visibleFacets } from "@/lib/visible";

export const metadata = {
  title: "Themes",
  description: "Patterns across organisations, shown only when enough independent organisations contribute.",
};

function filtersOf(searchParams: Record<string, string | string[] | undefined>): ThemeFilters {
  const value = (key: keyof ThemeFilters): string | undefined => {
    const raw = searchParams[key];
    return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
  };
  return { period: value("period"), q: value("q") };
}

export default function ThemesPage({
  params,
  searchParams,
}: {
  params: { tenantId: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const actor = currentActor();
  if (!actor || actor.activeTenantId !== params.tenantId) notFound();

  const basePath = `/c/${actor.activeTenantId}`;
  const filters = filtersOf(searchParams);
  const views = themeVisibilities(actor, filters);
  const shown = views.filter((view) => !view.suppressed);
  const hidden = views.filter((view) => view.suppressed);
  const facets = visibleFacets(actor);
  const query = new URLSearchParams();
  if (filters.period) query.set("period", filters.period);
  if (filters.q) query.set("q", filters.q);

  return (
    <div className="space-y-2xl">
      <section className="space-y-md" aria-labelledby="themes-title">
        <div className="flex flex-wrap items-start justify-between gap-md">
          <h1 id="themes-title" className="font-display text-2xl font-semibold">
            Themes
          </h1>
          <Link href={`${basePath}/learning`} className="text-sm text-accent hover:underline">
            Back to shared learning
          </Link>
        </div>
        <p className="max-w-3xl text-sm leading-relaxed text-content-muted">
          A theme groups observations from different organisations that describe the same gap in the same offering. It is
          shown only when at least {cohortMin()} distinct organisations have contributed published evidence for it — a theme
          about one organisation is that organisation&rsquo;s story, not a pattern.
        </p>
      </section>

      <section className="card space-y-md" aria-labelledby="themes-filters">
        <h2 id="themes-filters" className="font-display text-lg font-semibold">
          Narrow the set
        </h2>
        <form method="get" action={`${basePath}/themes`} className="grid gap-md sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-content-muted">Search words</span>
            <input
              className="mt-xs w-full rounded-card border border-line bg-surface px-sm py-xs text-sm"
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="seasonal cash flow"
              maxLength={120}
            />
          </label>
          <label className="block text-sm">
            <span className="text-content-muted">Quarter</span>
            <select
              className="mt-xs w-full rounded-card border border-line bg-surface px-sm py-xs text-sm"
              name="period"
              defaultValue={filters.period ?? ""}
            >
              <option value="">Any</option>
              {facets.periods.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap items-end gap-md">
            <button type="submit" className="btn-primary">
              Apply
            </button>
            <a href={`${basePath}/themes`} className="btn-secondary">
              Clear
            </a>
          </div>
        </form>
        <p className="text-sm text-content-muted">
          A filter narrows the organisations counted, so a theme that clears the minimum overall can drop below it in one
          quarter and disappear here. There is no breakdown by industry or region: a theme&rsquo;s statistics stay bucketed.
        </p>
      </section>

      <section className="space-y-lg" aria-labelledby="themes-shown">
        <h2 id="themes-shown" className="font-display text-lg font-semibold">
          Themes shown ({shown.length})
        </h2>
        {shown.length === 0 ? (
          <div className="card border-dashed space-y-sm" role="status">
            <p className="text-sm text-content-muted">
              No theme has enough independent organisations behind it for this view. That is the guard working, not an empty
              product.
            </p>
          </div>
        ) : (
          <ul className="list-none space-y-lg" role="list">
            {shown.map((theme) => (
              <ThemeCard key={theme.slug} actorBasePath={basePath} theme={theme} />
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-lg" aria-labelledby="themes-hidden">
        <h2 id="themes-hidden" className="font-display text-lg font-semibold">
          Not shown yet ({hidden.length})
        </h2>
        {hidden.length === 0 ? (
          <p className="text-sm text-content-muted" role="status">
            Nothing is being withheld for this view.
          </p>
        ) : (
          <ul className="list-none space-y-lg" role="list">
            {hidden.map((theme) => (
              <ThemeCard key={theme.slug} actorBasePath={basePath} theme={theme} />
            ))}
          </ul>
        )}
        <p className="text-sm text-content-muted" data-testid="themes-note">
          The titles of suppressed themes come from editors, not from any single organisation. Their evidence, their counts
          and their quarter ranges are withheld, so a suppressed card cannot be read as &ldquo;one organisation said
          this&rdquo;.
        </p>
      </section>

      <section className="card space-y-sm" aria-labelledby="themes-notes">
        <h2 id="themes-notes" className="font-display text-lg font-semibold">
          How these are built
        </h2>
        <ul className="list-disc space-y-xs pl-lg text-sm text-content-muted">
          <li>Membership is computed when you open the page, from the live shared summaries — there is no stored aggregate to go stale.</li>
          <li>Multiple observations from one organisation count as one organisation.</li>
          <li>Nothing here is a market study, and no count is evidence of prevalence or cause.</li>
          <li>No model training programme is enabled, and nothing in these themes is used to train a model.</li>
        </ul>
        {query.toString() ? (
          <p className="text-xs text-content-muted">Filtered view: {decodeURIComponent(query.toString())}</p>
        ) : null}
      </section>
    </div>
  );
}
