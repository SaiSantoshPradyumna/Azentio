"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Membership } from "@/lib/session";

export function WorkspacePicker({
  memberships,
  activeTenantId,
}: {
  memberships: Membership[];
  activeTenantId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onChoose(tenantId: string) {
    setBusy(tenantId);
    setError(null);
    try {
      const response = await fetch("/api/workspaces/switch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Could not switch organisation");
      }
      router.push(`/c/${tenantId}`);
      router.refresh();
      return;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not switch organisation");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-xl">
      <ul className="space-y-md">
        {memberships.map((membership) => (
          <li key={membership.tenantId} className="card flex flex-wrap items-center justify-between gap-md">
            <div>
              <p className="font-semibold text-content">{membership.tenantName}</p>
              <p className="mt-xs text-sm text-content-muted">
                Role {membership.role}
                {membership.tenantId === activeTenantId ? " · active" : ""}
              </p>
            </div>
            <button
              type="button"
              className={membership.tenantId === activeTenantId ? "btn-secondary text-sm" : "btn-primary text-sm"}
              onClick={() => onChoose(membership.tenantId)}
              disabled={busy !== null}
            >
              {busy === membership.tenantId ? "Switching…" : membership.tenantId === activeTenantId ? "Open" : "Make active"}
            </button>
          </li>
        ))}
      </ul>
      <p aria-live="polite" className="mt-md text-sm">
        {error ? <span className="text-warning">{error}</span> : null}
      </p>
    </div>
  );
}
