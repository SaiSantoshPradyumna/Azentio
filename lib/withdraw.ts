import { getDb, nowIso } from "./db";
import { audit } from "./audit";
import { notify } from "./notify";
import { canTransition, transitionRule } from "./lifecycle";
import { themeVisibility, themes, type ThemeRow } from "./cohort";
import { visibleSharedViewById, visibleSharedViews } from "./visible";
import { getContribution, isOrgAdmin, type Author, type ContributionRow } from "./contributions";

// Section 12. One transaction takes the contribution out of every reader at once: the state, the live
// shared views, the evidence grants that pointed at them and the visibility epoch. Themes, counts and
// the feed are computed at read time from ./visible, so purging those rows is the whole job — there is
// no search index, no embedding store and no response cache to invalidate.

export type WithdrawalChecks = {
  search: boolean;
  feed: boolean;
  theme: boolean;
  aira: boolean;
};

export type WithdrawalClock = {
  elapsedMs: number;
  checks: WithdrawalChecks;
};

export type WithdrawResult =
  | { ok: true; row: ContributionRow; clock: WithdrawalClock | null }
  | { ok: false; status: 403 | 404 | 409; reason: string };

const SELECT_AFFECTED = `SELECT id, title FROM shared_views WHERE contribution_id = ? ORDER BY published_at DESC, rowid DESC`;

/** The rows the purge is about to remove, captured before the delete so the clock can look for them. */
function affectedSharedViews(contributionId: string): { ids: string[]; titles: string[] } {
  const rows = getDb().prepare(SELECT_AFFECTED).all(contributionId) as { id: string; title: string }[];
  return { ids: rows.map((row) => row.id), titles: rows.map((row) => row.title) };
}

/** Ideas whose evidence pointed at the deleted views. Read before the grants are removed. */
function affectedIdeaOwners(viewIds: string[]): { ideaId: string; ideaTitle: string; ownerId: string }[] {
  if (viewIds.length === 0) return [];
  const placeholders = viewIds.map(() => "?").join(",");
  return getDb()
    .prepare(
      `SELECT DISTINCT i.id AS ideaId, i.title AS ideaTitle, i.created_by AS ownerId
       FROM ideas i JOIN idea_evidence_grants g ON g.idea_id = i.id
       WHERE g.shared_view_id IN (${placeholders})`,
    )
    .all(...viewIds) as { ideaId: string; ideaTitle: string; ownerId: string }[];
}

export function withdrawContribution(actor: Author, contributionId: string): WithdrawResult {
  const row = getContribution(contributionId);
  if (!row || row.tenant_id !== actor.activeTenantId) return { ok: false, status: 404, reason: "not found" };

  const rule = transitionRule(row.state, "Withdrawn");
  if (!rule || !canTransition(row.state, "Withdrawn")) {
    return { ok: false, status: 409, reason: `cannot withdraw an item in state ${row.state}` };
  }

  const isAuthor = row.author_id === actor.userId;
  if (!isAuthor && !(isOrgAdmin(actor) && rule.actor === "author-or-org-admin")) {
    return { ok: false, status: 403, reason: "only the author or an organisation admin can withdraw this item" };
  }

  const stamp = Date.now();
  let viewIds: string[] = [];
  let titles: string[] = [];

  // better-sqlite3 rolls the whole block back if any statement throws, so a half-purged item is not
  // possible: either the shared views and their grants are gone, or nothing moved.
  const purge = getDb().transaction(() => {
    const affected = affectedSharedViews(row.id);
    viewIds = affected.ids;
    titles = affected.titles;
    const owners = affectedIdeaOwners(viewIds);

    getDb().prepare("UPDATE contributions SET state = 'Withdrawn', updated_at = ? WHERE id = ?").run(nowIso(), row.id);
    getDb().prepare("DELETE FROM shared_views WHERE contribution_id = ?").run(row.id);
    if (viewIds.length > 0) {
      const placeholders = viewIds.map(() => "?").join(",");
      getDb().prepare(`DELETE FROM idea_evidence_grants WHERE shared_view_id IN (${placeholders})`).run(...viewIds);
    }
    bumpVisibilityEpoch();

    // The author is told even when an organisation admin pulled the item, because it is their record.
    const ownAction = row.author_id === actor.userId;
    notify(
      row.author_id,
      "contribution.withdrawn",
      ownAction
        ? `Your observation "${row.title}" is withdrawn.`
        : `An organisation admin withdrew your observation "${row.title}".`,
      `withdrawn-${row.id}-${stamp}`,
    );
    for (const owner of owners) {
      notify(
        owner.ownerId,
        "idea.evidence_withdrawn",
        `An organisation withdrew the observation behind the evidence for "${owner.ideaTitle}". That idea now rests on fewer independent organisations.`,
        `evidence-withdrawn-${row.id}-${owner.ideaId}-${stamp}`,
      );
    }
  });
  purge();

  audit(
    actor,
    "contribution.withdraw",
    `tenant:${row.tenant_id}`,
    "allow",
    `${row.state} to Withdrawn, ${viewIds.length} shared view(s) purged, evidence grants removed, visibility epoch incremented`,
  );

  const finalRow = getContribution(row.id)!;
  return { ok: true, row: finalRow, clock: viewIds.length ? withdrawalClock(actor, finalRow, viewIds, titles) : null };
}

