// Synthetic content seed (BUILD_SPEC.md Section 19). Use exactly.

export type ContributionSeed = {
  key: string;
  tenantKey: string;
  authorEmail: string;
  type: string;
  title: string;
  body: string;
  topic: string;
  offeringSlug: string;
  period: string;
  evidenceType: string;
  confidence: string;
  sharingChoice: "private" | "organisation" | "community";
  state: "Draft" | "Submitted" | "Published";
  sharedSummary?: string;
  publishedAt?: string;
};

export const CONTRIBUTIONS: ContributionSeed[] = [
  {
    key: "c-aurora-seasonality",
    tenantKey: "tenant-aurora",
    authorEmail: "maya@aurora.example",
    type: "market_observation",
    title: "Seasonal cash flow misread as risk",
    body: "Seasonal SME borrowers show uneven monthly cash flow, but our scorecards compare them against flat annual averages, which flags healthy agricultural suppliers as risky each lean season.",
    topic: "sme-seasonality",
    offeringSlug: "sme-credit-decisioning",
    period: "2026-06",
    evidenceType: "internal_data",
    confidence: "medium",
    sharingChoice: "community",
    state: "Published",
    sharedSummary:
      "Seasonal SME cash flow is compared with flat annual averages, causing false risk flags in lean periods.",
    publishedAt: "2026-06-18T09:00:00.000Z",
  },
  {
    key: "c-beacon-seasonality",
    tenantKey: "tenant-beacon",
    authorEmail: "sam@beacon.example",
    type: "operational_challenge",
    title: "Manual adjustment for seasonal peaks",
    body: "Analysts manually adjust for seasonal sales peaks because standard comparisons ignore them.",
    topic: "sme-seasonality",
    offeringSlug: "sme-credit-decisioning",
    period: "2026-07",
    evidenceType: "anecdotal",
    confidence: "medium",
    sharingChoice: "community",
    state: "Published",
    sharedSummary:
      "Analysts manually adjust for seasonal sales peaks because standard comparisons ignore them.",
    publishedAt: "2026-07-08T09:00:00.000Z",
  },
  {
    key: "c-cedar-seasonality",
    tenantKey: "tenant-cedar",
    authorEmail: "admin@cedar.example",
    type: "market_observation",
    title: "Inconsistent treatment of seasonal businesses",
    body: "Relationship managers report inconsistent treatment of seasonal businesses across branches.",
    topic: "sme-seasonality",
    offeringSlug: "sme-credit-decisioning",
    period: "2026-05",
    evidenceType: "survey",
    confidence: "low",
    sharingChoice: "community",
    state: "Published",
    sharedSummary:
      "Relationship managers report inconsistent treatment of seasonal businesses across branches.",
    publishedAt: "2026-05-27T09:00:00.000Z",
  },
  {
    key: "c-delta-collections",
    tenantKey: "tenant-delta",
    authorEmail: "admin@delta.example",
    type: "successful_practice",
    title: "Tone guidance in collections reminders",
    body: "Field teams report that softer, scheduled reminder tone improves repayment commitments from leasing customers during cash-flow stress periods.",
    topic: "collections-tone",
    offeringSlug: "credit-strategy-simulator",
    period: "2026-08",
    evidenceType: "anecdotal",
    confidence: "low",
    sharingChoice: "community",
    state: "Published",
    sharedSummary:
      "Structured reminder tone is reported to improve repayment commitments during cash-flow stress.",
    publishedAt: "2026-08-12T09:00:00.000Z",
  },
  {
    key: "c-aurora-submitted",
    tenantKey: "tenant-aurora",
    authorEmail: "maya@aurora.example",
    type: "improvement_suggestion",
    title: "Faster follow-up on seasonal renewals",
    body: "Renewal files pile up each lean season and customers call for updates. contact me at ops.head@aurora.example and we approved a loan of INR 4,500,000 to Harbor Foods last quarter.",
    topic: "sme-seasonality",
    offeringSlug: "sme-credit-decisioning",
    period: "2026-09",
    evidenceType: "anecdotal",
    confidence: "low",
    sharingChoice: "community",
    state: "Submitted",
  },
  {
    key: "c-beacon-draft",
    tenantKey: "tenant-beacon",
    authorEmail: "sam@beacon.example",
    type: "product_gap",
    title: "Seasonal view missing in the comparison screen",
    body: "The comparison screen shows an annual average only. We need a trailing twelve-month seasonal view before this is usable for agricultural portfolios.",
    topic: "sme-seasonality",
    offeringSlug: "sme-credit-decisioning",
    period: "2026-09",
    evidenceType: "internal_data",
    confidence: "medium",
    sharingChoice: "private",
    state: "Draft",
  },
];

