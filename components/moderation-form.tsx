"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type Feedback = { busy: boolean; message: string | null };

/** One POST, one in-flight flag, one line of server feedback — the shape every moderation form shares. */
export function usePost(base: string) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<Feedback>({ busy: false, message: null });

  async function send(path: string, method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>) {
    setFeedback({ busy: true, message: null });
    try {
      const response = await fetch(`${base}/${path}`, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => null)) as { error?: string; note?: string } | null;
      setFeedback({ busy: false, message: response.ok ? (data?.note ?? "Done.") : (data?.error ?? "The request failed.") });
      router.refresh();
    } catch {
      setFeedback({ busy: false, message: "The request did not complete. Try again." });
    }
  }

  const post = (path: string, body: Record<string, unknown>) => send(path, "POST", body);
  const patch = (path: string, body: Record<string, unknown>) => send(path, "PATCH", body);
  const del = (path: string, body: Record<string, unknown>) => send(path, "DELETE", body);

  return { post, patch, del, feedback };
}

export function Status({ message }: { message: string | null }) {
  return (
    <p aria-live="polite" className="text-sm">
      {message ? <span className="text-content-muted">{message}</span> : null}
    </p>
  );
}

export function PublishForm({
  base,
  unresolvedFlags,
  attributionRequested,
  orgName,
  initialSummary,
  republish,
}: {
  base: string;
  unresolvedFlags: number;
  attributionRequested: boolean;
  orgName: string;
  initialSummary: string;
  republish: boolean;
}) {
  const { post, feedback } = usePost(base);
  const [summary, setSummary] = useState(initialSummary);
  const [approveCredit, setApproveCredit] = useState(false);
  const [creditText, setCreditText] = useState(orgName);
  const [note, setNote] = useState("");

  const blocked = unresolvedFlags > 0;

  return (
    <section className="card space-y-md" aria-labelledby="publish-form">
      <h2 id="publish-form" className="font-display text-lg font-semibold">
        {republish ? "Publish the approved summary again" : "Write the de-identified summary"}
      </h2>

      <p className="text-sm text-content-muted">
        Only the fields in this form and the record&rsquo;s own metadata can enter the shared copy. The original text is never
        copied, the region is widened and the period is rounded to a quarter at publish time, and reviewer notes stay in the
        internal decision row.
      </p>

      {blocked ? (
        <p className="card border-warning/60 text-sm" role="status">
          {unresolvedFlags} scanner hint(s) are still open. Resolve each one first — publishing is blocked until none remain.
        </p>
      ) : null}

      <label className="block text-sm">
        <span className="text-content-muted">Shared summary (at least 20 characters, no identifying detail)</span>
        <textarea
          className="mt-xs min-h-32 w-full rounded-card border border-line bg-surface px-sm py-xs text-sm"
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          maxLength={600}
          required
          disabled={feedback.busy || blocked}
        />
      </label>

      {attributionRequested ? (
        <div className="space-y-sm">
          <label className="flex items-center gap-xs text-sm">
            <input
              type="checkbox"
              checked={approveCredit}
              onChange={(event) => setApproveCredit(event.target.checked)}
              disabled={feedback.busy || blocked}
            />
            Approve a credit line. The author asked to be named.
          </label>
          {approveCredit ? (
            <label className="block text-sm">
              <span className="text-content-muted">Credit wording</span>
              <input
                className="mt-xs w-full rounded-card border border-line bg-surface px-sm py-xs text-sm"
                value={creditText}
                onChange={(event) => setCreditText(event.target.value)}
                maxLength={120}
                disabled={feedback.busy || blocked}
              />
            </label>
          ) : (
            <p className="text-xs text-content-muted">Left off, the shared copy shows no credit.</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-content-muted">The author did not ask for credit, so no credit line can be published.</p>
      )}

      <label className="block text-sm">
        <span className="text-content-muted">Reviewer note (internal, never shared)</span>
        <input
          className="mt-xs w-full rounded-card border border-line bg-surface px-sm py-xs text-sm"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={500}
          disabled={feedback.busy || blocked}
        />
      </label>

      <button
        type="button"
        className="btn-primary"
        disabled={feedback.busy || blocked}
        onClick={() =>
          post("publish", {
            summary,
            attribution_approved: approveCredit,
            attribution_text: approveCredit ? creditText : undefined,
            internal_note: note || undefined,
          })
        }
      >
        {feedback.busy ? "Publishing…" : republish ? "Publish again" : "Publish to shared learning"}
      </button>
      <Status message={feedback.message} />
    </section>
  );
}
