import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildActor, createOtp, createSession, loadSession, verifyOtp } from "@/lib/session";
import { getDb } from "@/lib/db";
import { consentMatrix, readConsents, recordConsents } from "@/lib/consents";
import { canReadContribution, getContribution, listContributions } from "@/lib/contributions";
import {
  createDraft,
  editContribution,
  submitContribution,
} from "@/lib/contribution-writes";
import { withdrawContribution } from "@/lib/withdraw";
import { actorNextStates, canTransition, moderatorNextStates } from "@/lib/lifecycle";
import { flagsFor } from "@/lib/moderation";
import { returnToAuthor } from "@/lib/moderation-actions";
import { publishContribution } from "@/lib/publish";
import {
  contributionDraftSchema,
  type ConfidenceLevel,
  type ContributionType,
  type EvidenceType,
} from "@/lib/contribution-schema";
import { moderationFixtures, publishInput } from "./moderation-fixtures";

let dataDir: string;

function actorFor(email: string) {
  const { code } = createOtp(email);
  const verified = verifyOtp(email, code!);
  const session = createSession(verified.userId!);
  return buildActor(loadSession(session.sessionId)!)!;
}

beforeAll(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "azentio-lifecycle-"));
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

describe("consents follow the sharing decision", () => {
  it("matches the Section 11 table", () => {
    expect(consentMatrix("private", false)).toEqual({ process: true, publish: false, attribute: false, train: false });
    expect(consentMatrix("organisation", true)).toEqual({ process: true, publish: false, attribute: false, train: false });
    expect(consentMatrix("community", false)).toEqual({ process: true, publish: true, attribute: false, train: false });
    expect(consentMatrix("community", true)).toEqual({ process: true, publish: true, attribute: true, train: false });
  });

  it("records four rows on submit and never grants train", () => {
    const sam = actorFor("sam@beacon.example");
    const created = createDraft(sam, draftInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(readConsents(created.row.id)).toHaveLength(0);

    const submitted = submitContribution(sam, created.row.id, { sharing_choice: "community", attribution_requested: true });
    expect(submitted.ok).toBe(true);

    const consents = readConsents(created.row.id);
    expect(consents.map((row) => row.purpose).sort()).toEqual(["attribute", "process", "publish", "train"]);
    expect(consents.find((row) => row.purpose === "train")!.granted).toBe(0);
    expect(consents.find((row) => row.purpose === "publish")!.granted).toBe(1);
    expect(consents.every((row) => row.policy_version === "v1")).toBe(true);

    // Submitting again updates the same rows instead of widening them silently.
    recordConsents(created.row.id, sam.userId, "private", false);
    const rewritten = readConsents(created.row.id);
    expect(rewritten).toHaveLength(4);
    expect(rewritten.find((row) => row.purpose === "publish")!.granted).toBe(0);
  });

  it("notifies the author and the review queue on submit", () => {
    const maya = actorFor("maya@aurora.example");
    const created = createDraft(maya, { ...draftInput(), sharing_choice: "organisation" as const });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    submitContribution(maya, created.row.id, { sharing_choice: "organisation", attribution_requested: false });

    const db = getDb();
    const forAuthor = (db
      .prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND kind = 'contribution.submitted'")
      .get(maya.userId) as { n: number }).n;
    const forModerators = (db
      .prepare("SELECT COUNT(*) AS n FROM notifications WHERE kind = 'moderation.queue'")
      .get() as { n: number }).n;
    expect(forAuthor).toBeGreaterThan(0);
    expect(forModerators).toBeGreaterThan(0);
  });
});

describe("the state machine decides what the UI may offer", () => {
  it("refuses an illegal transition with a conflict", () => {
    const maya = actorFor("maya@aurora.example");
    const alreadySubmitted = "contribution-c-aurora-submitted";
    expect(getContribution(alreadySubmitted)!.state).toBe("Submitted");

    const again = submitContribution(maya, alreadySubmitted, { sharing_choice: "community", attribution_requested: false });
    expect(again).toMatchObject({ ok: false, status: 409 });
    expect(canTransition("Submitted", "Submitted")).toBe(false);
    expect(canTransition("Submitted", "Published")).toBe(false);
    expect(canTransition("Draft", "Published")).toBe(false);
  });

  it("only lets the author edit a draft or a returned item", () => {
    const sam = actorFor("sam@beacon.example");
    const admin = actorFor("admin@beacon.example");
    const published = getContribution(BEACON_PUBLISHED)!;
    const fields = {
      title: published.title,
      body: published.body,
      type: published.type as ContributionType,
      topic: published.topic,
      offering_slug: published.offering_slug,
      period: published.period,
      evidence_type: published.evidence_type as EvidenceType,
      confidence: published.confidence as ConfidenceLevel,
    };

    // A colleague in the same organisation is not the author.
    expect(editContribution(admin, BEACON_PUBLISHED, fields)).toMatchObject({ ok: false, status: 403 });

    // The author may not edit once a moderator has published it.
    expect(editContribution(sam, BEACON_PUBLISHED, fields)).toMatchObject({ ok: false, status: 409 });

    // A record in another organisation answers as missing before any of that is considered.
    expect(editContribution(actorFor("maya@aurora.example"), BEACON_PUBLISHED, fields)).toMatchObject({
      ok: false,
      status: 404,
    });
  });

  it("withdraws a draft, and withdraws a published item through the Section 12 purge", () => {
    const sam = actorFor("sam@beacon.example");
    const created = createDraft(sam, draftInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const draft = withdrawContribution(sam, created.row.id);
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;
    // A draft has no shared row, so there is nothing to time the removal of.
    expect(draft.clock).toBeNull();
    expect(getContribution(created.row.id)!.state).toBe("Withdrawn");
    expect(listContributions(sam, "mine").map((item) => item.id)).toContain(created.row.id);
    expect(canReadContribution(actorFor("admin@beacon.example"), getContribution(created.row.id)!)).toBe(false);

    const publishedWithdrawal = withdrawContribution(sam, BEACON_PUBLISHED);
    expect(publishedWithdrawal.ok).toBe(true);
    if (!publishedWithdrawal.ok) return;
    expect(getContribution(BEACON_PUBLISHED)!.state).toBe("Withdrawn");
    expect(publishedWithdrawal.clock?.checks).toEqual({ search: true, feed: true, theme: true, aira: true });

    const inReview = withdrawContribution(sam, BEACON_PUBLISHED);
    expect(inReview).toMatchObject({ ok: false, status: 409 });
  });

  it("keeps the audit trail unbroken through the lifecycle", () => {
    const db = getDb();
    const actions = (db
      .prepare("SELECT DISTINCT action FROM audit_log WHERE action LIKE 'contribution.%'")
      .all() as { action: string }[]).map((row) => row.action);
    expect(actions).toContain("contribution.create");
    expect(actions).toContain("contribution.submit");
    expect(actions).toContain("contribution.withdraw");

    const broken = db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE prev_hash = ''").get() as { n: number };
    expect(broken.n).toBe(0);
  });

  it("offers Withdraw exactly where the machine allows it", () => {
    // The author of a published item owns its withdrawal; an admin acts for the organisation, and a
    // colleague's draft is nobody else's to withdraw.
    expect(actorNextStates("Published", { isAuthor: true, isOrgAdmin: false })).toContain("Withdrawn");
    expect(actorNextStates("Unpublished", { isAuthor: true, isOrgAdmin: false })).toContain("Withdrawn");
    expect(actorNextStates("Published", { isAuthor: false, isOrgAdmin: true })).toContain("Withdrawn");
    expect(actorNextStates("Draft", { isAuthor: false, isOrgAdmin: true })).not.toContain("Withdrawn");
    expect(actorNextStates("Draft", { isAuthor: true, isOrgAdmin: false })).toContain("Withdrawn");
    expect(actorNextStates("Submitted", { isAuthor: true, isOrgAdmin: true })).not.toContain("Withdrawn");
    expect(actorNextStates("Withdrawn", { isAuthor: true, isOrgAdmin: true })).toEqual([]);
  });
});

// Phase 4: the scanner runs on submit, and an unresolved hint is what keeps an item out of the feed.

const { submitSensitiveItem, takeForReview, resolveEveryHint } = moderationFixtures(actorFor);

describe("the scanner runs on submit and blocks publishing", () => {
  it("shows the three hints the seeded submitted item was filed with", () => {
    const seeded = "contribution-c-aurora-submitted";
    const flags = flagsFor(seeded);
    expect(flags.map((flag) => flag.kind).sort()).toEqual(["amount", "customer_name", "email"]);
    expect(flags.every((flag) => flag.resolved === 0)).toBe(true);

    // Submitted has no edge to Published, so an unreviewed item cannot be published at all.
    expect(canTransition("Submitted", "Published")).toBe(false);
    expect(moderatorNextStates("Submitted")).toEqual(["In review"]);
  });

  it("stores a fresh hint for text the author submitted", () => {
    const id = submitSensitiveItem();
    expect(flagsFor(id).map((flag) => flag.kind).sort()).toEqual(["amount", "customer_name", "email"]);
    expect(getContribution(id)!.state).toBe("Submitted");
  });

  it("keeps publishing blocked until a moderator resolves every hint, then publishes", () => {
    const id = submitSensitiveItem();
    const meera = actorFor("meera.mod@azentio.com");
    takeForReview(id);

    const blocked = publishContribution(meera, id, publishInput("Beacon Credit"));
    expect(blocked).toMatchObject({ ok: false, status: 409 });
    if (blocked.ok) return;
    expect(blocked.reason).toContain("scanner hint(s) unresolved");
    expect(getContribution(id)!.state).toBe("In review");

    resolveEveryHint(id);
    const published = publishContribution(meera, id, publishInput("Beacon Credit"));
    expect(published.ok).toBe(true);
    expect(getContribution(id)!.state).toBe("Published");
  });

  it("re-scans when an author fixes a returned item and submits it again", () => {
    const sam = actorFor("sam@beacon.example");
    const meera = actorFor("meera.mod@azentio.com");
    const id = submitSensitiveItem();

    takeForReview(id);
    const returned = returnToAuthor(meera, id, "Remove the address and the facility amount, then resubmit.", null);
    expect(returned.ok).toBe(true);
    expect(getContribution(id)!.state).toBe("Returned");

    const row = getContribution(id)!;
    const edited = editContribution(sam, id, {
      title: row.title,
      body: "Manual seasonal caveats are added by hand because the comparison screen shows a flat annual average only.",
      type: row.type as ContributionType,
      topic: row.topic,
      offering_slug: row.offering_slug,
      period: row.period,
      evidence_type: row.evidence_type as EvidenceType,
      confidence: row.confidence as ConfidenceLevel,
    });
    expect(edited.ok).toBe(true);

    submitContribution(sam, id, { sharing_choice: "community", attribution_requested: true });
    expect(getContribution(id)!.state).toBe("Submitted");
    // The hints of the old text are gone: the scan belongs to the text now in front of the reviewer.
    expect(flagsFor(id)).toEqual([]);
  });
});
