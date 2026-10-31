import { expect } from "vitest";
import { createDraft, submitContribution } from "@/lib/contribution-writes";
import { contributionDraftSchema } from "@/lib/contribution-schema";
import { getContribution, type Author } from "@/lib/contributions";
import { flagsFor } from "@/lib/moderation";
import { resolveFlag, startReview } from "@/lib/moderation-actions";
import { publishContribution } from "@/lib/publish";

// Fixtures shared by the two Phase 4 suites: tests/lifecycle.test.ts (the scanner gate) and
// tests/moderation.test.ts (the moderator moves and the published copy). They live here so both files
// describe the same item — a Beacon observation whose text trips three scanner patterns and whose
// author asked for credit — instead of drifting apart.

/** Trips the email, amount and customer_name patterns, so every run starts from a blocked item. */
export const SENSITIVE_BODY =
  "Analysts copy ops.head@aurora.example into the ticket and quote a facility of INR 2,200,000 for Harbor Foods each quarter.";

/** The moderator-written shared text: the same gap, no person, account, amount or customer. */
export const REDACTED_SUMMARY = "Manual seasonal caveats are added by hand because comparisons ignore the seasonal shape.";

export function sensitiveDraftInput() {
  return contributionDraftSchema.parse({
    title: "Manual caveats hide the seasonal shape",
    body: SENSITIVE_BODY,
    type: "operational_challenge",
    topic: "sme-seasonality",
    offering_slug: "sme-credit-decisioning",
    period: "2026-08",
    evidence_type: "internal_data",
    confidence: "medium",
    sharing_choice: "private",
    attribution_requested: false,
  });
}

export function publishInput(orgName: string) {
  return {
    summary: REDACTED_SUMMARY,
    attributionApproved: true,
    internalNote: "Checked against the original: no person, account or customer name is left.",
    orgName,
  };
}

/** Wires the fixtures to the calling file's sign-in helper, so each suite keeps its own database. */
export function moderationFixtures(signIn: (email: string) => Author) {
  /** A sensitive Beacon observation, submitted for community sharing with a credit request. */
  function submitSensitiveItem(): string {
    const sam = signIn("sam@beacon.example");
    const created = createDraft(sam, sensitiveDraftInput());
    if (!created.ok) throw new Error("the draft could not be created");
    const submitted = submitContribution(sam, created.row.id, { sharing_choice: "community", attribution_requested: true });
    if (!submitted.ok) throw new Error("the item could not be submitted");
    return created.row.id;
  }

  /** Closes every open hint with a recorded decision, which is what unlocks publishing. */
  function resolveEveryHint(contributionId: string): void {
    const meera = signIn("meera.mod@azentio.com");
    for (const flag of flagsFor(contributionId)) {
      if (flag.resolved === 1) continue;
      const resolved = resolveFlag(meera, flag.id, "redacted", "The shared summary names no person, account or customer.");
      expect(resolved.ok).toBe(true);
    }
  }

  /** Submitted → In review, the only legal step before a publish. */
  function takeForReview(contributionId: string): void {
    const started = startReview(signIn("meera.mod@azentio.com"), contributionId);
    expect(started.ok).toBe(true);
  }

  /** Publishes through the full gate, so a test can start from a live shared item. */
  function publishSensitiveItem(contributionId: string, orgName = "Beacon Credit"): void {
    takeForReview(contributionId);
    resolveEveryHint(contributionId);
    const meera = signIn("meera.mod@azentio.com");
    const published = publishContribution(meera, contributionId, publishInput(orgName));
    expect(published.ok).toBe(true);
    expect(getContribution(contributionId)!.state).toBe("Published");
  }

  return { submitSensitiveItem, resolveEveryHint, takeForReview, publishSensitiveItem };
}
