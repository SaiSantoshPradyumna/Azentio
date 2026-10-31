import { getDb } from "./db";
import type { Actor } from "./authorize";
import type { SharingChoice } from "./contribution-schema";
import type { ContributionState } from "./lifecycle";

export type ContributionRow = {
  id: string;
  tenant_id: string;
  author_id: string;
  type: string;
  title: string;
  body: string;
  topic: string;
  offering_slug: string;
  industry: string;
  region: string;
  period: string;
  evidence_type: string;
  confidence: string;
  sharing_choice: SharingChoice;
  attribution_requested: number;
  state: ContributionState;
  version: number;
  created_at: string;
  updated_at: string;
};

export type Author = NonNullable<Actor>;

export type OpResult = { ok: true; row: ContributionRow } | { ok: false; status: 403 | 404 | 409; reason: string };

const SELECT = `SELECT id, tenant_id, author_id, type, title, body, topic, offering_slug, industry, region, period,
  evidence_type, confidence, sharing_choice, attribution_requested, state, version, created_at, updated_at
  FROM contributions`;

export function getContribution(id: string): ContributionRow | null {
  return (getDb().prepare(`${SELECT} WHERE id = ?`).get(id) as ContributionRow | undefined) ?? null;
}

export function isOrgAdmin(actor: Author): boolean {
  return actor.clientRole === "client_admin";
}

export function isEntitled(tenantId: string, slug: string): boolean {
  const row = getDb()
    .prepare(
      `SELECT 1 AS ok FROM entitlements e JOIN products p ON p.id = e.product_id
       WHERE e.tenant_id = ? AND p.slug = ?`,
    )
    .get(tenantId, slug) as { ok: number } | undefined;
  return !!row;
}

/** Offerings this organisation may file observations against — read from entitlements, never from the request. */
export function entitledOfferings(tenantId: string): { slug: string; name: string }[] {
  return getDb()
    .prepare(
      `SELECT p.slug AS slug, p.name AS name FROM entitlements e JOIN products p ON p.id = e.product_id
       WHERE e.tenant_id = ? ORDER BY p.name`,
    )
    .all(tenantId) as { slug: string; name: string }[];
}

/** Section 9: a draft is private to the author unless it was saved for the organisation. */
export function canReadContribution(actor: Author, row: ContributionRow): boolean {
  if (row.tenant_id !== actor.activeTenantId) return false;
  if (row.author_id === actor.userId) return true;
  if (row.state === "Draft") return row.sharing_choice === "organisation";
  if (row.state === "Withdrawn" || row.state === "Rejected") return false;
  return true;
}

export function listContributions(actor: Author, tab: "mine" | "org"): ContributionRow[] {
  if (!actor.activeTenantId) return [];
  const rows = getDb()
    .prepare(`${SELECT} WHERE tenant_id = ? ORDER BY updated_at DESC, created_at DESC`)
    .all(actor.activeTenantId) as ContributionRow[];
  if (tab === "mine") return rows.filter((row) => row.author_id === actor.userId);
  return rows.filter((row) => canReadContribution(actor, row));
}

export function statusCounts(rows: ContributionRow[]): Partial<Record<ContributionState, number>> {
  const counts: Partial<Record<ContributionState, number>> = {};
  for (const row of rows) counts[row.state] = (counts[row.state] ?? 0) + 1;
  return counts;
}

/** The `[id]` route segment, flattened. */
export function recordId(params: Record<string, string | string[]>): string {
  const raw = params.id;
  return Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
}

/**
 * Audience for a record-scoped route: the owning tenant read from the database row, or null when no
 * such row exists. The request never supplies a tenant (Section 7.4 and 7.5).
 */
export function ownerAudienceOf(params: Record<string, string | string[]>): string | null {
  const row = getContribution(recordId(params));
  return row ? `tenant:${row.tenant_id}` : null;
}

/**
 * The payload a caller may see. `body` is the author's private source text and is included only for
 * the author; the de-identified shared artifact is built by the publishing phase.
 */
export function contributionDTO(row: ContributionRow, viewerId: string): Record<string, unknown> {
  const mine = row.author_id === viewerId;
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    topic: row.topic,
    offering_slug: row.offering_slug,
    industry: row.industry,
    region: row.region,
    period: row.period,
    evidence_type: row.evidence_type,
    confidence: row.confidence,
    sharing_choice: row.sharing_choice,
    attribution_requested: row.attribution_requested === 1,
    state: row.state,
    version: row.version,
    created_at: row.created_at,
    updated_at: row.updated_at,
    mine,
    body: mine ? row.body : null,
  };
}
