// Deterministic Playground engines (BUILD_SPEC.md Section 20).
// Seeded mulberry32 PRNG (seed 42). Every output is synthetic — never a credit decision.

export const PLAYGROUND_SEED = 42;
export const SYNTHETIC_BADGE = "Synthetic data";
export const SIMULATED_BADGE = "Simulated output, not a credit decision";

export type PlaygroundScenario =
  | "credit-strategy-simulator"
  | "sme-credit-decisioning"
  | "similar-portfolio-intelligence";

export const PLAYGROUND_SCENARIOS: ReadonlyArray<{
  slug: PlaygroundScenario;
  name: string;
  tagline: string;
}> = [
  {
    slug: "credit-strategy-simulator",
    name: "Credit Strategy Simulator",
    tagline: "Simulate credit policy changes before deployment.",
  },
  {
    slug: "sme-credit-decisioning",
    name: "SME Credit Decisioning Workbench",
    tagline: "Financial analysis with evidence and human oversight.",
  },
  {
    slug: "similar-portfolio-intelligence",
    name: "Similar Portfolio Intelligence",
    tagline: "Compare applications with synthetic portfolio segments.",
  },
];

export type PortfolioApp = { id: number; score: number; dscr: number; pd: number };

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fixed synthetic portfolio of 200 applications (score 300–850, dscr 0.4–3.0, pd falling with score). */
export function syntheticPortfolio(seed = PLAYGROUND_SEED): PortfolioApp[] {
  const rand = mulberry32(seed);
  const apps: PortfolioApp[] = [];
  for (let i = 0; i < 200; i++) {
    const score = Math.round(300 + rand() * 550);
    const dscr = Math.round((0.4 + rand() * 2.6) * 100) / 100;
    const pd = Math.round((0.35 - ((score - 300) / 550) * 0.32 + (rand() - 0.5) * 0.04) * 10000) / 10000;
    apps.push({ id: i + 1, score, dscr, pd: Math.max(0.01, Math.min(0.4, pd)) });
  }
  return apps;
}

const PORTFOLIO = syntheticPortfolio();

export type CreditStrategyInput = { minScore: number; minDscr: number };
export type CreditStrategyOutput = {
  scenario: "credit-strategy-simulator";
  badges: string[];
  approvalRate: number;
  expectedDefaultRate: number;
  vsDefault: { approvalRateDelta: number; expectedDefaultRateDelta: number };
  approvedCount: number;
  portfolioSize: number;
  notice: string;
};

export function runCreditStrategy(input: CreditStrategyInput): CreditStrategyOutput {
  const minScore = clamp(input.minScore, 300, 800);
  const minDscr = clamp(input.minDscr, 0.8, 2.0);
  const defaults = { minScore: 620, minDscr: 1.2 };

  const evaluate = (policy: { minScore: number; minDscr: number }) => {
    const approved = PORTFOLIO.filter((a) => a.score >= policy.minScore && a.dscr >= policy.minDscr);
    const approvalRate = approved.length / PORTFOLIO.length;
    const expectedDefaultRate =
      approved.length === 0 ? 0 : approved.reduce((s, a) => s + a.pd, 0) / approved.length;
    return { approvalRate, expectedDefaultRate, approvedCount: approved.length };
  };

  const current = evaluate({ minScore, minDscr });
  const baseline = evaluate(defaults);

  return {
    scenario: "credit-strategy-simulator",
    badges: [SYNTHETIC_BADGE, SIMULATED_BADGE],
    approvalRate: round4(current.approvalRate),
    expectedDefaultRate: round4(current.expectedDefaultRate),
    vsDefault: {
      approvalRateDelta: round4(current.approvalRate - baseline.approvalRate),
      expectedDefaultRateDelta: round4(current.expectedDefaultRate - baseline.expectedDefaultRate),
    },
    approvedCount: current.approvedCount,
    portfolioSize: PORTFOLIO.length,
    notice:
      "Synthetic portfolio only. Align any live policy change with AAOIFI / IFSB governance and your Shariah board before deployment.",
  };
}

export type SmeInput = {
  revenue: number;
  ebitda: number;
  existingDebtService: number;
  requestedAmount: number;
  seasonal: boolean;
};

export type SmeOutput = {
  scenario: "sme-credit-decisioning";
  badges: string[];
  dscr: number;
  recommendation: string;
  evidence: string[];
  humanApprovalRequired: true;
  notice: string;
};

