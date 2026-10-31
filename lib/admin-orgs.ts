import { getDb, nowIso, uuid } from "./db";
import type { Actor } from "./authorize";
import { audit } from "./audit";

export type TenantRow = {
  id: string;
  name: string;
  industry: string;
  region: string;
  status: string;
};

export function listOrgs(): Array<TenantRow & { entitlements: string[] }> {
  const db = getDb();
  const tenants = db
    .prepare("SELECT id, name, industry, region, status FROM tenants ORDER BY name")
    .all() as TenantRow[];
  return tenants.map((t) => {
    const entitlements = db
      .prepare(
        `SELECT p.slug FROM entitlements e JOIN products p ON p.id = e.product_id WHERE e.tenant_id = ? ORDER BY p.slug`,
      )
      .all(t.id) as { slug: string }[];
    return { ...t, entitlements: entitlements.map((e) => e.slug) };
  });
}

export function createOrg(
  actor: NonNullable<Actor>,
  input: { name: string; industry: string; region: string },
): { ok: true; org: TenantRow } | { ok: false; status: 400; reason: string } {
  const name = input.name.trim();
  const industry = input.industry.trim();
  const region = input.region.trim();
  if (name.length < 2) return { ok: false, status: 400, reason: "organisation name is required" };
  if (!industry || !region) return { ok: false, status: 400, reason: "industry and region are required" };

  const id = `tenant-${uuid().slice(0, 8)}`;
  getDb()
    .prepare("INSERT INTO tenants (id, name, industry, region, status) VALUES (?, ?, ?, ?, 'active')")
    .run(id, name, industry, region);
  const org = getDb().prepare("SELECT * FROM tenants WHERE id = ?").get(id) as TenantRow;
  audit(actor, "org.manage", "employee", "allow", `created org ${id}`);
  return { ok: true, org };
}

export function setEntitlement(
  actor: NonNullable<Actor>,
  tenantId: string,
  productSlug: string,
  entitled: boolean,
): { ok: true } | { ok: false; status: 404; reason: string } {
  const db = getDb();
  const tenant = db.prepare("SELECT id FROM tenants WHERE id = ?").get(tenantId) as { id: string } | undefined;
  const product = db.prepare("SELECT id FROM products WHERE slug = ?").get(productSlug) as { id: string } | undefined;
  if (!tenant || !product) return { ok: false, status: 404, reason: "organisation or product not found" };

  if (entitled) {
    db.prepare("INSERT OR IGNORE INTO entitlements (tenant_id, product_id) VALUES (?, ?)").run(tenantId, product.id);
  } else {
    db.prepare("DELETE FROM entitlements WHERE tenant_id = ? AND product_id = ?").run(tenantId, product.id);
  }
  audit(
    actor,
    "org.manage",
    "employee",
    "allow",
    `${entitled ? "granted" : "revoked"} ${productSlug} for ${tenantId} at ${nowIso()}`,
  );
  return { ok: true };
}

export function listProducts(): Array<{ id: string; slug: string; name: string }> {
  return getDb()
    .prepare("SELECT id, slug, name FROM products ORDER BY name")
    .all() as Array<{ id: string; slug: string; name: string }>;
}
