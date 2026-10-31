import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildActor, createOtp, createSession, loadSession, verifyOtp } from "@/lib/session";
import { getDb } from "@/lib/db";
import { getContribution } from "@/lib/contributions";
import { authorize } from "@/lib/authorize";
import { createDraft } from "@/lib/contribution-writes";
import { moderatorNextStates } from "@/lib/lifecycle";
import { decisionsFor, flagsFor, reviewBundle } from "@/lib/moderation";
import { rejectContribution, resolveFlag, returnToAuthor, startReview } from "@/lib/moderation-actions";
import { publishContribution, unpublishContribution } from "@/lib/publish";
import { FORBIDDEN_SHARED_KEYS, visibleSharedViewById, visibleSharedViews } from "@/lib/visible";
import {
  REDACTED_SUMMARY,
  SENSITIVE_BODY,
  moderationFixtures,
  publishInput,
  sensitiveDraftInput,
} from "./moderation-fixtures";

// Phase 4: the moderator moves, and what a published copy is allowed to carry. The scanner gate and the
// state-machine half of this phase are in tests/lifecycle.test.ts; the field-level rules of the shared
// payload are in tests/visible.test.ts.

let dataDir: string;

function actorFor(email: string) {
  const { code } = createOtp(email);
  const verified = verifyOtp(email, code!);
  const session = createSession(verified.userId!);
  return buildActor(loadSession(session.sessionId)!)!;
}

beforeAll(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "azentio-moderation-"));
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

const { submitSensitiveItem, takeForReview, publishSensitiveItem } = moderationFixtures(actorFor);

describe("moderator actions need the grant and a legal transition", () => {
  it("lets the console screen and the queue API agree on who may open a review", () => {
    // The pages guard themselves with this same call, so a moderator is never locked out of a screen
    // the API already answers for, and a client never reaches a screen the API refuses.
    const meera = actorFor("meera.mod@azentio.com");
    const sam = actorFor("sam@beacon.example");
    expect(authorize(meera, "moderation.review", { audience: "employee" }).allow).toBe(true);
    expect(authorize(sam, "moderation.review", { audience: "employee" }).allow).toBe(false);
  });


  it("refuses every moderator action to an account without learning.moderate", () => {
    const id = submitSensitiveItem();
    const sam = actorFor("sam@beacon.example");
    const openFlag = flagsFor(id)[0].id;

    expect(startReview(sam, id)).toMatchObject({ ok: false, status: 403 });
    expect(returnToAuthor(sam, id, "Not your decision to make.", null)).toMatchObject({ ok: false, status: 403 });
    expect(rejectContribution(sam, id, "Not your decision to make.", null)).toMatchObject({ ok: false, status: 403 });
    expect(resolveFlag(sam, openFlag, "redacted", "Not your decision to make.")).toMatchObject({ ok: false, status: 403 });
    expect(publishContribution(sam, id, publishInput("Beacon Credit"))).toMatchObject({ ok: false, status: 403 });
    expect(unpublishContribution(sam, id, "Not your decision to make.", null)).toMatchObject({ ok: false, status: 403 });
    expect(getContribution(id)!.state).toBe("Submitted");
    expect(flagsFor(id).every((flag) => flag.resolved === 0)).toBe(true);
  });

  it("refuses to open a draft, and refuses an item whose decision is already closed", () => {
    const sam = actorFor("sam@beacon.example");
    const meera = actorFor("meera.mod@azentio.com");
    const draft = createDraft(sam, sensitiveDraftInput());
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;

    expect(startReview(meera, draft.row.id)).toMatchObject({ ok: false, status: 409 });
    expect(publishContribution(meera, draft.row.id, publishInput("Beacon Credit"))).toMatchObject({
      ok: false,
      status: 409,
    });
    expect(getContribution(draft.row.id)!.state).toBe("Draft");

    const id = submitSensitiveItem();
    takeForReview(id);
    const rejected = rejectContribution(meera, id, "The same gap is already described by published items.", null);
    expect(rejected.ok).toBe(true);
    expect(moderatorNextStates("Rejected")).toEqual([]);
    expect(startReview(meera, id)).toMatchObject({ ok: false, status: 409 });
  });

  it("unpublishes a published item so it leaves every shared read", () => {
    const id = submitSensitiveItem();
    publishSensitiveItem(id);
    const meera = actorFor("meera.mod@azentio.com");
    const maya = actorFor("maya@aurora.example");
    const sharedViewId = `shared-view-${id}`;
    expect(visibleSharedViewById(maya, sharedViewId)).not.toBeNull();
    const countBefore = visibleSharedViews(maya).length;

    const unpublished = unpublishContribution(meera, id, "An open report names this summary.", "Investigating the amount quoted.");
    expect(unpublished.ok).toBe(true);
    expect(visibleSharedViews(maya)).toHaveLength(countBefore - 1);
    expect(visibleSharedViewById(maya, sharedViewId)).toBeNull();
    expect(moderatorNextStates("Unpublished")).toEqual(["Published", "Rejected"]);
  });

  it("keeps the private source closed for a draft and open for a reviewer", () => {
    const sam = actorFor("sam@beacon.example");
    const meera = actorFor("meera.mod@azentio.com");
    const id = submitSensitiveItem();

    const underReview = reviewBundle(meera, id)!;
    expect(underReview.sourceAllowed).toBe(true);
    expect(underReview.row.body).toBe(SENSITIVE_BODY);

    const draft = createDraft(sam, sensitiveDraftInput());
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;
    expect(reviewBundle(meera, draft.row.id)!.sourceAllowed).toBe(false);
  });
});

describe("a published copy carries no private material", () => {
  it("shows the coarsened summary and the approved credit, and nothing else", () => {
    const id = submitSensitiveItem();
    publishSensitiveItem(id);

    const maya = actorFor("maya@aurora.example");
    const shared = visibleSharedViewById(maya, `shared-view-${id}`);
    expect(shared).not.toBeNull();
    expect(shared!.summary).toBe(REDACTED_SUMMARY);
    expect(shared!.attribution).toBe("Beacon Credit");
    expect(shared!.region_coarse).toBe("West India");
    expect(shared!.period_quarter).toBe("2026-Q3");

    const serialised = JSON.stringify(shared);
    for (const forbidden of FORBIDDEN_SHARED_KEYS) expect(serialised).not.toContain(`"${forbidden}"`);
    expect(serialised).not.toContain(SENSITIVE_BODY);
    expect(serialised).not.toContain("ops.head@aurora.example");
    expect(serialised).not.toContain("Harbor Foods");
    expect(serialised).not.toContain("2,200,000");
    expect(serialised).not.toContain("Checked against the original");
  });

  it("records the decision chain, notifies the author and audits the moderator", () => {
    const id = submitSensitiveItem();
    publishSensitiveItem(id);

    const decisions = decisionsFor(id).map((decision) => decision.decision);
    expect(decisions).toContain("Published");
    expect(decisions).toContain("Flag redacted");
    expect(decisions).toContain("In review");
    expect(decisionsFor(id).some((decision) => decision.internal_note?.includes("Checked against the original"))).toBe(true);

    const db = getDb();
    const authorNotifications = (db
      .prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND kind = 'moderation.decision'")
      .get(getContribution(id)!.author_id) as { n: number }).n;
    expect(authorNotifications).toBeGreaterThan(0);

    const actions = (db
      .prepare("SELECT DISTINCT action FROM audit_log WHERE action IN ('moderation.review','moderation.publish')")
      .all() as { action: string }[]).map((row) => row.action);
    expect(actions).toContain("moderation.publish");
    expect(actions).toContain("moderation.review");
  });
});
