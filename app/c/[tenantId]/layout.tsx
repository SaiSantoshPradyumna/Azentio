import { notFound, redirect } from "next/navigation";
import { ensureSchema, getDb } from "@/lib/db";
import { effectivePermissions } from "@/lib/authorize";
import { protectPage } from "@/lib/portal";

export const metadata = {
  title: "Organisation workspace",
  description: "Client workspace for the active organisation.",
};

function tenantInfo(tenantId: string): { name: string; industry: string; region: string; products: string[] } | null {
  ensureSchema();
  const db = getDb();
  const tenant = db.prepare("SELECT name, industry, region FROM tenants WHERE id = ?").get(tenantId) as
    | { name: string; industry: string; region: string }
    | undefined;
  if (!tenant) return null;
  const products = (
    db
      .prepare(
        `SELECT p.name AS name FROM entitlements e JOIN products p ON p.id = e.product_id WHERE e.tenant_id = ? ORDER BY p.name`,
      )
      .all(tenantId) as { name: string }[]
  ).map((row) => row.name);
  return { ...tenant, products };
}

export default function TenantWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { tenantId: string };
}) {
  // Header/footer/session bar live in app/c/layout.tsx — this layout only guards the tenant segment
  // so nested layouts do not double-render the chrome.
  const access = protectPage("read.client.workspace", `tenant:${params.tenantId}`, `/c/${params.tenantId}`);
  if (!access.ok) {
    if (access.status === "unauthenticated") redirect("/login");
    notFound();
  }

  const info = tenantInfo(params.tenantId);
  if (!info) notFound();

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-md border-b border-line pb-md">
        <div>
          <h1 className="font-display text-3xl font-semibold">{info.name}</h1>
          <p className="mt-xs text-sm text-content-muted">
            {info.industry} · {info.region} · entitled products: {info.products.join(", ") || "none"}
          </p>
        </div>
        <p className="badge">
          {access.actor.clientRole ?? "no client role"} ·{" "}
          {effectivePermissions(access.actor).join(", ") || "no permissions"}
        </p>
      </div>
      <div className="mt-xl">{children}</div>
    </>
  );
}
