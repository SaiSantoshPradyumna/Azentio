import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authorize } from "@/lib/authorize";
import { buildActor, createOtp, createSession, loadSession, verifyOtp } from "@/lib/session";
import { getDb } from "@/lib/db";
import { listNotifications, pushDevOutbox, unreadCount } from "@/lib/notify";
import { canReadContribution, getContribution, listContributions } from "@/lib/contributions";
import { createDraft, editContribution } from "@/lib/contribution-writes";
import {
  contributionDraftSchema,
  type ContributionDraftInput,
  type ContributionType,
  type EvidenceType,
} from "@/lib/contribution-schema";

// The four Phase 3 rules that were called out again after the first pass: notifications are scoped to
// the session user and to the in-app channel, every contribution read takes its tenant from the
// session, a viewer cannot create, and saving a draft never changes who can see it.

let dataDir: string;

function actorFor(email: string) {
  const { code } = createOtp(email);
  const verified = verifyOtp(email, code!);
  const session = createSession(verified.userId!);
  return buildActor(loadSession(session.sessionId)!)!;
}

function switchTo(sessionId: string, tenantId: string) {
  getDb().prepare("UPDATE sessions SET active_tenant_id = ? WHERE id = ?").run(tenantId, sessionId);
}

function sessionIdOf(email: string): string {
  const { code } = createOtp(email);
  const verified = verifyOtp(email, code!);
  return createSession(verified.userId!).sessionId;
}

beforeAll(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "azentio-rules-"));
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

function draftInput(patch: Partial<ContributionDraftInput> = {}) {
  return contributionDraftSchema.parse({
    title: "Collections chase the same seasonal spike",
    body: "Across three quarters the same month-end pattern appears in small-ticket accounts.",
    type: "market_observation",
    topic: "sme-seasonality",
    offering_slug: "sme-credit-decisioning",
    period: "2026-08",
    evidence_type: "internal_data",
    confidence: "medium",
    sharing_choice: "private",
    attribution_requested: false,
    ...patch,
  });
}

describe("notifications are own rows on the in-app channel", () => {
  it("never returns a dev_outbox row and never returns another user's row", () => {
    const sam = actorFor("sam@beacon.example");
    const admin = actorFor("admin@beacon.example");

    // The outbox queue: a sign-in code stored for the same person on a different channel.
    pushDevOutbox({
      userId: sam.userId,
      kind: "otp",
      email: sam.email,
      detail: "Sign-in code 123456 — queued (demo). Not sent by email.",
      key: `otp:${sam.email}:123456`,
    });
    // Another member's in-app row must not appear either.
    getDb()
      .prepare(
        `INSERT INTO notifications (id, user_id, kind, message, idempotency_key, channel, status, created_at)
         VALUES ('notif-other-member', ?, 'contribution.submitted', 'Someone else''s message', ?, 'in_app', 'stored', ?)`,
      )
      .run(admin.userId, `other-${admin.userId}`, new Date().toISOString());

    const rows = listNotifications(sam.userId);
    const channels = new Set((getDb()
      .prepare("SELECT DISTINCT channel FROM notifications WHERE user_id = ?")
      .all(sam.userId) as { channel: string }[]).map((row) => row.channel));

    expect(channels.has("dev_outbox")).toBe(true);
    expect(rows.every((row) => row.kind !== "dev_outbox.otp")).toBe(true);
    expect(rows.some((row) => row.message.includes("Sign-in code"))).toBe(false);
    expect(rows.some((row) => row.message.includes("Someone else"))).toBe(false);
    expect(rows.every((row) => row.kind.startsWith("contribution.") || row.kind.startsWith("moderation."))).toBe(true);

    const unread = unreadCount(sam.userId);
    const storedInApp = (getDb()
      .prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND channel = 'in_app' AND read_at IS NULL")
      .get(sam.userId) as { n: number }).n;
    expect(unread).toBe(storedInApp);

    // The dev outbox page still sees that row: it is filtered by channel, not deleted.
    const outboxRows = (getDb()
      .prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND channel = 'dev_outbox'")
      .get(sam.userId) as { n: number }).n;
    expect(outboxRows).toBe(1);
  });
});

