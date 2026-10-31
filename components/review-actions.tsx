"use client";

import { useState } from "react";
import { moderatorNextStates, type ContributionState } from "@/lib/lifecycle";
import { PublishForm, Status, usePost } from "@/components/moderation-form";

/**
 * The moderator&rsquo;s moves. Which buttons appear is decided by the Section 9 table, so the console
 * never offers a transition the server would refuse; the server re-checks every one anyway.
 */
export function ReviewActions({
  contributionId,
  state,
  unresolvedFlags,
  attributionRequested,
  orgName,
  liveSummary,
}: {
  contributionId: string;
  state: ContributionState;
  unresolvedFlags: number;
  attributionRequested: boolean;
  orgName: string;
  liveSummary: string | null;
}) {
  const next = moderatorNextStates(state);
  const base = `/api/moderation/${contributionId}`;

  return (
    <div className="space-y-lg">
      {next.includes("In review") ? <TakeForReview base={base} /> : null}

      {next.includes("Published") ? (
        <PublishForm
          base={base}
          unresolvedFlags={unresolvedFlags}
          attributionRequested={attributionRequested}
          orgName={orgName}
          initialSummary={liveSummary ?? ""}
          republish={state === "Unpublished"}
        />
      ) : null}

      {next.includes("Returned") ? (
        <ReasonForm
          base={base}
          path="return"
          heading="Return to the author"
          blurb="The author sees this reason and can edit and submit again."
        />
      ) : null}

      {next.includes("Rejected") ? (
        <ReasonForm
          base={base}
          path="reject"
          heading="Reject"
          blurb="The author sees this reason. Nothing of this item is shared."
        />
      ) : null}

      {next.includes("Unpublished") ? (
        <ReasonForm
          base={base}
          path="unpublish"
          heading="Unpublish"
          blurb="Section 9 allows this when a report or an investigation is open. The shared copy stops appearing in every feed, search and export result at once."
        />
      ) : null}

      {next.length === 0 ? (
        <p className="card border-dashed text-sm text-content-muted" role="status">
          This item is {state}. No moderator transition is allowed from here, so there is nothing to offer.
        </p>
      ) : null}
    </div>
  );
}

function TakeForReview({ base }: { base: string }) {
  const { post, feedback } = usePost(base);

  return (
    <section className="card space-y-md" aria-labelledby="take-review">
      <h2 id="take-review" className="font-display text-lg font-semibold">
        Take for review
      </h2>
      <p className="text-sm text-content-muted">
        Moves the item from Submitted to In review, records the decision and tells the author a moderator has it open.
      </p>
      <button type="button" className="btn-primary" disabled={feedback.busy} onClick={() => post("start", {})}>
        {feedback.busy ? "Working…" : "Open this item"}
      </button>
      <Status message={feedback.message} />
    </section>
  );
}

function ReasonForm({
  base,
  path,
  heading,
  blurb,
}: {
  base: string;
  path: "return" | "reject" | "unpublish";
  heading: string;
  blurb: string;
}) {
  const { post, feedback } = usePost(base);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  return (
    <section className="card space-y-md" aria-labelledby={`form-${path}`}>
      <h2 id={`form-${path}`} className="font-display text-lg font-semibold">
        {heading}
      </h2>
      <p className="text-sm text-content-muted">{blurb}</p>
      <label className="block text-sm">
        <span className="text-content-muted">Reason (required)</span>
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
      {path === "unpublish" ? (
        <label className="block text-sm">
          <span className="text-content-muted">Reviewer note (internal, never shared)</span>
          <input
            className="mt-xs w-full rounded-card border border-line bg-surface px-sm py-xs text-sm"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={500}
            disabled={feedback.busy}
          />
        </label>
      ) : null}
      <button
        type="button"
        className="btn-secondary"
        disabled={feedback.busy}
        onClick={() => post(path, { reason, internal_note: path === "unpublish" && note ? note : undefined })}
      >
        {feedback.busy ? "Working…" : heading}
      </button>
      <Status message={feedback.message} />
    </section>
  );
}
