import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authorize } from "@/lib/authorize";
import { buildActor, createOtp, createSession, loadSession, verifyOtp } from "@/lib/session";
import { getDb } from "@/lib/db";
import {
  canReadContribution,
  contributionDTO,
  entitledOfferings,
  getContribution,
  listContributions,
  ownerAudienceOf,
} from "@/lib/contributions";
import { createDraft } from "@/lib/contribution-writes";
import { contributionDraftSchema } from "@/lib/contribution-schema";
import { CROSS_TENANT_DENY_REASONS } from "@/lib/withAuth";

let dataDir: string;

function actorFor(email: string) {
  const { code } = createOtp(email);
  const verified = verifyOtp(email, code!);
  const session = createSession(verified.userId!);
  return buildActor(loadSession(session.sessionId)!)!;
}

beforeAll(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "azentio-contrib-"));
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

const BEACON_DRAFT = "contribution-c-beacon-draft";
const BEACON_PUBLISHED = "contribution-c-beacon-seasonality";

function draftInput(offeringSlug = "sme-credit-decisioning") {
  return contributionDraftSchema.parse({
    title: "Collections chase the same seasonal spike",
    body: "Across three quarters the same month-end pattern appears in small-ticket accounts.",
    type: "market_observation",
    topic: "sme-seasonality",
    offering_slug: offeringSlug,
    period: "2026-08",
    evidence_type: "internal_data",
    confidence: "medium",
    sharing_choice: "private",
    attribution_requested: false,
  });
}

describe("drafts are invisible to everyone else", () => {
  it("hides another member's private draft from the organisation list and from a direct read", () => {
    const sam = actorFor("sam@beacon.example");
    const admin = actorFor("admin@beacon.example");
    const row = getContribution(BEACON_DRAFT)!;

    expect(row.state).toBe("Draft");
    expect(row.sharing_choice).toBe("private");
    expect(canReadContribution(sam, row)).toBe(true);

    const orgList = listContributions(admin, "org");
    expect(orgList.map((item) => item.id)).not.toContain(BEACON_DRAFT);
    expect(canReadContribution(admin, row)).toBe(false);

    // Same organisation, so the audience check alone would let the admin through; the record-level
    // rule is what hides a colleague's private draft.
    expect(authorize(admin, "read.contribution", { audience: `tenant:${row.tenant_id}` }).allow).toBe(true);
  });

  it("keeps a draft out of every shared read", () => {
    const shared = (getDb()
      .prepare("SELECT COUNT(*) AS n FROM shared_views WHERE contribution_id = ?")
      .get(BEACON_DRAFT) as { n: number }).n;
    expect(shared).toBe(0);

    const sam = actorFor("sam@beacon.example");
    const created = createDraft(sam, draftInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(getDb().prepare("SELECT COUNT(*) AS n FROM shared_views WHERE contribution_id = ?").get(created.row.id)).toEqual({ n: 0 });
    expect(listContributions(actorFor("admin@beacon.example"), "org").map((item) => item.id)).not.toContain(created.row.id);
  });

  it("shows the private body only to its author", () => {
    const sam = actorFor("sam@beacon.example");
    const admin = actorFor("admin@beacon.example");
    const row = getContribution(BEACON_DRAFT)!;

    expect(contributionDTO(row, sam.userId).body).toBe(row.body);
    expect(contributionDTO(row, admin.userId).body).toBeNull();
  });

  it("lets an organisation-shared draft appear to colleagues", () => {
    const sam = actorFor("sam@beacon.example");
    const input = { ...draftInput(), sharing_choice: "organisation" as const };
    const created = createDraft(sam, input);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const admin = actorFor("admin@beacon.example");
    expect(listContributions(admin, "org").map((item) => item.id)).toContain(created.row.id);
    expect(getContribution(created.row.id)!.state).toBe("Draft");
  });
});

describe("cross-tenant reads answer as missing records", () => {
  it("gives an Aurora session Beacon's record audience, which the policy denies", () => {
    const aurora = actorFor("maya@aurora.example");
    expect(aurora.activeTenantId).toBe("tenant-aurora");

    const audience = ownerAudienceOf({ id: BEACON_PUBLISHED });
    expect(audience).toBe("tenant:tenant-beacon");

    const decision = authorize(aurora, "read.contribution", { audience: audience! });
    expect(decision.allow).toBe(false);
    // withAuth maps this denial onto 404 because the route is record-scoped.
    expect(CROSS_TENANT_DENY_REASONS.has(decision.reason)).toBe(true);
  });

  it("does not leak existence for a record that does not exist at all", () => {
    const aurora = actorFor("maya@aurora.example");
    expect(ownerAudienceOf({ id: "contribution-does-not-exist" })).toBeNull();
    expect(authorize(aurora, "read.contribution", { audience: "" }).reason).toBe("missing or invalid audience");
  });

  it("refuses an actor with no active organisation", () => {
    const employee = actorFor("meera.mod@azentio.com");
    expect(employee.activeTenantId).toBeNull();
    expect(ownerAudienceOf({ id: BEACON_DRAFT })).toBe("tenant:tenant-beacon");
    expect(authorize(employee, "read.contribution", { audience: "tenant:tenant-beacon" }).allow).toBe(false);
    expect(createDraft(employee, draftInput())).toMatchObject({ ok: false, status: 403 });
  });
});

describe("the request never chooses the tenant", () => {
  it("ignores a tenant id and an author id supplied in the payload", () => {
    const sam = actorFor("sam@beacon.example");
    const hostile = {
      ...draftInput(),
      tenant_id: "tenant-aurora",
      author_id: "user-maya-aurora.example",
      industry: "Finance",
      region: "West India",
      state: "Published",
    } as never;

    const created = createDraft(sam, hostile);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(created.row.tenant_id).toBe("tenant-beacon");
    expect(created.row.author_id).toBe(sam.userId);
    expect(created.row.tenant_id).not.toBe("tenant-aurora");
    expect(created.row.state).toBe("Draft");
    // industry and region come from the organisation record, not from the caller.
    expect(created.row.region).toBe("Pune");
    expect(created.row.industry).toBe("NBFC");
  });

  it("refiles nothing against an offering the organisation is not entitled to", () => {
    const sam = actorFor("sam@beacon.example");
    expect(entitledOfferings("tenant-beacon").map((o) => o.slug)).toContain("sme-credit-decisioning");

    const created = createDraft(sam, draftInput("riva"));
    expect(created).toMatchObject({ ok: false, status: 409, reason: "offering is not entitled to this organisation" });
  });
});
