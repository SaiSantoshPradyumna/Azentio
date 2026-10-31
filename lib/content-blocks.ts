import { getDb, nowIso, uuid } from "./db";
import type { Actor } from "./authorize";
import { audit } from "./audit";

export type ContentBlock = {
  id: string;
  key: string;
  body: string;
  audience: string;
};

export function getContentBlock(key: string): ContentBlock | null {
  const row = getDb()
    .prepare("SELECT id, key, body, audience FROM content_blocks WHERE key = ?")
    .get(key) as ContentBlock | undefined;
  return row ?? null;
}

export function listContentBlocks(): ContentBlock[] {
  return getDb()
    .prepare("SELECT id, key, body, audience FROM content_blocks ORDER BY key")
    .all() as ContentBlock[];
}

export function updateContentBlock(
  actor: NonNullable<Actor>,
  key: string,
  body: string,
): { ok: true; block: ContentBlock } | { ok: false; status: 404; reason: string } {
  const existing = getContentBlock(key);
  if (!existing) return { ok: false, status: 404, reason: "content block not found" };

  const trimmed = body.trim();
  getDb().prepare("UPDATE content_blocks SET body = ? WHERE key = ?").run(trimmed, key);
  const block = getContentBlock(key)!;
  audit(actor, "content.update", existing.audience, "allow", `updated ${key} at ${nowIso()}`);
  return { ok: true, block };
}

/** Ensure a block exists (publisher may create banner text under a known key). */
export function upsertPublicBanner(actor: NonNullable<Actor>, body: string): ContentBlock {
  const key = "home.banner";
  const existing = getContentBlock(key);
  const trimmed = body.trim();
  if (existing) {
    getDb().prepare("UPDATE content_blocks SET body = ? WHERE key = ?").run(trimmed, key);
  } else {
    getDb()
      .prepare("INSERT INTO content_blocks (id, key, body, audience) VALUES (?, ?, ?, 'public')")
      .run(uuid(), key, trimmed);
  }
  audit(actor, "content.update", "public", "allow", `upsert ${key}`);
  return getContentBlock(key)!;
}
