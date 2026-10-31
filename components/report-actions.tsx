"use client";

import { useState } from "react";
import { Status, usePost } from "@/components/moderation-form";

/**
 * The moderator&rsquo;s decision on one open report. A report suspends the shared copy the moment it is
 * raised, so these are the only two ways out: put the same copy back in the reads, or uphold the report
 * and move the record to Unpublished. Both need learning.moderate, and the server refuses a restore when
 * the item is no longer Published or another report still names the copy.
 */
export function ReportActions({ reportId, contributionState }: { reportId: string; contributionState: string }) {
  const { post, feedback } = usePost(`/api/reports/${reportId}`);
  const [note, setNote] = useState("");

  const busy = feedback.busy;

  return (
    <div className="space-y-sm">
      <label className="block text-sm">
        <span className="text-content-muted">Decision note (internal)</span>
        <input
          className="mt-xs w-full rounded-card border border-line bg-surface px-sm py-xs text-sm"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={500}
          disabled={busy}
        />
      </label>
      <div className="flex flex-wrap gap-md">
        <button
          type="button"
          className="btn-secondary text-sm"
          disabled={busy || contributionState !== "Published"}
          onClick={() => post("resolve", { decision: "restore", note: note || undefined })}
          data-testid="report-restore"
        >
          {busy ? "Working…" : "Put the copy back"}
        </button>
        <button
          type="button"
          className="btn-primary text-sm"
          disabled={busy}
          onClick={() => post("resolve", { decision: "keep_out", note: note || undefined })}
          data-testid="report-keep-out"
        >
          {busy ? "Working…" : "Uphold the report"}
        </button>
      </div>
      {contributionState !== "Published" ? (
        <p className="text-xs text-content-muted">
          The record is {contributionState}, so there is no copy to put back. Publishing again is the move that would bring
          it back, and it needs its own decision.
        </p>
      ) : null}
      <Status message={feedback.message} />
    </div>
  );
}