export type ThemeSeed = {
  key: string;
  slug: string;
  title: string;
  offeringSlug: string;
  topicKey: string;
  description: string;
  limitation: string;
};

export const THEMES: ThemeSeed[] = [
  {
    key: "theme-seasonality-context",
    slug: "seasonality-context",
    title: "Seasonality context",
    offeringSlug: "sme-credit-decisioning",
    topicKey: "sme-seasonality",
    description:
      "Organisations describe the same gap: comparisons ignore seasonal cash-flow swings, so healthy seasonal businesses are flagged incorrectly.",
    limitation:
      "Small sample of self-reported observations; not evidence of market prevalence or cause.",
  },
  {
    key: "theme-collections-messaging",
    slug: "collections-messaging",
    title: "Collections messaging",
    offeringSlug: "credit-strategy-simulator",
    topicKey: "collections-tone",
    description:
      "Early reports on reminder tone and repayment commitments. Awaiting more independent organisations before this theme is shown.",
    limitation:
      "Single-organisation report; not evidence of market prevalence or cause.",
  },
];

export const IDEA = {
  key: "idea-seasonality-explanation",
  title: "Seasonality-aware comparison explanation",
  problem:
    "Financial comparisons present flat annual averages, so seasonal businesses look risky in lean periods and analysts add manual caveats.",
  offeringSlug: "sme-credit-decisioning",
  outcome:
    "Explain seasonal context next to comparisons so reviewers see why an average can mislead, with a human approval step.",
  ownerTeam: "Financial Analysis Intelligence",
  priority: "medium",
  status: "Under review",
  themeKey: "theme-seasonality-context",
  createdByEmail: "rohan.po@azentio.com",
  publicUpdate:
    "We are reviewing how seasonal patterns are explained in financial comparisons. This is under review and is not a delivery commitment.",
  approvedByEmail: "meera.mod@azentio.com",
  evidenceContributionKeys: ["c-aurora-seasonality", "c-beacon-seasonality", "c-cedar-seasonality"],
};

export type MediaSeed = {
  key: string;
  title: string;
  relPath: string;
  mime: string;
  audience: string;
  kind: string;
};

export const MEDIA: MediaSeed[] = [
  {
    key: "media-public-showcase",
    title: "Public showcase: Azentio overview",
    relPath: "public-showcase.bin",
    mime: "video/mp4",
    audience: "public",
    kind: "showcase",
  },
  {
    key: "media-employee-live",
    title: "Internal Live: Sandbox walkthrough",
    relPath: "employee-live.bin",
    mime: "video/mp4",
    audience: "employee",
    kind: "recording",
  },
];

export const MEDIA_PLACEHOLDER_LABEL = "Placeholder recording";

export type ContentBlockSeed = { key: string; body: string; audience: string };

export const CONTENT_BLOCKS: ContentBlockSeed[] = [
  {
    key: "home.banner",
    body: "Azentio builds intelligence for financial services — with human oversight at every step.",
    audience: "public",
  },
  {
    key: "employee.notice",
    body: "Internal notice: demo data in this portal is synthetic. Do not paste real customer material into contributions.",
    audience: "employee",
  },
];

export const SEED_CREATED_AT = "2026-06-01T09:00:00.000Z";
