// Section 14: the improvement-idea status machine. Read it beside ./lifecycle.ts — the idea loop is
// data, not scattered conditionals, so an illegal move is a 409 here exactly as it is over HTTP.

export const IDEA_STATUSES = [
  "Proposed",
  "Under review",
  "Planned",
  "In progress",
  "Released",
  "Not proceeding",
] as const;

export type IdeaStatus = (typeof IDEA_STATUSES)[number];

/** Internal only. Section 14 forbids showing this to a client. */
export const IDEA_PRIORITIES = ["low", "medium", "high"] as const;
export type IdeaPriority = (typeof IDEA_PRIORITIES)[number];

const KEY = (from: IdeaStatus, to: IdeaStatus) => `${from}→${to}`;

/** The guard text is what the change is judged against, and it is recorded in the audit reason. */
const TRANSITIONS: Record<string, string> = {
  [KEY("Proposed", "Under review")]: "the owning team takes it up",
  [KEY("Proposed", "Not proceeding")]: "reason required",
  [KEY("Under review", "Planned")]: "reason required",
  [KEY("Under review", "Not proceeding")]: "reason required",
  [KEY("Planned", "In progress")]: "work has started",
  [KEY("Planned", "Not proceeding")]: "reason required",
  [KEY("In progress", "Released")]: "delivered to users",
  [KEY("In progress", "Not proceeding")]: "reason required",
};

export function ideaTransitionRule(from: IdeaStatus, to: IdeaStatus): string | null {
  return TRANSITIONS[KEY(from, to)] ?? null;
}

export function canMoveIdea(from: IdeaStatus, to: IdeaStatus): boolean {
  return ideaTransitionRule(from, to) !== null;
}

export function isIdeaStatus(value: string): value is IdeaStatus {
  return (IDEA_STATUSES as readonly string[]).includes(value);
}

/** The moves a caller may offer. "Released" and "Not proceeding" are never reachable in one step from "Proposed". */
export function nextIdeaStatuses(from: IdeaStatus): IdeaStatus[] {
  return IDEA_STATUSES.filter((to) => canMoveIdea(from, to));
}

/**
 * Section 14: a client sees a plain-language status and nothing else — no internal prioritisation, no
 * history reason, no delivery date. These strings carry no date and no commitment.
 */
export const IDEA_STATUS_PLAIN: Record<IdeaStatus, string> = {
  Proposed: "Recorded. We have written this down and have not started looking at it.",
  "Under review": "Our product team is looking at this now.",
  Planned: "It is in the plan. This is not a date and not a commitment to deliver.",
  "In progress": "Work on this is underway.",
  Released: "It is available in the product.",
  "Not proceeding": "We are not taking this further. You can ask the team why through your contact.",
};

/** Every status has a plain form, so a value outside the machine can never reach a client page. */
export function plainStatus(value: string): string {
  return isIdeaStatus(value) ? IDEA_STATUS_PLAIN[value] : "We are not showing a status for this idea.";
}
