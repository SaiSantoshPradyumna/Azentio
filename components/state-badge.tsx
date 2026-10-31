import { STATE_MARK, type ContributionState } from "@/lib/lifecycle";

const KIND_STYLES = {
  private: "border-line bg-surface-sunken",
  shared: "border-accent/50 bg-accent/10",
  closed: "border-warning/50 bg-warning/10",
} as const;

const KIND_WORD = { private: "Private", shared: "Shared", closed: "Closed" } as const;

/**
 * Section 23: private and shared differ by label, icon and layout, not colour alone. The badge
 * therefore carries an icon, the state name and the visibility word.
 */
export function StateBadge({ state, detail }: { state: ContributionState; detail?: string }) {
  const mark = STATE_MARK[state];

  return (
    <span className={`inline-flex items-center gap-xs rounded-card border px-sm py-xs text-xs font-semibold ${KIND_STYLES[mark.kind]}`}>
      <span aria-hidden="true">{mark.icon}</span>
      {state}
      <span className="text-content-muted">· {KIND_WORD[mark.kind]}</span>
      {detail ? <span className="font-normal text-content-muted">· {detail}</span> : null}
    </span>
  );
}
