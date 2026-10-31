"use client";

import { useState } from "react";

export function ContentPublisher({
  initialBanner,
  canPublish,
}: {
  initialBanner: string;
  canPublish: boolean;
}) {
  const [body, setBody] = useState(initialBanner);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!canPublish) {
    return (
      <div className="card border-dashed" role="status">
        <p className="font-semibold">Publisher locked</p>
        <p className="mt-sm text-sm text-content-muted">
          Editing banners needs <code>content.publish</code>. An employee without that grant receives 403 from{" "}
          <code>PUT /api/content/home.banner</code> — the attempt is audited.
        </p>
      </div>
    );
  }

  async function save() {
    setBusy(true);
    setNote(null);
    const res = await fetch("/api/content/home.banner", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    const data = await res.json();
    setNote(res.ok ? data.notice : data.error ?? `HTTP ${res.status}`);
    setBusy(false);
  }

  return (
    <div className="card space-y-md max-w-2xl">
      <label className="label" htmlFor="banner">
        Public home banner (<code>home.banner</code>)
      </label>
      <textarea id="banner" className="field" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
      <button type="button" className="btn-primary" onClick={save} disabled={busy}>
        {busy ? "Saving…" : "Save banner"}
      </button>
      {note ? (
        <p className="text-sm text-content-muted" role="status">
          {note}
        </p>
      ) : null}
    </div>
  );
}
