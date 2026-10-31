import { describe, expect, it } from "vitest";
import {
  CUSTOMER_BLOCKLIST,
  FLAG_KINDS,
  SMALL_PLACES,
  coarseQuarter,
  coarseRegion,
  hasSensitiveShape,
  scan,
} from "@/lib/scanner";
import { buildSharedView, type ModeratorPublishInput } from "@/lib/publish";
import type { ContributionRow } from "@/lib/contributions";

// Section 10.1 and 10.2. lib/scanner.ts is pure, so these cases need no database and no session.

const SEEDED_SUBMITTED_BODY =
  "Renewal files pile up each lean season and customers call for updates. contact me at ops.head@aurora.example and we approved a loan of INR 4,500,000 to Harbor Foods last quarter.";

function kindsOf(text: string): string[] {
  return scan(text).map((flag) => flag.kind);
}

describe("the scanner finds every pattern in Section 10.1", () => {
  it("flags the seeded submitted observation", () => {
    expect(kindsOf(SEEDED_SUBMITTED_BODY).sort()).toEqual(["amount", "customer_name", "email"]);
    expect(scan(SEEDED_SUBMITTED_BODY).map((flag) => flag.snippet)).toEqual([
      "ops.head@aurora.example",
      "INR 4,500,000",
      "Harbor Foods",
    ]);
  });

  it("flags a phone-shaped run, a long number, a credential and a small place", () => {
    expect(kindsOf("Call 080-4567 8910 for the portfolio desk.")).toContain("phone");
    expect(kindsOf("Agreement 987654321 was restructured.")).toContain("long_number");
    expect(kindsOf("Paste api_key=abc123 into the ticket")).toContain("credential");
    for (const place of SMALL_PLACES) expect(kindsOf(`The branch in ${place} closed early.`)).toContain("rare_place");
    for (const name of CUSTOMER_BLOCKLIST) expect(kindsOf(`We lost ${name} to a competitor.`)).toContain("customer_name");
  });

  it("leaves a plain de-identified sentence alone", () => {
    const text = "Seasonal SME cash flow is compared with flat annual averages, causing false risk flags in lean periods.";
    expect(scan(text)).toEqual([]);
    expect(hasSensitiveShape(text)).toBe(false);
  });

  it("is stateless: scanning the same text twice finds the same hints", () => {
    // A cached global RegExp keeps lastIndex between calls, which would silently drop the second match.
    const first = scan(SEEDED_SUBMITTED_BODY);
    const second = scan(SEEDED_SUBMITTED_BODY);
    expect(second).toEqual(first);
    expect(scan(`${SEEDED_SUBMITTED_BODY} ${SEEDED_SUBMITTED_BODY}`)).toHaveLength(first.length * 2);
  });

  it("covers exactly the seven declared kinds", () => {
    expect(FLAG_KINDS).toEqual(["email", "phone", "long_number", "amount", "credential", "customer_name", "rare_place"]);
  });
});

describe("coarsening (Section 10.2)", () => {
  it("widens a city to its broad region and unknown values to unspecified", () => {
    expect(coarseRegion("Bengaluru")).toBe("South India");
    expect(coarseRegion("Mysuru")).toBe("South India");
    expect(coarseRegion("Chennai")).toBe("South India");
    expect(coarseRegion("Mumbai")).toBe("West India");
    expect(coarseRegion("Pune")).toBe("West India");
    expect(coarseRegion("Delhi")).toBe("North India");
    expect(coarseRegion("Kolkata")).toBe("East India");
    expect(coarseRegion("South India")).toBe("South India");
    expect(coarseRegion("Nowhere-singular")).toBe("Unspecified region");
    expect(coarseRegion("")).toBe("Unspecified region");
  });

  it("rounds a month to its quarter and refuses to guess on anything else", () => {
    expect(coarseQuarter("2026-01")).toBe("2026-Q1");
    expect(coarseQuarter("2026-06")).toBe("2026-Q2");
    expect(coarseQuarter("2026-12")).toBe("2026-Q4");
    expect(coarseQuarter("2026-13")).toBe("Unspecified period");
    expect(coarseQuarter("June 2026")).toBe("Unspecified period");
  });
});

describe("buildSharedView is the only whitelist (Section 10.3)", () => {
  const contribution: Pick<
    ContributionRow,
    "id" | "version" | "title" | "body" | "topic" | "offering_slug" | "industry" | "region" | "period" | "evidence_type" | "confidence" | "attribution_requested"
  > = {
    id: "contribution-x",
    version: 1,
    title: "Seasonal cash flow misread as risk",
    body: "Private text mentioning ops.head@aurora.example and INR 4,500,000 to Harbor Foods.",
    topic: "sme-seasonality",
    offering_slug: "sme-credit-decisioning",
    industry: "Microfinance",
    region: "Bengaluru",
    period: "2026-06",
    evidence_type: "internal_data",
    confidence: "medium",
    attribution_requested: 0,
  };

  const input: ModeratorPublishInput = {
    summary: "Seasonal SME cash flow is compared with flat annual averages, causing false risk flags.",
    attributionApproved: false,
    orgName: "Aurora Microfinance",
    internalNote: "Reviewer note that must never be shared.",
  };

  it("copies only the allowed fields, coarsened", () => {
    const view = buildSharedView(contribution as ContributionRow, input);
    // The write-side record: the DTO a client receives has no contribution_id and no version (see
    // tests/visible.test.ts), so these two names appear here and nowhere a reader can see.
    expect(Object.keys(view).sort()).toEqual(
      [
        "attribution",
        "confidence",
        "contribution_id",
        "evidence_type",
        "industry",
        "offering_slug",
        "period_quarter",
        "region_coarse",
        "summary",
        "title",
        "topic",
        "version",
      ].sort(),
    );
    expect(view.region_coarse).toBe("South India");
    expect(view.period_quarter).toBe("2026-Q2");
    expect(view.summary).toBe(input.summary);
    expect(view.attribution).toBeNull();
  });

  it("keeps the private body, the reviewer note and the identifying details out of the draft", () => {
    const view = buildSharedView(contribution as ContributionRow, input);
    const serialised = JSON.stringify(view);

    expect(serialised).not.toContain(contribution.body);
    expect(serialised).not.toContain(input.internalNote ?? "");
    expect(serialised).not.toContain("ops.head@aurora.example");
    expect(serialised).not.toContain("Harbor Foods");
    expect(serialised).not.toContain("Bengaluru");
    expect(serialised).not.toContain("2026-06");
  });

  it("shows a credit only when the author asked and the moderator approved", () => {
    const asked = { ...contribution, attribution_requested: 1 };
    expect(buildSharedView(asked as ContributionRow, { ...input, attributionApproved: true }).attribution).toBe(
      "Aurora Microfinance",
    );
    expect(
      buildSharedView(asked as ContributionRow, {
        ...input,
        attributionApproved: true,
        attributionText: "A microfinance lender in South India",
      }).attribution,
    ).toBe("A microfinance lender in South India");
    expect(buildSharedView(asked as ContributionRow, { ...input, attributionApproved: false }).attribution).toBeNull();
    expect(buildSharedView(contribution as ContributionRow, { ...input, attributionApproved: true }).attribution).toBeNull();
  });
});