function bumpVisibilityEpoch(): void {
  const result = getDb()
    .prepare("UPDATE config SET value = CAST(value AS INTEGER) + 1 WHERE key = 'visibility_epoch'")
    .run();
  if (result.changes === 0) getDb().prepare("INSERT INTO config (key, value) VALUES ('visibility_epoch', '1')").run();
}

/** The stored counter, read by the moderation console and the admin pages. */
export function visibilityEpoch(): number {
  const row = getDb().prepare("SELECT value FROM config WHERE key = 'visibility_epoch'").get() as { value: string } | undefined;
  return row ? Number.parseInt(row.value, 10) : 0;
}

/**
 * The withdrawal clock (Section 12). Re-queried after the commit, through the same readers a user
 * reaches: the feed, the search filter, the theme guard and the pool AIRA cites from. `true` means the
 * item is no longer present. Nothing is cached, so the answer is the same one a page would render.
 */
export function withdrawalClock(actor: Author, row: ContributionRow, viewIds: string[], titles: string[]): WithdrawalClock {
  const started = performance.now();

  const feedGone = viewIds.every((id) => visibleSharedViewById(actor, id) === null);
  const searchGone = titles.every(
    (title) => visibleSharedViews(actor, { q: title, limit: 200 }).every((item) => !viewIds.includes(item.id)),
  );

  const themeGone = themes()
    .filter((theme) => theme.topic_key === row.topic && theme.offering_slug === row.offering_slug)
    .every((theme) => !themeStillCites(actor, theme, viewIds));

  // AIRA's citation pool is the visible shared views plus the public content blocks it may quote. The
  // answerer itself is Phase 9; this is the pool it will be built on.
  const airaGone = feedGone && searchGone && !publicTextMentions(row.id, titles);

  const elapsedMs = Math.round((performance.now() - started) * 1000) / 1000;
  return { elapsedMs, checks: { search: searchGone, feed: feedGone, theme: themeGone, aira: airaGone } };
}

function themeStillCites(actor: Author, theme: ThemeRow, viewIds: string[]): boolean {
  const visibility = themeVisibility(actor, theme);
  if (visibility.suppressed) return false;
  return visibility.evidence.some((item) => viewIds.includes(item.id));
}

/** Public marketing copy must not still describe a withdrawn record as current evidence. */
function publicTextMentions(contributionId: string, titles: string[]): boolean {
  const rows = getDb().prepare("SELECT body FROM content_blocks WHERE audience = 'public'").all() as { body: string }[];
  const needles = [contributionId, ...titles];
  return rows.some((row) => needles.some((needle) => needle && row.body.includes(needle)));
}