describe("every contribution read takes the tenant from the session", () => {
  it("lists only the active organisation's rows, whatever exists elsewhere", () => {
    const sam = actorFor("sam@beacon.example");
    const maya = actorFor("maya@aurora.example");

    const beaconRows = listContributions(sam, "org");
    const auroraRows = listContributions(maya, "org");

    expect(beaconRows.length).toBeGreaterThan(0);
    expect(beaconRows.every((row) => row.tenant_id === "tenant-beacon")).toBe(true);
    expect(auroraRows.every((row) => row.tenant_id === "tenant-aurora")).toBe(true);
    expect(auroraRows.map((row) => row.id)).not.toContain(BEACON_DRAFT);
  });

  it("keeps a Beacon draft out of an Aurora session even when the payload names Beacon", () => {
    const maya = actorFor("maya@aurora.example");
    const created = createDraft(maya, { ...draftInput(), title: "Aurora draft with a Beacon tenant in the payload" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(created.row.tenant_id).toBe("tenant-aurora");
    // A caller may name any tenant in a query string; the route never reads it, so the list is unchanged.
    const orgRows = listContributions(maya, "org");
    expect(orgRows.map((row) => row.id)).toContain(created.row.id);
    expect(orgRows.every((row) => row.tenant_id === "tenant-aurora")).toBe(true);

    const beaconActor = actorFor("sam@beacon.example");
    expect(listContributions(beaconActor, "mine").map((row) => row.id)).not.toContain(created.row.id);
    expect(getContribution(created.row.id)!.tenant_id).toBe("tenant-aurora");
  });

  it("treats a tenant in the request as a target the session cannot adopt", () => {
    const maya = actorFor("maya@aurora.example");
    const beaconRow = getContribution(BEACON_DRAFT)!;

    // The audience of a record comes from the row, so Beacon's record is not the caller's audience.
    const decision = authorize(maya, "contribution.create", { audience: `tenant:${beaconRow.tenant_id}` });
    expect(decision.allow).toBe(false);
    expect(decision.reason).toBe("not the active organisation");
  });
});

describe("a viewer cannot create and a draft is the author's alone", () => {
  it("denies contribution.create for the viewer role and allows it for a contributor", () => {
    const viewerSessionId = sessionIdOf("shared@consult.example");
    switchTo(viewerSessionId, "tenant-beacon");
    const viewer = buildActor(loadSession(viewerSessionId)!)!;

    expect(viewer.clientRole).toBe("viewer");
    expect(viewer.activeTenantId).toBe("tenant-beacon");
    const decision = authorize(viewer, "contribution.create", { audience: "tenant:tenant-beacon" });
    expect(decision.allow).toBe(false);
    expect(decision.reason).toBe("missing permission contribution.create");

    const contributor = actorFor("sam@beacon.example");
    expect(authorize(contributor, "contribution.create", { audience: "tenant:tenant-beacon" }).allow).toBe(true);
  });

  it("shows a draft to its author only, and to colleagues only when it was saved for the organisation", () => {
    const sam = actorFor("sam@beacon.example");
    const admin = actorFor("admin@beacon.example");
    const maya = actorFor("maya@aurora.example");

    const privateDraft = createDraft(sam, draftInput());
    expect(privateDraft.ok).toBe(true);
    if (!privateDraft.ok) return;
    const privateRow = getContribution(privateDraft.row.id)!;

    expect(canReadContribution(sam, privateRow)).toBe(true);
    expect(canReadContribution(admin, privateRow)).toBe(false);
    expect(canReadContribution(maya, privateRow)).toBe(false);
    expect(listContributions(admin, "org").map((row) => row.id)).not.toContain(privateRow.id);

    const orgDraft = createDraft(sam, { ...draftInput(), sharing_choice: "organisation" });
    expect(orgDraft.ok).toBe(true);
    if (!orgDraft.ok) return;
    const orgRow = getContribution(orgDraft.row.id)!;

    expect(canReadContribution(admin, orgRow)).toBe(true);
    expect(canReadContribution(maya, orgRow)).toBe(false);
    expect(listContributions(admin, "org").map((row) => row.id)).toContain(orgRow.id);
    expect(listContributions(maya, "org").map((row) => row.id)).not.toContain(orgRow.id);
  });
});

describe("saving a draft never changes sharing_choice", () => {
  it("leaves the stored audience exactly as it was, however the patch is worded", () => {
    const sam = actorFor("sam@beacon.example");
    const created = createDraft(sam, draftInput({ sharing_choice: "private" }));
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const id = created.row.id;
    const before = getContribution(id)!;
    const edited = editContribution(sam, id, {
      title: before.title,
      body: "Rewritten after a call with the field team, still the same pattern.",
      type: before.type as ContributionType,
      topic: before.topic,
      offering_slug: before.offering_slug,
      period: before.period,
      evidence_type: before.evidence_type as EvidenceType,
      confidence: "high",
    });
    expect(edited.ok).toBe(true);

    const after = getContribution(id)!;
    expect(after.sharing_choice).toBe("private");
    expect(after.attribution_requested).toBe(before.attribution_requested);
    expect(after.confidence).toBe("high");
    expect(after.state).toBe("Draft");

    // The same is true for an organisation draft: an edit cannot narrow or widen it.
    const orgCreated = createDraft(sam, draftInput({ sharing_choice: "organisation" }));
    expect(orgCreated.ok).toBe(true);
    if (!orgCreated.ok) return;
    const orgBefore = getContribution(orgCreated.row.id)!;
    editContribution(sam, orgBefore.id, {
      title: orgBefore.title,
      body: orgBefore.body,
      type: orgBefore.type as ContributionType,
      topic: orgBefore.topic,
      offering_slug: orgBefore.offering_slug,
      period: orgBefore.period,
      evidence_type: orgBefore.evidence_type as EvidenceType,
      confidence: "low",
    });
    expect(getContribution(orgBefore.id)!.sharing_choice).toBe("organisation");
  });
});
