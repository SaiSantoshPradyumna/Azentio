"use client";

import { useState } from "react";
import { Status, usePost } from "@/components/moderation-form";
import type { IdeaStatus } from "@/lib/idea-lifecycle";
import type { IdeaUpdateRow } from "@/lib/ideas";
import type { SharedViewDTO } from "@/lib/visible";

/**
 * The product owner&rsquo;s moves on one idea: the status change (which needs a reason), the evidence
 * list (only shared views the reader can already see can be attached) and the client-facing update
 * (which a moderator must approve before a client page shows it). Every button calls the same endpoint
 * the API table names, and the server re-checks the grant and the status machine.
 */
export function IdeaWorkspace({
  ideaId,
  status,
  nextStatuses,
  evidence,
  grantable,
  updates,
}: {
  ideaId: string;
  status: string;
  nextStatuses: IdeaStatus[];
  evidence: SharedViewDTO[];
  grantable: { id: string; title: string }[];
  updates: IdeaUpdateRow[];
}) {
  const base = `/api/ideas/${ideaId}`;

  return (
    <div className="space-y-lg">
      <StatusForm base={base} status={status} nextStatuses={nextStatuses} />
      <EvidencePanel base={base} evidence={evidence} grantable={grantable} />
      <PublicUpdateForm base={base} updates={updates} />
    </div>
  );
}

function StatusForm({ base, status, nextStatuses }: { base: string; status: string; nextStatuses: IdeaStatus[] }) {
  const { patch, feedback } = usePost(base);
  const [target, setTarget] = useState<IdeaStatus | "">("");
  const [reason, setReason] = useState("");
  const chosen = nextStatuses.includes(target as IdeaStatus) ? (target as IdeaStatus) : nextStatuses[0];

  return (
    <section className="card space-y-md" aria-labelledby="idea-status-form">
      <h2 id="idea-status-form" className="font-display text-lg font-semibold">
        Move the status
      </h2>
      <p className="text-sm text-content-muted">This idea is {status}. Only the edges the status machine allows are offered.</p>

      {nextStatuses.length === 0 ? (
        <p className="card border-dashed text-sm text-content-muted" role="status">
          {status} is the end of the road for this idea, so there is no move to make.
        </p>
      ) : (
        <>
          <div className="grid gap-md sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-content-muted">Move to</span>
              <select
                className="mt-xs w-full rounded-card border border-line bg-surface px-sm py-xs text-sm"
                value={chosen}
                onChange={(event) => setTarget(event.target.value as IdeaStatus)}
                disabled={feedback.busy}
              >
                {nextStatuses.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-content-muted">Reason (required, internal)</span>
              <input
                className="mt-xs w-full rounded-card border border-line bg-surface px-sm py-xs text-sm"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                required
                minLength={5}
                maxLength={500}
                disabled={feedback.busy}
              />
            </label>
          </div>
          <button
            type="button"
            className="btn-primary"
            disabled={feedback.busy || reason.trim().length < 5}
            onClick={() => patch("status", { status: chosen, reason })}
          >
            {feedback.busy ? "Moving…" : "Record the move"}
          </button>
        </>
      )}
      <Status message={feedback.message} />
    </section>
  );
}

function EvidencePanel({
  base,
  evidence,
  grantable,
}: {
  base: string;
  evidence: SharedViewDTO[];
  grantable: { id: string; title: string }[];
}) {
  const { post, del, feedback } = usePost(base);
  const [choice, setChoice] = useState("");
  const selected = choice || grantable[0]?.id || "";

  return (
    <section className="card space-y-md" aria-labelledby="idea-evidence-form">
      <h2 id="idea-evidence-form" className="font-display text-lg font-semibold">
        Evidence
      </h2>
      <p className="text-sm text-content-muted">
        Evidence is attached through idea_evidence_grants, and only a shared copy you can already read in the community feed
        can be named. A report-suspended or withdrawn copy cannot be attached, and it drops out of this list the moment it
        stops being readable.
      </p>

      <ul className="list-none space-y-sm" role="list">
        {evidence.length === 0 ? (
          <li className="text-sm text-content-muted" role="status">
            Nothing attached yet.
          </li>
        ) : (
          evidence.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-sm border-l-4 border-line pl-md">
              <span className="text-sm">
                {item.title}
                <span className="ml-sm font-mono text-xs text-content-muted">{item.offering_slug}</span>
              </span>
              <button
                type="button"
                className="btn-secondary text-sm"
                disabled={feedback.busy}
                onClick={() => del("evidence", { shared_view_id: item.id })}
              >
                Detach
              </button>
            </li>
          ))
        )}
      </ul>

      {grantable.length === 0 ? (
        <p className="text-sm text-content-muted" role="status">
          No further shared item is readable by you right now, so there is nothing to attach.
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-md">
          <label className="block text-sm">
            <span className="text-content-muted">Attach a shared item</span>
            <select
              className="mt-xs block w-full min-w-64 rounded-card border border-line bg-surface px-sm py-xs text-sm"
              value={selected}
              onChange={(event) => setChoice(event.target.value)}
              disabled={feedback.busy}
            >
              {grantable.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn-primary" disabled={feedback.busy || !selected} onClick={() => post("evidence", { shared_view_id: selected })}>
            {feedback.busy ? "Working…" : "Attach"}
          </button>
        </div>
      )}
      <Status message={feedback.message} />
    </section>
  );
}

function PublicUpdateForm({ base, updates }: { base: string; updates: IdeaUpdateRow[] }) {
  const { post, feedback } = usePost(base);
  const [text, setText] = useState("");

  return (
    <section className="card space-y-md" aria-labelledby="idea-update-form">
      <h2 id="idea-update-form" className="font-display text-lg font-semibold">
        Client-facing update
      </h2>
      <p className="text-sm text-content-muted">
        Write what the client may read. It reaches client pages only after a moderator&rsquo;s account stands behind it, and
        it never carries a date, a priority or a delivery promise.
      </p>

      <ul className="list-none space-y-sm" role="list">
        {updates.length === 0 ? (
          <li className="text-sm text-content-muted" role="status">
            No update written yet.
          </li>
        ) : (
          updates.map((update) => (
            <li key={update.id} className="space-y-xs border-l-4 pl-md" data-approved={update.approved ? "yes" : "no"}>
              <p className="text-sm">{update.text}</p>
              <p className="font-mono text-xs text-content-muted">
                {update.approved ? `client-visible · approved by ${update.approved_by_email}` : "held back · no moderator has approved it"} ·{" "}
                {update.at}
              </p>
            </li>
          ))
        )}
      </ul>

      <label className="block text-sm">
        <span className="text-content-muted">New update (20 to 600 characters)</span>
        <textarea
          className="mt-xs min-h-24 w-full rounded-card border border-line bg-surface px-sm py-xs text-sm"
          value={text}
          onChange={(event) => setText(event.target.value)}
          required
          minLength={20}
          maxLength={600}
          disabled={feedback.busy}
        />
      </label>
      <button type="button" className="btn-primary" disabled={feedback.busy} onClick={() => post("public-update", { text })}>
        {feedback.busy ? "Storing…" : "Store the update"}
      </button>
      <Status message={feedback.message} />
    </section>
  );
}
