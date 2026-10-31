import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Database from "better-sqlite3";

// Phase 1 guard: `npm run seed` must recreate the full schema and the Section 19 synthetic data.
let db: Database.Database | null = null;
let dataDir: string;

beforeAll(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "azentio-seed-"));
  execFileSync(process.execPath, ["--import", "tsx", "lib/seed.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, DATA_DIR: dataDir, COHORT_MIN: "3", DEMO_MODE: "true" },
    stdio: "pipe",
  });
  db = new Database(path.join(dataDir, "app.db"));
  db.pragma("foreign_keys = ON");
});

afterAll(() => {
  db?.close();
  if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
});

const count = (table: string): number => {
  const row = db!.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number };
  return row.n;
};

describe("seed", () => {
  it("creates every declared table", () => {
    const names = (db!.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[])
      .map((r) => r.name)
      .sort();
    for (const required of [
      "users",
      "employee_provisioning",
      "platform_grants",
      "tenants",
      "memberships",
      "invitations",
      "products",
      "entitlements",
      "sessions",
      "otp_codes",
      "contributions",
      "contribution_flags",
      "shared_views",
      "consents",
      "moderation_decisions",
      "reports",
      "themes",
      "ideas",
      "idea_evidence_grants",
      "idea_status_history",
      "idea_public_updates",
      "notifications",
      "audit_log",
      "media_assets",
      "content_blocks",
      "broadcasts",
      "playground_runs",
      "enquiries",
      "support_grants",
      "config",
    ]) {
      expect(names).toContain(required);
    }
  });

  it("loads the Section 19 catalogue and accounts", () => {
    expect(count("products")).toBe(4);
    expect(count("tenants")).toBe(4);
    expect(count("employee_provisioning")).toBe(6);
    expect((db!.prepare("SELECT COUNT(*) AS n FROM entitlements").get() as { n: number }).n).toBe(6);
    expect(count("contributions")).toBe(6);
    expect(count("themes")).toBe(2);
    expect(count("ideas")).toBe(1);
  });

  it("publishes three distinct organisations on the seasonality topic and one on the suppressed topic", () => {
    const orgs = db!
      .prepare(
        `SELECT COUNT(DISTINCT c.tenant_id) AS n FROM contributions c
         JOIN shared_views s ON s.contribution_id = c.id AND s.state = 'live'
         WHERE c.topic = 'sme-seasonality' AND c.offering_slug = 'sme-credit-decisioning'`,
      )
      .get() as { n: number };
    expect(orgs.n).toBe(3);

    const single = db!
      .prepare(
        `SELECT COUNT(DISTINCT c.tenant_id) AS n FROM contributions c
         JOIN shared_views s ON s.contribution_id = c.id AND s.state = 'live'
         WHERE c.topic = 'collections-tone'`,
      )
      .get() as { n: number };
    expect(single.n).toBe(1);
  });

  it("never lets a draft reach shared views", () => {
    const leaked = db!
      .prepare(
        `SELECT COUNT(*) AS n FROM contributions c JOIN shared_views s ON s.contribution_id = c.id WHERE c.state = 'Draft'`,
      )
      .get() as { n: number };
    expect(leaked.n).toBe(0);
  });

  it("flags the sensitive seeded submission for moderator review", () => {
    const kinds = db!
      .prepare("SELECT kind FROM contribution_flags ORDER BY kind")
      .all() as { kind: string }[];
    expect(kinds.map((k) => k.kind).sort()).toEqual(["amount", "customer_name", "email"]);
  });

  it("coarsens region and period on shared views", () => {
    const view = db!
      .prepare("SELECT region_coarse, period_quarter FROM shared_views WHERE topic = 'sme-seasonality' AND industry = 'Microfinance'")
      .get() as { region_coarse: string; period_quarter: string };
    expect(view.region_coarse).toBe("South India");
    expect(view.period_quarter).toBe("2026-Q2");
  });

  it("records consent per purpose with training always refused", () => {
    const train = db!.prepare("SELECT granted FROM consents WHERE purpose = 'train'").all() as { granted: number }[];
    expect(train.length).toBeGreaterThan(0);
    for (const row of train) expect(row.granted).toBe(0);
  });

  it("writes placeholder private media and the config row", () => {
    expect(fs.existsSync(path.join(dataDir, "private-media", "employee-live.bin"))).toBe(true);
    expect(fs.existsSync(path.join(dataDir, "private-media", "public-showcase.bin"))).toBe(true);
    const epoch = db!.prepare("SELECT value FROM config WHERE key = 'visibility_epoch'").get() as { value: string };
    expect(Number(epoch.value)).toBeGreaterThanOrEqual(1);
    const policy = db!.prepare("SELECT value FROM config WHERE key = 'policy_version'").get() as { value: string };
    expect(policy.value).toBe("v1");
  });
});
