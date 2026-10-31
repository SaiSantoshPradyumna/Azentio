import { authorize, type Actor } from "./authorize";
import { audit } from "./audit";
import { getDb } from "./db";
import { coarseQuarter } from "./scanner";

// Section 8: the ONLY reader of shared content. Search, the feed, counts, suggestions, exports, theme
// evidence and AIRA all call visibleSharedViews(); nothing else may SELECT from shared_views except
// lib/publish.ts, lib/withdraw.ts and lib/cohort.ts, which write rather than show. lib/view-state.ts
// moves the live/suspended flag a report or a moderator decision needs, and never reads a row back.

export type SharedViewDTO = {
  id: string;
  title: string;
  summary: string;
  topic: string;
  offering_slug: string;
  industry: string;
  region_coarse: string;
  period_quarter: string;
  evidence_type: string;
  confidence: string;
  attribution: string | null;
  published_at: string;
};

/** Exactly the fields Section 8 allows, in that order. Used by the DTO builder and by the tests. */
export const SHARED_VIEW_DTO_KEYS = [
  "id",
  "title",
  "summary",
  "topic",
  "offering_slug",
  "industry",
  "region_coarse",
  "period_quarter",
  "evidence_type",
  "confidence",
  "attribution",
  "published_at",
] as const;

/**
 * Fields that must never appear in a shared payload. Asserted against every response of every shared
 * endpoint in tests/visible.test.ts.
 */
export const FORBIDDEN_SHARED_KEYS = [
  "contribution_id",
  "tenant",
  "tenant_id",
  "author",
  "author_id",
  "internal_note",
  "notes",
  "note",
  "attachments",
  "attachment",
  "body",
  "moderator_id",
  "reporter_user_id",
] as const;

export type SharedViewFilters = {
  offering?: string;
  industry?: string;
  region?: string;
  period?: string;
  topic?: string;
  q?: string;
  limit?: number;
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const SELECT = `SELECT id, title, summary, topic, offering_slug, industry, region_coarse, period_quarter,
  evidence_type, confidence, attribution, published_at
  FROM shared_views WHERE state = 'live'`;

/** Escapes a user-supplied substring for a LIKE comparison. */
function likeValue(q: string): string {
  return `%${q.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

/** A period filter may arrive as `YYYY-MM` (the author's field) or already as `YYYY-Qn` (the feed chip). */
function quarterFilter(value: string): string {
  return /^\d{4}-Q[1-4]$/.test(value) ? value : coarseQuarter(value);
}

/**
 * Query string to filters. Every value is matched against the visible set, so an unrecognised filter
 * simply returns nothing instead of widening access.
 */
export function filtersFromParams(params: URLSearchParams): SharedViewFilters {
  const limitRaw = Number.parseInt(params.get("limit") ?? "", 10);
  return {
    offering: params.get("offering") ?? undefined,
    industry: params.get("industry") ?? undefined,
    region: params.get("region") ?? undefined,
    period: params.get("period") ?? undefined,
    topic: params.get("topic") ?? undefined,
    q: params.get("q") ?? undefined,
    limit: Number.isFinite(limitRaw) ? limitRaw : undefined,
  };
}

/**
 * Authorises `community` read first (Section 8). An unauthorised actor gets an empty array and the
 * denial is audited, so the reader is safe even when a caller forgets its own guard.
 */
export function visibleSharedViews(actor: Actor, filters: SharedViewFilters = {}): SharedViewDTO[] {
  const decision = authorize(actor, "read.shared", { audience: "community" });
  if (!decision.allow) {
    audit(actor, "read.shared", "community", "deny", decision.reason);
    return [];
  }

  const where: string[] = [];
  const params: (string | number)[] = [];

  const eq = (column: string, value: string | undefined) => {
    if (!value) return;
    where.push(`${column} = ?`);
    params.push(value);
  };

  eq("offering_slug", filters.offering?.trim());
  eq("industry", filters.industry?.trim());
  eq("region_coarse", filters.region?.trim());
  eq("topic", filters.topic?.trim());
  if (filters.period?.trim()) eq("period_quarter", quarterFilter(filters.period.trim()));

  const q = filters.q?.trim();
  if (q) {
    // Section 8: substring match on title, summary and topic, case-insensitive.
    where.push("(lower(title) LIKE ? ESCAPE '\\' OR lower(summary) LIKE ? ESCAPE '\\' OR lower(topic) LIKE ? ESCAPE '\\')");
    const needle = likeValue(q.toLowerCase());
    params.push(needle, needle, needle);
  }

  const limit = Math.min(Math.max(1, Math.floor(filters.limit ?? DEFAULT_LIMIT)), MAX_LIMIT);
  const sql = `${where.length ? `${SELECT} AND ${where.join(" AND ")}` : SELECT} ORDER BY published_at DESC, id ASC LIMIT ?`;

  const rows = getDb()
    .prepare(sql)
    .all(...params, limit) as SharedViewDTO[];

  return rows.map((row) => {
    const dto: SharedViewDTO = {
      id: row.id,
      title: row.title,
      summary: row.summary,
      topic: row.topic,
      offering_slug: row.offering_slug,
      industry: row.industry,
      region_coarse: row.region_coarse,
      period_quarter: row.period_quarter,
      evidence_type: row.evidence_type,
      confidence: row.confidence,
      attribution: row.attribution,
      published_at: row.published_at,
    };
    return dto;
  });
}

/** One row by shared-view id, through the same gate and the same column list. */
export function visibleSharedViewById(actor: Actor, id: string): SharedViewDTO | null {
  if (!id) return null;
  return visibleSharedViews(actor, { limit: MAX_LIMIT }).find((row) => row.id === id) ?? null;
}

export type SharedViewFacets = {
  offerings: string[];
  industries: string[];
  regions: string[];
  periods: string[];
  topics: string[];
};

/**
 * Filter choices are derived from what the actor can already see, so the form cannot offer a facet
 * that would probe for content outside the visible set.
 */
export function visibleFacets(actor: Actor): SharedViewFacets {
  const rows = visibleSharedViews(actor, { limit: MAX_LIMIT });
  const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b));
  return {
    offerings: unique(rows.map((row) => row.offering_slug)),
    industries: unique(rows.map((row) => row.industry)),
    regions: unique(rows.map((row) => row.region_coarse)),
    periods: unique(rows.map((row) => row.period_quarter)),
    topics: unique(rows.map((row) => row.topic)),
  };
}
