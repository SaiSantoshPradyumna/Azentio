"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Section 17: a reader of a shared item can report it. The report opens against the shared copy the
 * reader can actually see; that copy is suspended straight away, so it leaves the feed, search, export
 * and theme evidence while the report is open. Nothing is emailed — the report and the suspension are
 * stored, the author is notified in the app, and a moderator decides whether the copy comes back.
 */
export function SharedItemReport({ sharedViewId, title }: { sharedViewId: string; title: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shared_view_id: sharedViewId, reason }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string; notice?: string } | null;
      setMessage(response.ok ? (data?.notice ?? "Reported.") : (data?.error ?? "The request failed."));
      if (response.ok) {
        setOpen(false);
        setReason("");
        router.refresh();
      }
    } catch {
      setMessage("The request did not complete. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-sm border-t border-line pt-sm">
      {message ? (
        <p aria-live="polite" className="text-sm text-content-muted">
          {message}
        </p>
      ) : null}

      {open ? (
        <form onSubmit={submit} className="space-y-sm">
          <label className="block text-sm">
            <span className="text-content-muted">What is wrong with “{title}”?</span>
            <textarea
              className="mt-xs min-h-20 w-full rounded-card border border-line bg-surface px-sm py-xs text-sm"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
              minLength={5}
              maxLength={500}
              disabled={busy}
            />
          </label>
          <div className="flex flex-wrap gap-md">
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? "Sending…" : "Send report"}
            </button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
          <p className="text-xs text-content-muted">
            Your report goes to the moderation queue with your account attached, and this shared copy is hidden from the
            feed at once. The author&rsquo;s own record and their private text are untouched; only a moderator puts the
            copy back. Nothing is emailed.
          </p>
        </form>
      ) : (
        <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>
          Report this item
        </button>
      )}
    </div>
  );
}
