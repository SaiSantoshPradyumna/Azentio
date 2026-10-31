import { describe, expect, it } from "vitest";
import {
  runCreditStrategy,
  runPlayground,
  runSimilarPortfolio,
  runSmeDecisioning,
  SIMULATED_BADGE,
  SYNTHETIC_BADGE,
  syntheticPortfolio,
} from "@/lib/playground";

describe("playground engines", () => {
  it("builds a fixed 200-application synthetic portfolio", () => {
    const a = syntheticPortfolio();
    const b = syntheticPortfolio();
    expect(a).toHaveLength(200);
    expect(a).toEqual(b);
    expect(a[0].score).toBeGreaterThanOrEqual(300);
    expect(a[0].score).toBeLessThanOrEqual(850);
  });

  it("labels credit strategy output as synthetic simulation", () => {
    const out = runCreditStrategy({ minScore: 620, minDscr: 1.2 });
    expect(out.badges).toEqual([SYNTHETIC_BADGE, SIMULATED_BADGE]);
    expect(out.approvalRate).toBeGreaterThanOrEqual(0);
    expect(out.approvalRate).toBeLessThanOrEqual(1);
    expect(out.portfolioSize).toBe(200);
  });

  it("adds seasonality evidence for SME decisioning", () => {
    const out = runSmeDecisioning({
      revenue: 1e7,
      ebitda: 2e6,
      existingDebtService: 5e5,
      requestedAmount: 1e6,
      seasonal: true,
    });
    expect(out.humanApprovalRequired).toBe(true);
    expect(out.evidence.some((e) => e.includes("Seasonality context"))).toBe(true);
    expect(out.badges).toContain(SIMULATED_BADGE);
  });

  it("returns top-3 similar segments", () => {
    const out = runSimilarPortfolio({ profileId: "p2" });
    expect(out.matches).toHaveLength(3);
    expect(out.matches[0].distance).toBeLessThanOrEqual(out.matches[1].distance);
  });

  it("dispatches by scenario", () => {
    const out = runPlayground({
      scenario: "credit-strategy-simulator",
      input: { minScore: 700, minDscr: 1.5 },
    });
    expect(out.scenario).toBe("credit-strategy-simulator");
  });
});
