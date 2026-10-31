"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Membership } from "@/lib/session";

/**
 * Section 18 header control, shown only to multi-membership accounts. The tenant id it posts is a
 * target, not authority: the server verifies the session user's membership before it changes the
 * session row (Section 6 and 7.5).
 */
export function WorkspaceSwitcher({
  memberships,
  activeTenantId,
}: {
  memberships: Membership[];
  activeTenantId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSwitch(tenantId: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/workspaces/switch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      if (!response.ok) throw new Error("That organisation is not available to this session.");
      setOpen(false);
      router.push(`/c/${tenantId}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not switch organisation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="btn-secondary text-sm"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="workspace-panel"
      >
        <span aria-hidden="true">🔁</span> Switch organisation
      </button>

      {open ? (
        <div id="workspace-panel" className="card absolute right-0 z-20 mt-sm w-[min(20rem,90vw)] text-left">
          <p className="text-xs text-content-muted" aria-live="polite">
            {error ?? "Your account belongs to more than one organisation. One is active per session."}
          </p>
          <ul className="mt-sm space-y-sm">
            {memberships.map((membership) => (
              <li key={membership.tenantId} className="flex items-center justify-between gap-sm">
                <span className="text-sm">
                  {membership.tenantName}
                  <span className="ml-xs text-xs text-content-muted">
                    {membership.role}
                    {membership.tenantId === activeTenantId ? " · active" : ""}
                  </span>
                </span>
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  disabled={busy || membership.tenantId === activeTenantId}
                  onClick={() => onSwitch(membership.tenantId)}
                >
                  {membership.tenantId === activeTenantId ? "Active" : "Switch"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
