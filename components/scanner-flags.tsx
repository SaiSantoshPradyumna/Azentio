"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FLAG_LABELS, FLAG_WHY, type FlagKind } from "@/lib/scanner";

export type FlagView = { id: string; kind: string; snippet: string; resolved: boolean };

const RESOLUTIONS: { value: "redacted" | "not_sensitive"; label: string }[] = [
  { value: "redacted", label: "Redaction applied" },
  { value: "not_sensitive", label: "Reviewed, not sensitive" },
];

/**
 * Section 10.1: the scan is a hint. Each hint stays on the screen until a moderator closes it with a
 * recorded decision, and an open hint is what keeps publishing blocked.
 */
export function ScannerFlags({ flags, reviewable }: { flags: FlagView[]; reviewable: boolean }) {
  const unresolved = flags.filter((flag) => !flag.resolved).length;

  return (
    <section className="card space-y-md" aria-labelledby="scanner-flags">
      <h2 id="scanner-flags" className="font-display text-lg font-semibold">
        Scanner hints
      </h2>
      <p className="badge">
        <span aria-hidden="true">⚠</span> {unresolved === 0 ? "No open hints" : `${unresolved} open hint(s) — publishing is blocked`}
      </p>

      {flags.length === 0 ? (
        <p className="text-sm text-content-muted" role="status">
          The scan found nothing shaped like identifying text. That is a hint, not a guarantee: read the item yourself before
          you publish.
        </p>
      ) : (
        <ul className="list-none space-y-md" role="list">
          {flags.map((flag) => (
            <li key={flag.id} className="space-y-sm">
              <p className="text-sm font-semibold">
                {FLAG_LABELS[flag.kind as FlagKind] ?? flag.kind}
                {flag.resolved ? <span className="ml-xs font-normal text-content-muted">· resolved</span> : null}
              </p>
              <p className="font-mono text-xs break-all text-content-muted">{flag.snippet}</p>
              <p className="text-xs text-content-muted">{FLAG_WHY[flag.kind as FlagKind] ?? "Review before sharing."}</p>
              {flag.resolved ? null : <FlagForm flagId={flag.id} reviewable={reviewable} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FlagForm({ flagId, reviewable }: { flagId: string; reviewable: boolean }) {
  const router = useRouter();
  const [resolution, setResolution] = useState<"redacted" | "not_sensitive">("redacted");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/moderation/flags/${flagId}/resolve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resolution, reason }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string; note?: string; unresolved_flags?: number } | null;
      setMessage(
        response.ok
          ? `${data?.note ?? "Resolved."} ${data?.unresolved_flags === 0 ? "No open hints are left on this item." : `${data?.unresolved_flags} still open.`}`
          : (data?.error ?? "The request failed."),
      );
      router.refresh();
    } catch {
      setMessage("The request did not complete. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!reviewable) {
    return (
      <p className="text-sm text-content-muted" role="status">
        This item is not open for review, so its hints cannot be resolved.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-sm rounded-card border border-line bg-surface p-sm">
      <div className="flex flex-wrap items-center gap-md">
        {RESOLUTIONS.map((option) => (
          <label key={option.value} className="flex items-center gap-xs text-sm">
            <input
              type="radio"
              name={`resolution-${flagId}`}
              value={option.value}
              checked={resolution === option.value}
              onChange={() => setResolution(option.value)}
              disabled={busy}
            />
            {option.label}
          </label>
        ))}
      </div>
      <label className="block text-sm">
        <span className="text-content-muted">Why is this hint closed?</span>
        <input
          className="mt-xs w-full rounded-card border border-line bg-surface px-sm py-xs text-sm"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          required
          minLength={5}
          maxLength={500}
          disabled={busy}
        />
      </label>
      <button type="submit" className="btn-secondary" disabled={busy}>
        {busy ? "Recording…" : "Record decision"}
      </button>
      <p aria-live="polite" className="text-xs text-content-muted">
        {message}
      </p>
    </form>
  );
}
