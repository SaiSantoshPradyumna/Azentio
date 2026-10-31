import type { WithdrawalChecks } from "@/lib/withdraw";

// Section 12: the stopwatch card. `true` is the good result — the item is no longer present in that
// reader. The wording says which readers were checked and what the clock cannot promise.

export const WITHDRAWAL_SLA =
  "Search, AIRA and API reads within 60 seconds (p99); derived digests and caches within 5 minutes. Content already viewed, exported or copied elsewhere cannot be recalled.";

const READER_LABELS: Record<keyof WithdrawalChecks, string> = {
  search: "Search",
  feed: "Shared feed",
  theme: "Themes",
  aira: "AIRA citation pool",
};

export function WithdrawalClockCard({
  elapsedMs,
  checks,
}: {
  elapsedMs: number;
  checks: WithdrawalChecks;
}) {
  const entries = (Object.keys(READER_LABELS) as (keyof WithdrawalChecks)[]).map((key) => ({
    key,
    label: READER_LABELS[key],
    gone: checks[key],
  }));
  const allGone = entries.every((entry) => entry.gone);

  return (
    <div className="space-y-sm rounded-card border border-line bg-surface p-lg" data-testid="withdrawal-clock" role="status">
      <h3 className="font-display text-base font-semibold">
        Withdrawal clock · ⏱ {elapsedMs < 1 ? `${Math.round(elapsedMs * 1000)} ms` : `${elapsedMs.toFixed(2)} s`}
      </h3>
      <ul className="list-none space-y-xs text-sm" role="list">
        {entries.map((entry) => (
          <li key={entry.key} className="flex flex-wrap items-center gap-xs">
            <span aria-hidden="true">{entry.gone ? "✓" : "✕"}</span>
            <span>{entry.label}</span>
            <span className="text-content-muted">
              {entry.gone ? "— item no longer present" : "— still present; re-check before relying on this list"}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-sm">
        {allGone
          ? "Re-queried after the commit through the same readers the pages use: the withdrawn item is gone from all four."
          : "Something is still readable. In this build every reader shares one query, so this means a filter or a theme did not clear — check the list above."}
      </p>
      <p className="text-xs text-content-muted">{WITHDRAWAL_SLA}</p>
      <p className="text-xs text-content-muted">
        Measured on this demonstration, on your own request. It is not a measurement of a production fleet.
      </p>
    </div>
  );
}
