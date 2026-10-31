import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildActor, createOtp, createSession, loadSession, verifyOtp } from "@/lib/session";
import { getDb } from "@/lib/db";
import { FORBIDDEN_SHARED_KEYS } from "@/lib/visible";
import {
  SUPPRESSION_REASON,
  cohortMin,
  distinctOrgCount,
  orgBucketLabel,
  themeBySlug,
  themeVisibilities,
  themeVisibility,
  themeVisibilityBySlug,
} from "@/lib/cohort";

// Section 13. The guard is the difference between "three organisations describe this gap" and "one
// organisation's story, published as a pattern", so these tests read the two seeded themes the only
// way a user can: through themeVisibility().

let dataDir: string;

function actorFor(email: string) {
  const { code } = createOtp(email);
  const verified = verifyOtp(email, code!);
  const session = createSession(verified.userId!);
  return buildActor(loadSession(session.sessionId)!)!;
}

beforeAll(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "azentio-cohort-"));
  execFileSync(process.execPath, ["--import", "tsx", "lib/seed.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, DATA_DIR: dataDir, COHORT_MIN: "3", DEMO_MODE: "true" },
    stdio: "pipe",
  });
  process.env.DATA_DIR = dataDir;
});

afterAll(() => {
  getDb().close();
  if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
});

const maya = () => actorFor("maya@aurora.example");

describe("a theme needs the minimum number of distinct organisations", () => {
  it("reads COHORT_MIN from the environment and defaults to 3", () => {
    expect(cohortMin()).toBe(3);
    expect(orgBucketLabel(3)).toBe("3 or more organisations");
  });

  it("shows seasonality-context with three organisations' evidence", () => {
    const view = themeVisibilityBySlug(maya(), "seasonality-context");
    expect(view).not.toBeNull();
    expect(view!.suppressed).toBe(false);
    if (view!.suppressed) return;

    expect(view!.orgBucket).toBe("3 or more organisations");
    expect(view!.evidence).toHaveLength(3);
    expect(view!.evidence.map((row) => row.topic)).toEqual(["sme-seasonality", "sme-seasonality", "sme-seasonality"]);
    expect(view!.quarters).not.toBeNull();
    expect(view!.smallSample).toBe(true);
    expect(view!.limitation).toBe(
      "Small sample of self-reported observations; not evidence of market prevalence or cause.",
    );
  });

  it("suppresses collections-messaging, which rests on one organisation", () => {
    const view = themeVisibilityBySlug(maya(), "collections-messaging");
    expect(view!.suppressed).toBe(true);
    expect(view!.reason).toBe(SUPPRESSION_REASON);
    if (!view!.suppressed) return;

    // The whole point of suppression: nothing that identifies a contributor or counts them.
    expect(view!.evidence).toEqual([]);
    expect(view!.orgBucket).toBeNull();
    expect(view!.description).toBeNull();
    expect(view!.limitation).toBeNull();
    expect(view!.quarters).toBeNull();
    expect(view!.smallSample).toBe(false);
  });

  it("counts an organisation once however many observations it published", () => {
    const seasonality = themeBySlug("seasonality-context")!;
    expect(distinctOrgCount(seasonality)).toBe(3);

    getDb()
      .prepare("UPDATE contributions SET tenant_id = 'tenant-aurora' WHERE id = 'contribution-c-cedar-seasonality'")
      .run();
    expect(distinctOrgCount(seasonality)).toBe(2);
    expect(themeVisibility(maya(), seasonality).suppressed).toBe(true);

    getDb()
      .prepare("UPDATE contributions SET tenant_id = 'tenant-cedar' WHERE id = 'contribution-c-cedar-seasonality'")
      .run();
    expect(themeVisibility(maya(), seasonality).suppressed).toBe(false);
  });
});

describe("a filtered theme view keeps the same guard", () => {
  it("suppresses a visible theme when the filter leaves fewer organisations", () => {
    const seasonality = themeBySlug("seasonality-context")!;
    expect(themeVisibility(maya(), seasonality, {}).suppressed).toBe(false);
    // "branches" is only in Cedar's summary, so the filtered set is one organisation and the guard bites.
    expect(themeVisibility(maya(), seasonality, { q: "branches" }).suppressed).toBe(true);
    expect(themeVisibility(maya(), seasonality, { q: "branches" }).evidence).toEqual([]);
    expect(themeVisibility(maya(), seasonality, { q: "seasonal" }).suppressed).toBe(false);
  });

  it("never exposes a per-organisation count, a tenant or an author", () => {
    const views = themeVisibilities(maya());
    const serialised = JSON.stringify(views);
    expect(serialised).not.toContain("tenant-aurora");
    expect(serialised).not.toContain("Aurora");
    expect(serialised).not.toContain("maya@");
    expect(serialised).not.toContain("distinctOrg");
    for (const forbidden of FORBIDDEN_SHARED_KEYS) expect(serialised).not.toContain(`"${forbidden}"`);
  });

  it("refuses the guard to an actor with no community read, and audits the denial", () => {
    const before = countAudit("read.theme", "deny");
    const view = themeVisibilityBySlug(null, "seasonality-context");
    expect(view!.suppressed).toBe(true);
    expect(countAudit("read.theme", "deny")).toBeGreaterThan(before);
  });
});

function countAudit(action: string, decision: string): number {
  return (
    getDb()
      .prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = ? AND decision = ?")
      .get(action, decision) as { n: number }
  ).n;
}
