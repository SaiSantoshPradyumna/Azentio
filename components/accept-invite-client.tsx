"use client";

import Link from "next/link";
import { useState } from "react";

export function AcceptInviteClient({
  token,
  signedIn,
  email,
}: {
  token: string;
  signedIn: boolean;
  email: string | null;
}) {
  const [note, setNote] = useState<string | null>(null);

  if (!signedIn) {
    return (
      <div className="card max-w-md">
        <p className="text-sm">Sign in with the invited address first.</p>
        <Link href="/login" className="btn-primary mt-md inline-flex">
          Sign in
        </Link>
      </div>
    );
  }

  async function accept() {
    const res = await fetch("/api/invitations/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const body = await res.json();
    setNote(res.ok ? `${body.notice} Tenant: ${body.tenant_id}` : body.error ?? `HTTP ${res.status}`);
  }

  return (
    <div className="card max-w-md space-y-md">
      <p className="text-sm">
        Signed in as <strong>{email}</strong>
      </p>
      <button type="button" className="btn-primary" onClick={accept}>
        Accept invitation
      </button>
      {note ? (
        <p className="text-sm text-content-muted" role="status">
          {note}
        </p>
      ) : null}
    </div>
  );
}
