import type { Actor } from "./authorize";
import { getDb } from "./db";
import { sharedViewRecord } from "./publish";
import { plainStatus } from "./idea-lifecycle";
import { visibleSharedViewById, visibleSharedViews, type SharedViewDTO } from "./visible";

// Section 14 reads. Two views of the same row live here: the product-owner view, which sees the
// internal priority, the history reasons and every client-facing text, and the client view, which is
// built by clientIdeaDTO() and carries only the title, the plain-language status, the owning team and
// the text a moderator approved. Nothing else has a shape that reaches a client page.
//
// Section 14 also says a client-facing status must be approved by a moderator, and the approved_by
// column is a user id. Rather than invent a pending flag the Section 5 schema does not have, an update
// counts as approved when approved_by names an account that actually holds learning.moderate — so the
// text a product owner writes is invisible to a client until a moderator stands behind it.

export type IdeaRow = {
  id: string;
  title: string;
  problem: string;
  offering_slug: string;
  outcome: string;
  owner_team: string;
  priority: string;
  status: string;
  theme_id: string | null;
  created_by: string;
  updated_at: string;
};

export type IdeaHistoryRow = {
  id: string;
  idea_id: string;
  from_status: string | null;
  to_status: string;
  reason: string;
  actor_id: string;
  actor_email: string;
  at: string;
};

export type IdeaUpdateRow = {
  id: string;
  idea_id: string;
  text: string;
  approved_by: string;
  approved_by_email: string;
  at: string;
  approved: boolean;
};

export type ClientIdea = {
  id: string;
  title: string;
  status_plain: string;
  owner_team: string;
  offering_slug: string;
  approved_text: string | null;
  last_update_at: string | null;
};

const IDEA_SELECT = `SELECT id, title, problem, offering_slug, outcome, owner_team, priority, status, theme_id,
  created_by, updated_at FROM ideas`;

/** The Section 14 approval, expressed as data: the account named in approved_by holds learning.moderate. */
const MODERATOR_APPROVED = `EXISTS (SELECT 1 FROM platform_grants g WHERE g.user_id = u.approved_by AND g.permission = 'learning.moderate')`;

export function getIdea(id: string): IdeaRow | null {
  if (!id) return null;
  return (getDb().prepare(`${IDEA_SELECT} WHERE id = ?`).get(id) as IdeaRow | undefined) ?? null;
}

export type IdeaFilters = { offering?: string; status?: string };

/** Every idea, newest change first. The employee workspace is employee-audience; there is no tenant scope. */
export function listIdeas(filters: IdeaFilters = {}): IdeaRow[] {
  const where: string[] = [];
  const params: string[] = [];
  if (filters.offering?.trim()) {
    where.push("offering_slug = ?");
    params.push(filters.offering.trim());
  }
  if (filters.status?.trim()) {
    where.push("status = ?");
    params.push(filters.status.trim());
  }
  const sql = where.length ? `${IDEA_SELECT} WHERE ${where.join(" AND ")} ORDER BY updated_at DESC, id ASC` : `${IDEA_SELECT} ORDER BY updated_at DESC, id ASC`;
  return getDb().prepare(sql).all(...params) as IdeaRow[];
}

export function ideaCounters(ideaId: string): { grants: number; updates: number; pending: number } {
  const count = (sql: string, ...params: string[]) => (getDb().prepare(sql).get(...params) as { n: number }).n;
  return {
    grants: count("SELECT COUNT(*) AS n FROM idea_evidence_grants WHERE idea_id = ?", ideaId),
    updates: count("SELECT COUNT(*) AS n FROM idea_public_updates WHERE idea_id = ?", ideaId),
    pending: count(
      `SELECT COUNT(*) AS n FROM idea_public_updates u WHERE u.idea_id = ? AND NOT ${MODERATOR_APPROVED}`,
      ideaId,
    ),
  };
}

export function themeTitle(themeId: string | null): string | null {
  if (!themeId) return null;
  const row = getDb().prepare("SELECT title FROM themes WHERE id = ?").get(themeId) as { title: string } | undefined;
  return row ? row.title : null;
}

// --------------------------------------------------------------------------- evidence

export function evidenceGrantIds(ideaId: string): string[] {
  return (
    getDb()
      .prepare("SELECT shared_view_id FROM idea_evidence_grants WHERE idea_id = ? ORDER BY shared_view_id")
      .all(ideaId) as { shared_view_id: string }[]
  ).map((row) => row.shared_view_id);
}

/**
 * The Section 14 limit on the product owner: what this idea may see is exactly what was granted to it,
 * and each grant is read through visible.ts, so a suspended or withdrawn copy drops out of the list
 * instead of being readable another way.
 */
export function ideaEvidence(actor: Actor, ideaId: string): SharedViewDTO[] {
  return evidenceGrantIds(ideaId)
    .map((id) => visibleSharedViewById(actor, id))
    .filter((row): row is SharedViewDTO => row !== null);
}

