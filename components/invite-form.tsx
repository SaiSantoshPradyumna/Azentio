"use client";

import { useState } from "react";

export function InviteForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("contributor");
  const [note, setNote] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setNote(null);
    setLink(null);
    const res = await fetch("/api/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, client_role: role }),
    });
    const body = await res.json();
    if (!res.ok) {
      setNote(body.error ?? `HTTP ${res.status}`);
      return;
    }
    setNote(body.notice);
    setLink(body.accept_path ?? null);
  }

  return (
    <form onSubmit={submit} className="card space-y-md max-w-xl">
      <h3 className="font-display font-semibold">Invite a colleague</h3>
      <p className="text-sm text-content-muted">
        Client roles only: client_admin, contributor, viewer. A role such as <code>moderator</code> is refused (400/403).
        The link is shown here and queued in the Dev outbox — nothing is emailed.
      </p>
      <label className="label" htmlFor="invite-email">
        Email
      </label>
      <input
        id="invite-email"
        className="field"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <label className="label" htmlFor="invite-role">
        Client role
      </label>
      <select id="invite-role" className="field" value={role} onChange={(e) => setRole(e.target.value)}>
        <option value="client_admin">client_admin</option>
        <option value="contributor">contributor</option>
        <option value="viewer">viewer</option>
      </select>
      <button type="submit" className="btn-primary">
        Create invitation
      </button>
      {note ? (
        <p className="text-sm text-content-muted" role="status">
          {note}
        </p>
      ) : null}
      {link ? (
        <p className="text-sm">
          Accept path: <code>{link}</code>
        </p>
      ) : null}
    </form>
  );
}
