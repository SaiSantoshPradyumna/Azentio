import { authorize, type Actor } from "./authorize";
import { audit } from "./audit";
import { getDb } from "./db";
import { visibleSharedViews, type SharedViewDTO } from "./visible";

// Section 13 cohort guard. A theme is a claim about a pattern across organisations, so it may only be
// shown when at least COHORT_MIN distinct organisations contributed the live shared views behind it.
// Below the minimum the reader gets the suppression reason and nothing else: no evidence, no counts.
//
// This module is one of the three allowed to touch `shared_views` directly (Section 8). It does so only
// to count DISTINCT tenants, which the display reader in ./visible deliberately cannot answer. That
// count is never returned — only the bucket label — and no region or industry breakdown is offered.

export type ThemeRow = {
  id: string;
  slug: string;
  title: string;
  offering_slug: string;
  topic_key: string;
  description: string;
  limitation: string;
  updated_at: string;
};

/** Narrowed like the guard, so a caller cannot pass a filter that only one side of it honours. */
export type ThemeFilters = {
  /** `YYYY-Qn` or `YYYY-MM`; the same coarse quarter the feed uses. */
  period?: string;
  /** Substring match on title, summary and topic. */
  q?: string;
};

export const SUPPRESSION_REASON = "Fewer than the minimum number of organisations";

/** Never an exact number: a count this small could identify the one organisation behind it. */
export function orgBucketLabel(min: number): string {
  return `${min} or more organisations`;
}

/** Below this many organisations a theme is suppressed. */
export function cohortMin(): number {
  const raw = Number.parseInt(process.env.COHORT_MIN ?? "", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 3;
}

/** Section 13: the sample is still thin below this many organisations, so the view warns about it. */
const SMALL_SAMPLE_BELOW = 5;

export function themes(): ThemeRow[] {
  return getDb()
    .prepare(
      `SELECT id, slug, title, offering_slug, topic_key, description, limitation, updated_at
       FROM themes ORDER BY title`,
    )
    .all() as ThemeRow[];
}

export function themeBySlug(slug: string): ThemeRow | null {
  if (!slug) return null;
  const row = getDb()
    .prepare(
      `SELECT id, slug, title, offering_slug, topic_key, description, limitation, updated_at
       FROM themes WHERE slug = ?`,
    )
    .get(slug) as ThemeRow | undefined;
  return row ?? null;
}

/**
 * Distinct organisations with a live shared view for this theme, over the whole theme or one filtered
 * slice of it. Section 13 applies the same minimum to any filtered set, so a period or search filter
 * narrows the count too and can push a visible theme under the guard.
 */
export function distinctOrgCount(theme: ThemeRow, filters: ThemeFilters = {}): number {
  const where = ["sv.state = 'live'", "c.topic = ?", "c.offering_slug = ?"];
  const params: (string | number)[] = [theme.topic_key, theme.offering_slug];

  if (filters.period?.trim()) {
    where.push("sv.period_quarter = ?");
    params.push(coarseQuarterFilter(filters.period.trim()));
  }
  const q = filters.q?.trim().toLowerCase();
  if (q) {
    const needle = `%${q.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
    where.push("(lower(sv.title) LIKE ? ESCAPE '\\' OR lower(sv.summary) LIKE ? ESCAPE '\\' OR lower(sv.topic) LIKE ? ESCAPE '\\')");
    params.push(needle, needle, needle);
  }

  const row = getDb()
    .prepare(
      `SELECT COUNT(DISTINCT c.tenant_id) AS n
       FROM shared_views sv JOIN contributions c ON c.id = sv.contribution_id
       WHERE ${where.join(" AND ")}`,
    )
    .get(...params) as { n: number };
  return row.n;
}

/** `YYYY-MM` arrives from a page chip; `YYYY-Qn` is already the stored bucket. */
function coarseQuarterFilter(value: string): string {
  if (/^\d{4}-Q[1-4]$/.test(value)) return value;
  const year = value.slice(0, 4);
  const month = Number.parseInt(value.slice(5, 7), 10);
  if (!/^\d{4}$/.test(year) || !Number.isFinite(month) || month < 1 || month > 12) return value;
  return `${year}-Q${Math.ceil(month / 3)}`;
}

export type VisibleTheme = {
  slug: string;
  title: string;
  offering_slug: string;
  topic_key: string;
  description: string;
  limitation: string;
  suppressed: false;
  reason: null;
  orgBucket: string;
  smallSample: boolean;
  quarters: { from: string; to: string } | null;
  evidence: SharedViewDTO[];
};

export type SuppressedTheme = {
  slug: string;
  title: string;
  offering_slug: string;
  topic_key: string;
  description: null;
  limitation: null;
  suppressed: true;
  reason: string;
  orgBucket: null;
  smallSample: false;
  quarters: null;
  evidence: [];
};

export type ThemeVisibility = VisibleTheme | SuppressedTheme;

/** The shape Section 13 requires when a theme may not be shown: the reason, and nothing else. */
export function suppressedTheme(theme: ThemeRow): SuppressedTheme {
  return {
    slug: theme.slug,
    title: theme.title,
    offering_slug: theme.offering_slug,
    topic_key: theme.topic_key,
    description: null,
    limitation: null,
    suppressed: true,
    reason: SUPPRESSION_REASON,
    orgBucket: null,
    smallSample: false,
    quarters: null,
    evidence: [],
  };
}

/**
 * The single entry point for showing a theme. Evidence comes from `visibleSharedViews()`, so a
 * suspended or superseded row can never prop a theme up, and the cohort count is computed here alone.
 */
export function themeVisibility(actor: Actor, theme: ThemeRow, filters: ThemeFilters = {}): ThemeVisibility {
  const decision = authorize(actor, "read.theme", { audience: "community" });
  if (!decision.allow) {
    audit(actor, "read.theme", "community", "deny", decision.reason);
    return suppressedTheme(theme);
  }

  const min = cohortMin();
  const distinctOrgs = distinctOrgCount(theme, filters);
  if (distinctOrgs < min) return suppressedTheme(theme);

  const evidence = visibleSharedViews(actor, {
    topic: theme.topic_key,
    offering: theme.offering_slug,
    period: filters.period,
    q: filters.q,
  });

  const quarters = evidence.map((row) => row.period_quarter).sort();
  return {
    slug: theme.slug,
    title: theme.title,
    offering_slug: theme.offering_slug,
    topic_key: theme.topic_key,
    description: theme.description,
    limitation: theme.limitation,
    suppressed: false,
    reason: null,
    orgBucket: orgBucketLabel(min),
    smallSample: distinctOrgs < SMALL_SAMPLE_BELOW,
    quarters: quarters.length ? { from: quarters[0], to: quarters[quarters.length - 1] } : null,
    evidence,
  };
}

/** Every theme, guarded. Used by the themes index and the community feed section. */
export function themeVisibilities(actor: Actor, filters: ThemeFilters = {}): ThemeVisibility[] {
  return themes().map((theme) => themeVisibility(actor, theme, filters));
}

/** One theme by slug, or null when no theme carries that slug. */
export function themeVisibilityBySlug(actor: Actor, slug: string, filters: ThemeFilters = {}): ThemeVisibility | null {
  const theme = themeBySlug(slug);
  return theme ? themeVisibility(actor, theme, filters) : null;
}
