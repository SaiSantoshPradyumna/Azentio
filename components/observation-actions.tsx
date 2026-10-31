"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SharingFields, type SharingValue } from "@/components/sharing-fields";
import { WITHDRAWAL_SLA, WithdrawalClockCard } from "@/components/withdrawal-clock";
import type { SharingChoice } from "@/lib/contribution-schema";
import { actorNextStates, type ContributionState } from "@/lib/lifecycle";
import type { WithdrawalClock } from "@/lib/withdraw";

type Status = "idle" | "working";

/**
 * The author's moves. The panel only offers transitions the state machine allows at this state, so
 * there is no dead button; the server re-checks every one of them.
 */
export function ObservationActions({
  contributionId,
  basePath,
  state,
  sharingChoice,
  attributionRequested,
  isAuthor,
  isOrgAdmin,
}: {
  contributionId: string;
  basePath: string;
  state: ContributionState;
  sharingChoice: SharingChoice;
  attributionRequested: boolean;
  isAuthor: boolean;
  isOrgAdmin: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [clock, setClock] = useState<WithdrawalClock | null>(null);
  const [sharing, setSharing] = useState<SharingValue>({ sharing: sharingChoice, attribution: attributionRequested });

  const withdrawable = actorNextStates(state, { isAuthor, isOrgAdmin }).includes("Withdrawn");
  if (!isAuthor && !withdrawable) return null;

  const submittable = isAuthor && (state === "Draft" || state === "Returned");
  const busy = status === "working";
  const sharedAlready = state === "Published" || state === "Unpublished";

  async function call(path: string, body?: unknown) {
    setStatus("working");
    setMessage(null);
    try {
      const response = await fetch(`/api/contributions/${contributionId}/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : "{}",
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        notice?: string;
        clock?: WithdrawalClock | null;
      } | null;
      setMessage(response.ok ? (data?.notice ?? "Done.") : (data?.error ?? "The request failed."));
      setClock(path === "withdraw" && response.ok ? (data?.clock ?? null) : null);
      router.refresh();
    } catch {
      setMessage("The request did not complete. Try again.");
    } finally {
      setStatus("idle");
    }
  }

  return (
    <section className="card max-w-2xl space-y-lg" aria-labelledby="observation-actions">
      <h2 id="observation-actions" className="font-display text-lg font-semibold">
        {isAuthor ? "Your next move" : "Organisation admin moves"}
      </h2>

      {submittable ? (
        <>
          <p className="text-sm text-content-muted">
            {state === "Returned"
              ? "A moderator asked for changes. Submitting again records your sharing decision and puts the item back in the review queue."
              : "Submitting records the four consents below and puts the item in the review queue. A draft is not visible to anyone else unless you chose organisation sharing."}
          </p>
          <SharingFields idPrefix="observation-submit" value={sharing} onChange={setSharing} disabled={busy} />
          <div className="flex flex-wrap gap-md">
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={() => call("submit", { sharing_choice: sharing.sharing, attribution_requested: sharing.attribution })}
            >
              {busy ? "Submitting…" : state === "Returned" ? "Submit again" : "Submit for review"}
            </button>
            {withdrawable ? (
              <button type="button" className="btn-secondary" disabled={busy} onClick={() => call("withdraw")}>
                {busy ? "Withdrawing…" : "Withdraw"}
              </button>
            ) : null}
            {state === "Draft" ? (
              <a href={`${basePath}/observations/${contributionId}/edit`} className="btn-secondary">
                Edit fields
              </a>
            ) : null}
          </div>
          {withdrawable ? (
            <p className="text-sm text-content-muted">
              Withdrawing removes the draft from your list immediately. A draft never reached the shared feed, so there is
              no published copy to recall.
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-content-muted">
          {state === "Submitted" || state === "In review"
            ? "A moderator has the next move. Editing is available again if the item is returned."
            : state === "Published"
              ? "This item is published: a de-identified summary is in the shared feed. Withdrawing deletes that summary, its links as evidence on any improvement idea, and moves it out of every reader in one transaction."
              : state === "Unpublished"
                ? "A moderator pulled this item from the feed while a report or review is open. You can withdraw it for good instead of waiting for that decision."
                : state === "Rejected"
                  ? "A moderator declined this item; their reason is recorded on the decision."
                  : "This item is withdrawn."}
        </p>
      )}

      {withdrawable && !submittable ? (
        <div className="space-y-md">
          <button type="button" className="btn-primary" disabled={busy} onClick={() => call("withdraw")}>
            {busy ? "Withdrawing…" : "Withdraw this item"}
          </button>
          <p className="text-sm text-content-muted">
            {isAuthor
              ? "Withdrawing is your decision, not a moderator’s."
              : "An organisation admin may withdraw an item their organisation published."}{" "}
            It removes the shared summary and stops it counting as evidence. Nothing already read, exported or copied by
            another organisation can be recalled.
          </p>
        </div>
      ) : null}

      {clock ? <WithdrawalClockCard elapsedMs={clock.elapsedMs} checks={clock.checks} /> : null}

      {sharedAlready && !clock ? (
        <p className="text-xs text-content-muted" data-testid="withdrawal-sla">
          {WITHDRAWAL_SLA}
        </p>
      ) : null}

      <p aria-live="polite" className="text-sm">
        {message ? <span className="text-content-muted">{message}</span> : null}
      </p>
    </section>
  );
}
