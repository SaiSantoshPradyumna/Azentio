import Link from "next/link";
import { notFound } from "next/navigation";
import { ThemeCard } from "@/components/theme-card";
import { cohortMin, themeVisibilityBySlug, type ThemeFilters } from "@/lib/cohort";
import { currentActor } from "@/lib/portal";

export const metadata = {
  title: "Theme",
  description: "One learning theme, its evidence and its limitation.",
};

function filtersOf(searchParams: Record<string, string | string[] | undefined>): ThemeFilters {
  const value = (key: keyof ThemeFilters): string | undefined => {
    const raw = searchParams[key];
    return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
  };
  return { period: value("period"), q: value("q") };
}

export default function ThemeDetailPage({
  params,
  searchParams,
}: {
  params: { tenantId: string; slug: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const actor = currentActor();
  if (!actor || actor.activeTenantId !== params.tenantId) notFound();

  const slug = typeof params.slug === "string" ? params.slug : "";
  // A slug nobody has written still renders as a withheld theme card, exactly like a theme the guard
  // suppresses; only a slug with no theme row at all answers as a missing page.
  const view = themeVisibilityBySlug(actor, slug, filtersOf(searchParams));
  if (!view) notFound();

  const basePath = `/c/${actor.activeTenantId}`;

  return (
    <div className="space-y-2xl">
      <div className="space-y-md">
        <Link href={`${basePath}/themes`} className="text-sm text-accent hover:underline">
          Back to themes
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-md">
          <h1 className="font-display text-2xl font-semibold">{view.title}</h1>
          <p className="badge">
            <span aria-hidden="true">{view.suppressed ? "🔒" : "🌐"}</span>
            {view.suppressed ? "Not shown yet" : "Shared learning theme"}
          </p>
        </div>
        <p className="font-mono text-xs text-content-muted">
          {view.offering_slug} · topic {view.topic_key} · cohort minimum {cohortMin()} organisations
        </p>
      </div>

      <ul className="list-none" role="list">
        <ThemeCard actorBasePath={basePath} theme={view} />
      </ul>

      <section className="card space-y-sm" aria-labelledby="theme-detail-notes">
        <h2 id="theme-detail-notes" className="font-display text-lg font-semibold">
          What this page is and is not
        </h2>
        <ul className="list-disc space-y-xs pl-lg text-sm text-content-muted">
          <li>
            Evidence is the moderator-approved, de-identified summary a colleague wrote about their own organisation. It is
            not audited data and not a benchmark.
          </li>
          <li>
            {view.suppressed
              ? "While the theme is withheld, its evidence list and organisation count are not stored anywhere on this page — the guard hides them before rendering."
              : "Organisations are reported as a bucket, never individually. Multiple observations from one organisation count once."}
          </li>
          <li>
            <Link href={`/api/themes/${view.slug}`} className="text-accent hover:underline">
              The same shape as JSON
            </Link>{" "}
            is what the feed, search and export readers see.
          </li>
        </ul>
      </section>
    </div>
  );
}
