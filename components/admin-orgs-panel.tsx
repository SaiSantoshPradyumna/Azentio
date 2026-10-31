"use client";

import { useState } from "react";

type Org = {
  id: string;
  name: string;
  industry: string;
  region: string;
  status: string;
  entitlements: string[];
};

type Product = { id: string; slug: string; name: string };

export function AdminOrgsPanel({ initialOrgs, products }: { initialOrgs: Org[]; products: Product[] }) {
  const [orgs, setOrgs] = useState(initialOrgs);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("Bank");
  const [region, setRegion] = useState("Dubai");
  const [note, setNote] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/admin/orgs");
    const body = await res.json();
    if (res.ok) setOrgs(body.items);
  }

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/orgs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "create", name, industry, region }),
    });
    const body = await res.json();
    setNote(res.ok ? body.notice : body.error);
    if (res.ok) {
      setName("");
      await refresh();
    }
  }

  async function toggle(tenantId: string, slug: string, entitled: boolean) {
    const res = await fetch("/api/admin/orgs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "entitlement", tenant_id: tenantId, product_slug: slug, entitled }),
    });
    const body = await res.json();
    setNote(res.ok ? body.notice : body.error);
    if (res.ok) await refresh();
  }

  return (
    <div className="space-y-xl">
      <form onSubmit={createOrg} className="card max-w-xl space-y-md">
        <h3 className="font-display font-semibold">Create organisation</h3>
        <label className="label" htmlFor="org-name">
          Name
        </label>
        <input id="org-name" className="field" value={name} onChange={(e) => setName(e.target.value)} required />
        <label className="label" htmlFor="org-industry">
          Industry
        </label>
        <input id="org-industry" className="field" value={industry} onChange={(e) => setIndustry(e.target.value)} />
        <label className="label" htmlFor="org-region">
          Region
        </label>
        <input id="org-region" className="field" value={region} onChange={(e) => setRegion(e.target.value)} />
        <button type="submit" className="btn-primary">
          Create
        </button>
      </form>

      {note ? <p className="text-sm text-content-muted">{note}</p> : null}

      <ul className="space-y-md">
        {orgs.map((org) => (
          <li key={org.id} className="card space-y-sm">
            <div className="flex flex-wrap justify-between gap-md">
              <div>
                <p className="font-semibold">{org.name}</p>
                <p className="text-xs text-content-muted">
                  {org.id} · {org.industry} · {org.region} · {org.status}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-sm">
              {products.map((p) => {
                const on = org.entitlements.includes(p.slug);
                return (
                  <button
                    key={p.slug}
                    type="button"
                    className={on ? "btn-primary text-xs" : "btn-secondary text-xs"}
                    onClick={() => toggle(org.id, p.slug, !on)}
                  >
                    {p.slug}
                    {on ? " ✓" : ""}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
