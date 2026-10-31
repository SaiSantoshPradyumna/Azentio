import { ensureSchema, getDb } from "./db";
import { PRODUCTS } from "./seed-data-core";
import { CONTENT_BLOCKS } from "./seed-data-content";

export type ProductRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  summary: string;
};

export type MediaRow = {
  id: string;
  title: string;
};

function dbReady(): boolean {
  ensureSchema();
  const count = (getDb().prepare("SELECT COUNT(*) AS n FROM products").get() as { n: number }).n;
  return count > 0;
}

export function listProducts(): ProductRow[] {
  if (!dbReady()) {
    return PRODUCTS.map((p) => ({ id: `product-${p.slug}`, slug: p.slug, name: p.name, tagline: p.tagline, summary: p.summary }));
  }
  const rows = getDb()
    .prepare("SELECT id, slug, name, tagline, summary FROM products ORDER BY rowid")
    .all() as ProductRow[];
  return rows;
}

export function getProduct(slug: string): ProductRow | null {
  return listProducts().find((p) => p.slug === slug) ?? null;
}

export function getPublicContentBlock(key: string): string | null {
  if (dbReady()) {
    const row = getDb()
      .prepare("SELECT body FROM content_blocks WHERE key = ? AND audience = 'public'")
      .get(key) as { body: string } | undefined;
    if (row) return row.body;
  }
  const block = CONTENT_BLOCKS.find((b) => b.key === key && b.audience === "public");
  return block ? block.body : null;
}

export function listPublicMedia(): MediaRow[] {
  if (!dbReady()) return [];
  return getDb()
    .prepare("SELECT id, title FROM media_assets WHERE audience = 'public' ORDER BY rowid")
    .all() as MediaRow[];
}
