import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildActor, createOtp, createSession, loadSession, setActiveTenant, verifyOtp } from "@/lib/session";
import { getDb } from "@/lib/db";
import { getContribution } from "@/lib/contributions";
import { publishContribution, unpublishContribution } from "@/lib/publish";
import { sharedViewsCsv } from "@/lib/export";
import {
  FORBIDDEN_SHARED_KEYS,
  SHARED_VIEW_DTO_KEYS,
  visibleFacets,
  visibleSharedViewById,
  visibleSharedViews,
} from "@/lib/visible";

// Section 8. Every shared read in the product goes through visibleSharedViews(), so this file is the
// proof that a shared payload carries only the allowed fields, only live rows, and nothing private.

let dataDir: string;

function actorFor(email: string, tenantId?: string) {
  const { code } = createOtp(email);
  const verified = verifyOtp(email, code!);
  const session = createSession(verified.userId!);
  if (tenantId) setActiveTenant(session.sessionId, tenantId);
  const loaded = loadSession(session.sessionId)!;
  return buildActor(loaded)!;
}

beforeAll(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "azentio-visible-"));
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

describe("the shared DTO is the whole payload", () => {
  it("returns exactly the Section 8 fields for every row", () => {
    const rows = visibleSharedViews(maya());
    expect(rows.length).toBeGreaterThan(0);

    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual([...SHARED_VIEW_DTO_KEYS].sort());
      const serialised = JSON.stringify(row);
      for (const forbidden of FORBIDDEN_SHARED_KEYS) expect(serialised).not.toContain(`"${forbidden}"`);
    }
  });

  it("shows no credit line, because no seeded author asked for one", () => {
    for (const row of visibleSharedViews(maya())) expect(row.attribution).toBeNull();
  });

  it("names only broad regions and quarters", () => {
    const rows = visibleSharedViews(maya());
    expect(new Set(rows.map((row) => row.region_coarse))).toEqual(new Set(["South India", "West India", "East India"]));
    for (const row of rows) expect(row.period_quarter).toMatch(/^\d{4}-Q[1-4]$/);
    expect(JSON.stringify(rows)).not.toContain("Bengaluru");
    expect(JSON.stringify(rows)).not.toContain("Pune");
  });
});

describe("only live shared rows are readable", () => {
  it("returns the four seeded community items and no draft", () => {
    const rows = visibleSharedViews(maya());
    expect(rows).toHaveLength(4);
    // Beacon's private draft is about the comparison screen; a search of the shared set cannot find it.
    expect(visibleSharedViews(maya(), { q: "comparison screen" })).toEqual([]);
    expect(visibleSharedViews(maya(), { q: "seasonal" }).length).toBeGreaterThan(0);
  });

  it("drops an item the moment a moderator unpublishes it, and brings it back on republish", () => {
    const meera = actorFor("meera.mod@azentio.com");
    const before = visibleSharedViews(maya());
    expect(before.map((row) => row.id)).toContain("shared-view-contribution-c-delta-collections");

    const unpublished = unpublishContribution(meera, "contribution-c-delta-collections", "Open report on the reminder-tone item.", null);
    expect(unpublished.ok).toBe(true);

    const after = visibleSharedViews(maya());
    expect(after).toHaveLength(before.length - 1);
    expect(after.map((row) => row.id)).not.toContain("shared-view-contribution-c-delta-collections");
    expect(visibleSharedViewById(maya(), "shared-view-contribution-c-delta-collections")).toBeNull();
    expect(getContribution("contribution-c-delta-collections")!.state).toBe("Unpublished");

    const republished = publishContribution(meera, "contribution-c-delta-collections", {
      summary: "Reminder tone is reported to improve repayment commitments during cash-flow stress.",
      attributionApproved: false,
      orgName: "Delta Leasing",
    });
    expect(republished.ok).toBe(true);
    expect(visibleSharedViews(maya()).map((row) => row.id)).toEqual(before.map((row) => row.id));
    expect(getContribution("contribution-c-delta-collections")!.state).toBe("Published");
  });
});

