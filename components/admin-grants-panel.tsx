"use client";

import { useState } from "react";
import { PLATFORM_PERMISSIONS } from "@/lib/platform-permissions";

type RequestRow = {
  id: string;
  targetEmail: string;
  permission: string;
  requestedByEmail: string;
  status: string;
  approvedByEmail?: string;
};

export function AdminGrantsPanel({
  initialRequests,
  initialGrants,
}: {
  initialRequests: RequestRow[];
  initialGrants: Array<{ email: string; permission: string }>;
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [grants, setGrants] = useState(initialGrants);
  const [email, setEmail] = useState("dev.emp@azentio.com");
  const [permission, setPermission] = useState<string>(PLATFORM_PERMISSIONS[0]);
  const [note, setNote] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/admin/grants");
    const body = await res.json();
    if (res.ok) {
      setRequests(body.requests);
      setGrants(body.grants);
    }
  }

  async function requestGrant(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/grants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "request", email, permission }),
    });
    const body = await res.json();
    setNote(res.ok ? body.notice : body.error);
    if (res.ok) await refresh();
  }

  async function decide(id: string, decision: "approve" | "reject") {
    const res = await fetch("/api/admin/grants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "decide", request_id: id, decision }),
    });
    const body = await res.json();
    setNote(res.ok ? body.notice : body.error);
    if (res.ok) await refresh();
  }

  return (
    <div className="space-y-xl">
      <form onSubmit={requestGrant} className="card max-w-xl space-y-md">
        <h3 className="font-display font-semibold">Request platform grant</h3>
        <p className="text-sm text-content-muted">
          Two different users with <code>platform.role.grant</code> are required (request then approve).
        </p>
        <label className="label" htmlFor="grant-email">
          Employee email
        </label>
        <input id="grant-email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="label" htmlFor="grant-perm">
          Permission
        </label>
        <select id="grant-perm" className="field" value={permission} onChange={(e) => setPermission(e.target.value)}>
          {PLATFORM_PERMISSIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-primary">
          Request
        </button>
      </form>

      {note ? <p className="text-sm text-content-muted">{note}</p> : null}

      <section className="space-y-md">
        <h3 className="font-display text-lg font-semibold">Pending / recent requests</h3>
        <ul className="space-y-sm">
          {requests.map((r) => (
            <li key={r.id} className="card flex flex-wrap items-center justify-between gap-md text-sm">
              <div>
                {r.targetEmail} → <code>{r.permission}</code>
                <p className="text-xs text-content-muted">
                  by {r.requestedByEmail} · {r.status}
                  {r.approvedByEmail ? ` · decided by ${r.approvedByEmail}` : ""}
                </p>
              </div>
              {r.status === "pending" ? (
                <div className="flex gap-sm">
                  <button type="button" className="btn-primary text-xs" onClick={() => decide(r.id, "approve")}>
                    Approve
                  </button>
                  <button type="button" className="btn-secondary text-xs" onClick={() => decide(r.id, "reject")}>
                    Reject
                  </button>
                </div>
              ) : null}
            </li>
          ))}
          {requests.length === 0 ? <li className="text-sm text-content-muted">No requests.</li> : null}
        </ul>
      </section>

      <section className="space-y-md">
        <h3 className="font-display text-lg font-semibold">Current platform grants</h3>
        <ul className="space-y-xs text-sm">
          {grants.map((g) => (
            <li key={`${g.email}:${g.permission}`}>
              {g.email} · <code>{g.permission}</code>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
