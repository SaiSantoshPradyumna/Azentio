// Minimal AIRA retrieval used by the Access Test Runner (full Phase 9 polish later).
// Scores public content blocks and visibleSharedViews by keyword overlap. Never employee or private.

import { getDb } from "./db";
import type { Actor } from "./authorize";
import { visibleSharedViews } from "./visible";

export type AiraSnippet = {
  kind: "shared" | "public_content";
  ref: string;
  title: string;
  text: string;
  score: number;
};

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9\u0600-\u06FF]+/i)
    .filter((t) => t.length > 2);
}

function scoreOverlap(question: string, hay: string): number {
  const q = new Set(tokens(question));
  if (q.size === 0) return 0;
  const h = tokens(hay);
  let hit = 0;
  for (const t of h) if (q.has(t)) hit += 1;
  return hit / q.size;
}

export function askAira(actor: Actor, question: string): { snippets: AiraSnippet[]; notice: string } {
  const snippets: AiraSnippet[] = [];

  const publicBlocks = getDb()
    .prepare("SELECT key, body FROM content_blocks WHERE audience = 'public'")
    .all() as { key: string; body: string }[];

  for (const block of publicBlocks) {
    const score = scoreOverlap(question, `${block.key} ${block.body}`);
    if (score > 0) {
      snippets.push({
        kind: "public_content",
        ref: block.key,
        title: block.key,
        text: block.body,
        score,
      });
    }
  }

  if (actor) {
    const views = visibleSharedViews(actor, {});
    for (const view of views) {
      const score = scoreOverlap(question, `${view.title} ${view.summary} ${view.topic}`);
      if (score > 0) {
        snippets.push({
          kind: "shared",
          ref: view.id,
          title: view.title,
          text: view.summary,
          score,
        });
      }
    }
  }

  snippets.sort((a, b) => b.score - a.score);
  return {
    snippets: snippets.slice(0, 3),
    notice:
      "Deterministic keyword retrieval over public blocks and de-identified shared learning only. No employee or private content. No cache. No training programme is enabled.",
  };
}