describe("filters narrow, they never widen", () => {
  it("matches offering, industry, broad region, topic and quarter", () => {
    const all = visibleSharedViews(maya());

    const south = visibleSharedViews(maya(), { region: "South India" });
    expect(south.length).toBeLessThan(all.length);
    expect(south.every((row) => row.region_coarse === "South India")).toBe(true);

    const leasing = visibleSharedViews(maya(), { industry: "Leasing" });
    expect(leasing).toHaveLength(1);

    const simulator = visibleSharedViews(maya(), { offering: "credit-strategy-simulator" });
    expect(simulator.every((row) => row.offering_slug === "credit-strategy-simulator")).toBe(true);

    const topic = visibleSharedViews(maya(), { topic: "sme-seasonality" });
    expect(topic).toHaveLength(3);

    // `YYYY-MM` is coarsened before it is compared, so an author's period still finds the right rows.
    expect(visibleSharedViews(maya(), { period: "2026-06" })).toEqual(topic.filter((row) => row.period_quarter === "2026-Q2"));
    expect(visibleSharedViews(maya(), { period: "2026-Q2" })).toEqual(topic.filter((row) => row.period_quarter === "2026-Q2"));
    expect(visibleSharedViews(maya(), { region: "Bengaluru" })).toEqual([]);
  });

  it("searches title, summary and topic case-insensitively and escapes LIKE wildcards", () => {
    expect(visibleSharedViews(maya(), { q: "SEASONAL" }).length).toBeGreaterThan(0);
    expect(visibleSharedViews(maya(), { q: "relationship managers" })[0]?.topic).toBe("sme-seasonality");
    expect(visibleSharedViews(maya(), { q: "%" })).toEqual([]);
    expect(visibleSharedViews(maya(), { q: "_all" })).toEqual([]);
  });

  it("derives facets only from what the actor can already see", () => {
    const facets = visibleFacets(maya());
    const rows = visibleSharedViews(maya());
    expect(facets.regions).toEqual([...new Set(rows.map((row) => row.region_coarse))].sort((a, b) => a.localeCompare(b)));
    expect(facets.topics).toEqual(["collections-tone", "sme-seasonality"]);
    expect(facets.periods).toContain("2026-Q2");
  });
});

describe("the community gate is in the reader itself", () => {
  it("returns nothing and audits the denial for an anonymous actor", () => {
    const before = countAudit("read.shared", "deny");
    expect(visibleSharedViews(null)).toEqual([]);
    expect(countAudit("read.shared", "deny")).toBeGreaterThan(before);
  });

  it("returns nothing for an employee with no organisation and no learning role", () => {
    expect(visibleSharedViews(actorFor("dev.emp@azentio.com"))).toEqual([]);
  });

  it("returns the same set to a moderator and to a client, and to either workspace of a multi-membership account", () => {
    const meera = actorFor("meera.mod@azentio.com");
    expect(meera.activeTenantId).toBeNull();
    const forModerator = visibleSharedViews(meera);
    const forClient = visibleSharedViews(maya());
    expect(forModerator.map((row) => row.id)).toEqual(forClient.map((row) => row.id));

    const consultant = actorFor("shared@consult.example");
    expect(visibleSharedViews(consultant)).toEqual([]); // several memberships, none chosen yet
    const atAurora = visibleSharedViews(actorFor("shared@consult.example", "tenant-aurora"));
    const atBeacon = visibleSharedViews(actorFor("shared@consult.example", "tenant-beacon"));
    expect(atBeacon.map((row) => row.id)).toEqual(atAurora.map((row) => row.id));
  });
});

describe("an export is the same rows and the same fields", () => {
  it("writes one CSV line per visible row and no other column", () => {
    const rows = visibleSharedViews(maya());
    const csv = sharedViewsCsv(rows);
    const lines = csv.trimEnd().split("\r\n");

    expect(lines).toHaveLength(rows.length + 1);
    expect(lines[0].split(",")).toEqual([...SHARED_VIEW_DTO_KEYS]);

    const header = lines[0];
    for (const forbidden of FORBIDDEN_SHARED_KEYS) expect(header).not.toContain(forbidden);
  });

  it("counts equal results, which is what the feed and search report", () => {
    const all = visibleSharedViews(maya(), {});
    expect(all.length).toBe(visibleSharedViews(maya(), { limit: 50 }).length);
    expect(visibleSharedViews(maya(), { limit: 2 })).toHaveLength(2);
    expect(visibleSharedViews(maya(), { offering: "sme-credit-decisioning" }).length).toBeLessThanOrEqual(all.length);
  });
});

function countAudit(action: string, decision: string): number {
  return (
    getDb()
      .prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = ? AND decision = ?")
      .get(action, decision) as { n: number }
  ).n;
}
