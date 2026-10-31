// Section 9 state machine. Any transition not listed here returns 409.

export const CONTRIBUTION_STATES = [
  "Draft",
  "Submitted",
  "In review",
  "Returned",
  "Published",
  "Unpublished",
  "Rejected",
  "Withdrawn",
] as const;

export type ContributionState = (typeof CONTRIBUTION_STATES)[number];

export type TransitionActor = "author" | "author-or-org-admin" | "moderator";

export type TransitionRule = {
  actor: TransitionActor;
  /** Human-readable guard from the Section 9 table. */
  guard: string;
};

const KEY = (from: ContributionState, to: ContributionState) => `${from}→${to}`;

const TRANSITIONS: Record<string, TransitionRule> = {
  [KEY("Draft", "Submitted")]: { actor: "author", guard: "consents recorded, validation passes" },
  [KEY("Submitted", "In review")]: { actor: "moderator", guard: "learning.moderate" },
  [KEY("In review", "Returned")]: { actor: "moderator", guard: "reason required" },
  [KEY("Returned", "Submitted")]: { actor: "author", guard: "edited" },
  [KEY("In review", "Published")]: {
    actor: "moderator",
    guard: "no unresolved flags, redacted fields supplied",
  },
  [KEY("In review", "Rejected")]: { actor: "moderator", guard: "reason required" },
  [KEY("Published", "Unpublished")]: { actor: "moderator", guard: "open report or investigation" },
  [KEY("Unpublished", "Published")]: { actor: "moderator", guard: "decision recorded" },
  [KEY("Unpublished", "Rejected")]: { actor: "moderator", guard: "decision recorded" },
  [KEY("Published", "Withdrawn")]: { actor: "author-or-org-admin", guard: "none" },
  // Section 12 lists Unpublished as a withdrawable state; Section 9's table has no such row. The
  // withdrawal phase keeps both sections consistent, because an unpublished item still has a shared
  // row (state 'suspended') that the author is entitled to remove for good.
  [KEY("Unpublished", "Withdrawn")]: { actor: "author-or-org-admin", guard: "none" },
  [KEY("Published", "In review")]: {
    actor: "author",
    guard: "material edit creates version +1; the previous live shared view stays live until the new version is published",
  },
  [KEY("Draft", "Withdrawn")]: { actor: "author", guard: "allowed" },
  [KEY("Returned", "Withdrawn")]: { actor: "author", guard: "allowed" },
};

export function transitionRule(from: ContributionState, to: ContributionState): TransitionRule | null {
  return TRANSITIONS[KEY(from, to)] ?? null;
}

export function canTransition(from: ContributionState, to: ContributionState): boolean {
  return transitionRule(from, to) !== null;
}

export function isContributionState(value: string): value is ContributionState {
  return (CONTRIBUTION_STATES as readonly string[]).includes(value);
}

/**
 * States the person in front of the page may move this item into. An "author-or-org-admin" transition
 * belongs to the author as much as to an admin, so the flags are both needed; moderator moves are never
 * offered here. Used by the UI so it never shows a dead button.
 */
export function actorNextStates(
  from: ContributionState,
  { isAuthor, isOrgAdmin }: { isAuthor: boolean; isOrgAdmin: boolean },
): ContributionState[] {
  return CONTRIBUTION_STATES.filter((to) => {
    const rule = transitionRule(from, to);
    if (!rule) return false;
    if (rule.actor === "author") return isAuthor;
    if (rule.actor === "author-or-org-admin") return isAuthor || isOrgAdmin;
    return false;
  });
}

/** The same for the moderation console: only moderator-owned moves are offered as buttons. */
export function moderatorNextStates(from: ContributionState): ContributionState[] {
  return CONTRIBUTION_STATES.filter((to) => transitionRule(from, to)?.actor === "moderator");
}

export const STATE_PLAIN: Record<ContributionState, string> = {
  Draft: "Draft — visible only to you unless you chose organisation sharing.",
  Submitted: "Submitted — waiting for a moderator; a colleague cannot open the private text.",
  "In review": "In review — a moderator has it open.",
  Returned: "Returned — a moderator asked for changes before it can be submitted again.",
  Published: "Published — an approved de-identified summary is in the shared learning feed.",
  Unpublished: "Unpublished — withdrawn from the feed while a review or report is open.",
  Rejected: "Rejected — a moderator declined it with a reason.",
  Withdrawn: "Withdrawn — removed at your request.",
};

/**
 * Icons and words, not colour alone (Section 23). Private stages use a lock, shared stages a globe,
 * and every badge also carries the state name.
 */
export const STATE_MARK: Record<ContributionState, { icon: string; kind: "private" | "shared" | "closed" }> = {
  Draft: { icon: "🔒", kind: "private" },
  Submitted: { icon: "🔒", kind: "private" },
  "In review": { icon: "🔒", kind: "private" },
  Returned: { icon: "🔒", kind: "private" },
  Published: { icon: "🌐", kind: "shared" },
  Unpublished: { icon: "🌐", kind: "shared" },
  Rejected: { icon: "✕", kind: "closed" },
  Withdrawn: { icon: "✕", kind: "closed" },
};