export function runSmeDecisioning(input: SmeInput): SmeOutput {
  const ebitda = Math.max(0, input.ebitda);
  const existing = Math.max(0, input.existingDebtService);
  const requested = Math.max(0, input.requestedAmount);
  const denom = existing + requested * 0.22;
  const dscr = denom === 0 ? 99 : round4(ebitda / denom);

  let recommendation: string;
  if (dscr < 1.0) recommendation = "Refer to analyst: weak coverage";
  else if (dscr <= 1.25) recommendation = "Refer to analyst";
  else recommendation = "Recommend approval for human review";

  const evidence = [
    `Reported revenue ${formatMoney(input.revenue)} (synthetic input).`,
    `EBITDA ${formatMoney(ebitda)}; existing debt service ${formatMoney(existing)}.`,
    `Requested amount ${formatMoney(requested)}; modelled service at 22% of request.`,
    `Computed DSCR ${dscr.toFixed(2)}.`,
  ];
  if (input.seasonal) {
    evidence.push("Seasonality context: compare against trailing 12-month pattern, not an annual average.");
  }
  evidence.push("Human approval required — this is simulated output, not a credit decision.");
  evidence.push(
    "For Islamic finance portfolios, map coverage checks to AAOIFI FAS guidance and IFSB risk principles before any live recommendation.",
  );

  return {
    scenario: "sme-credit-decisioning",
    badges: [SYNTHETIC_BADGE, SIMULATED_BADGE],
    dscr,
    recommendation,
    evidence,
    humanApprovalRequired: true,
    notice: "No model training programme is enabled. Output is deterministic synthetic simulation.",
  };
}

export type SimilarProfile = {
  id: string;
  label: string;
  score: number;
  dscr: number;
  sector: string;
  amount: number;
};

export const SIMILAR_PROFILES: SimilarProfile[] = [
  { id: "p1", label: "Wholesale trader — seasonal stock", score: 640, dscr: 1.35, sector: "trade", amount: 2_500_000 },
  { id: "p2", label: "Agri supplier — lean season", score: 580, dscr: 1.1, sector: "agri", amount: 1_200_000 },
  { id: "p3", label: "Equipment leasing — fleet", score: 710, dscr: 1.6, sector: "leasing", amount: 4_800_000 },
  { id: "p4", label: "Micro-enterprise — retail", score: 520, dscr: 0.95, sector: "retail", amount: 450_000 },
  { id: "p5", label: "Services SME — contract book", score: 690, dscr: 1.45, sector: "services", amount: 1_800_000 },
];

type Segment = {
  id: string;
  label: string;
  score: number;
  dscr: number;
  sector: string;
  defaultRate: number;
  approvalRate: number;
};

const SEGMENTS: Segment[] = (() => {
  const rand = mulberry32(PLAYGROUND_SEED + 7);
  return Array.from({ length: 12 }, (_, i) => ({
    id: `seg-${i + 1}`,
    label: `Synthetic segment ${i + 1}`,
    score: Math.round(400 + rand() * 400),
    dscr: round4(0.7 + rand() * 1.8),
    sector: ["trade", "agri", "leasing", "retail", "services"][i % 5],
    defaultRate: round4(0.02 + rand() * 0.12),
    approvalRate: round4(0.4 + rand() * 0.5),
  }));
})();

export type SimilarInput = { profileId: string };
export type SimilarOutput = {
  scenario: "similar-portfolio-intelligence";
  badges: string[];
  profile: SimilarProfile;
  matches: Array<{
    id: string;
    label: string;
    distance: number;
    defaultRate: number;
    approvalRate: number;
    sector: string;
  }>;
  notice: string;
};

export function runSimilarPortfolio(input: SimilarInput): SimilarOutput {
  const profile = SIMILAR_PROFILES.find((p) => p.id === input.profileId) ?? SIMILAR_PROFILES[0];
  const scored = SEGMENTS.map((seg) => {
    const scoreDist = Math.abs(seg.score - profile.score) / 550;
    const dscrDist = Math.abs(seg.dscr - profile.dscr) / 2.6;
    const sectorDist = seg.sector === profile.sector ? 0 : 0.35;
    const distance = round4(scoreDist * 0.45 + dscrDist * 0.35 + sectorDist * 0.2);
    return {
      id: seg.id,
      label: seg.label,
      distance,
      defaultRate: seg.defaultRate,
      approvalRate: seg.approvalRate,
      sector: seg.sector,
    };
  })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3);

  return {
    scenario: "similar-portfolio-intelligence",
    badges: [SYNTHETIC_BADGE, SIMULATED_BADGE],
    profile,
    matches: scored,
    notice:
      "Distances are synthetic. IIFM documentation standards and IFSB concentration guidance apply when mapping live peer segments.",
  };
}

export type PlaygroundInput =
  | { scenario: "credit-strategy-simulator"; input: CreditStrategyInput }
  | { scenario: "sme-credit-decisioning"; input: SmeInput }
  | { scenario: "similar-portfolio-intelligence"; input: SimilarInput };

export type PlaygroundOutput = CreditStrategyOutput | SmeOutput | SimilarOutput;

export function runPlayground(payload: PlaygroundInput): PlaygroundOutput {
  switch (payload.scenario) {
    case "credit-strategy-simulator":
      return runCreditStrategy(payload.input);
    case "sme-credit-decisioning":
      return runSmeDecisioning(payload.input);
    case "similar-portfolio-intelligence":
      return runSimilarPortfolio(payload.input);
  }
}

export function isPlaygroundScenario(value: string): value is PlaygroundScenario {
  return PLAYGROUND_SCENARIOS.some((s) => s.slug === value);
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(n));
}