/** Granted ids that no longer resolve to something the owner may read, with the state the writer sees. */
export function unavailableGrants(ideaId: string, readableIds: string[]): { id: string; state: string }[] {
  return evidenceGrantIds(ideaId)
    .filter((id) => !readableIds.includes(id))
    .map((id) => {
      const record = sharedViewRecord(id);
      return { id, state: record ? record.state : "deleted" };
    });
}

/** Live copies this actor can already see — the only candidates a grant form may offer. */
export function grantableViews(actor: Actor, ideaId: string): SharedViewDTO[] {
  const granted = evidenceGrantIds(ideaId);
  return visibleSharedViews(actor, { limit: 200 }).filter((row) => !granted.includes(row.id));
}

// ------------------------------------------------------------------ internal history

export function ideaHistory(ideaId: string): IdeaHistoryRow[] {
  return getDb()
    .prepare(
      `SELECT h.id, h.idea_id, h.from_status, h.to_status, h.reason, h.actor_id, h.at, u.email AS actor_email
       FROM idea_status_history h JOIN users u ON u.id = h.actor_id
       WHERE h.idea_id = ? ORDER BY h.at DESC, h.rowid DESC`,
    )
    .all(ideaId) as IdeaHistoryRow[];
}

const UPDATE_SELECT = `SELECT u.id, u.idea_id, u.text, u.approved_by, u.at, w.email AS approved_by_email,
  ${MODERATOR_APPROVED} AS approved
  FROM idea_public_updates u JOIN users w ON w.id = u.approved_by`;

type UpdateRecord = Omit<IdeaUpdateRow, "approved"> & { approved: number };

function toUpdateRow(row: UpdateRecord): IdeaUpdateRow {
  return {
    id: row.id,
    idea_id: row.idea_id,
    text: row.text,
    approved_by: row.approved_by,
    approved_by_email: row.approved_by_email,
    at: row.at,
    approved: row.approved === 1,
  };
}

/** Every client-facing text for one idea, newest first, with the approval flag. */
export function ideaUpdates(ideaId: string): IdeaUpdateRow[] {
  const rows = getDb().prepare(`${UPDATE_SELECT} WHERE u.idea_id = ? ORDER BY u.at DESC, u.rowid DESC`).all(ideaId) as UpdateRecord[];
  return rows.map(toUpdateRow);
}

export function getIdeaUpdate(updateId: string): IdeaUpdateRow | null {
  if (!updateId) return null;
  const row = getDb().prepare(`${UPDATE_SELECT} WHERE u.id = ?`).get(updateId) as UpdateRecord | undefined;
  return row ? toUpdateRow(row) : null;
}

/** Approved texts only. This is what a client page is allowed to render. */
export function approvedUpdates(ideaId: string): IdeaUpdateRow[] {
  return ideaUpdates(ideaId).filter((row) => row.approved);
}

export type PendingUpdate = IdeaUpdateRow & { idea_title: string };

/** The moderator's approval queue across all ideas. */
export function pendingUpdates(): PendingUpdate[] {
  const rows = getDb()
    .prepare(
      `SELECT u.id, u.idea_id, u.text, u.approved_by, u.at, w.email AS approved_by_email,
        ${MODERATOR_APPROVED} AS approved, i.title AS idea_title
       FROM idea_public_updates u
       JOIN users w ON w.id = u.approved_by
       JOIN ideas i ON i.id = u.idea_id
       WHERE ${MODERATOR_APPROVED} = 0
       ORDER BY u.at DESC, u.rowid DESC`,
    )
    .all() as (UpdateRecord & { idea_title: string })[];
  return rows.map((row) => ({ ...toUpdateRow(row), idea_title: row.idea_title }));
}

// ----------------------------------------------------------------------- client view

/** The only idea shape a client may receive. It has no priority, no reason and no internal status. */
export function clientIdeaDTO(idea: IdeaRow, latest: IdeaUpdateRow | null): ClientIdea {
  return {
    id: idea.id,
    title: idea.title,
    status_plain: plainStatus(idea.status),
    owner_team: idea.owner_team,
    offering_slug: idea.offering_slug,
    approved_text: latest ? latest.text : null,
    last_update_at: latest ? latest.at : null,
  };
}

/**
 * Ideas for the offerings this organisation holds, in the client shape. The approved text is read from
 * idea_public_updates through approvedUpdates(), so an unapproved proposal can never appear here.
 */
export function clientIdeas(tenantId: string): ClientIdea[] {
  if (!tenantId) return [];
  const rows = getDb()
    .prepare(
      `SELECT i.id, i.title, i.problem, i.offering_slug, i.outcome, i.owner_team, i.priority, i.status, i.theme_id,
        i.created_by, i.updated_at
       FROM ideas i
       JOIN entitlements e ON e.tenant_id = ?
       JOIN products p ON p.id = e.product_id AND p.slug = i.offering_slug
       ORDER BY i.updated_at DESC, i.id ASC`,
    )
    .all(tenantId) as IdeaRow[];

  return rows.map((idea) => {
    const [latest] = approvedUpdates(idea.id);
    return clientIdeaDTO(idea, latest ?? null);
  });
}
