import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authorize } from "@/lib/authorize";
import { getDb } from "@/lib/db";
import { canMoveIdea, ideaTransitionRule, isIdeaStatus, nextIdeaStatuses } from "@/lib/idea-lifecycle";
import { approvePublicUpdate, proposePublicUpdate } from "@/lib/idea-updates";
import { ideaCreateSchema } from "@/lib/idea-schema";
import { createIdea, grantEvidence, moveIdeaStatus, revokeEvidence } from "@/lib/idea-writes";
import {
  clientIdeas,
  evidenceGrantIds,
  getIdea,
  ideaCounters,
  ideaEvidence,
  ideaHistory,
  pendingUpdates,
} from "@/lib/ideas";
import { listNotifications } from "@/lib/notify";
import { buildActor, createOtp, createSession, loadSession, setActiveTenant, verifyOtp } from "@/lib/session";
import { FORBIDDEN_SHARED_KEYS } from "@/lib/visible";
import type { Author } from "@/lib/contributions";

// Section 14 and Section 22's Phase 6 definition of done: only a product owner opens an idea, only the
// legal status edges are allowed, evidence is exactly the grants, and a client reads only the text a
// moderator's account stands behind.

let dataDir: string;

function actorFor(email: string, tenantId?: string): Author {
  const { code } = createOtp(email);
  const verified = verifyOtp(email, code!);
  const session = createSession(verified.userId!);
  if (tenantId) setActiveTenant(session.sessionId, tenantId);
  return buildActor(loadSession(session.sessionId)!)!;
}

beforeAll(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "azentio-ideas-"));
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

const rohan = () => actorFor("rohan.po@azentio.com");
const meera = () => actorFor("meera.mod@azentio.com");
const devEmp = () => actorFor("dev.emp@azentio.com");
const maya = () => actorFor("maya@aurora.example");
const IDEA_ID = "idea-seasonality-explanation";

const newIdeaInput = ideaCreateSchema.parse({
  title: "Explain why a rejected application can be re-submitted",
  problem: "A client is told a decision without being told what would change it, so the same file returns unchanged.",
  outcome: "Show the two or three inputs that moved a decision, with the human approval step named.",
  owner_team: "Credit Decisioning",
  offering_slug: "sme-credit-decisioning",
  priority: "high",
});

function auditReasons(action: string): string[] {
  return (getDb().prepare("SELECT reason FROM audit_log WHERE action = ? ORDER BY rowid").all(action) as { reason: string }[]).map(
    (row) => row.reason,
  );
}

function count(table: string): number {
  return (getDb().prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
}

describe("only a product owner opens an idea", () => {
  it("refuses an employee without the grant and a client account, and writes nothing", () => {
    const before = count("ideas");
    expect(authorize(devEmp(), "idea.write", { audience: "employee" }).allow).toBe(false);
    expect(createIdea(devEmp(), newIdeaInput)).toMatchObject({ ok: false, status: 403 });
    expect(createIdea(maya(), newIdeaInput)).toMatchObject({ ok: false, status: 403 });
    expect(count("ideas")).toBe(before);
  });

  it("opens as Proposed with an opening history row and an audit entry", () => {
    const created = createIdea(rohan(), newIdeaInput);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(created.idea.status).toBe("Proposed");
    expect(created.idea.priority).toBe("high");

    const history = ideaHistory(created.idea.id);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ from_status: null, to_status: "Proposed" });
    expect(auditReasons("idea.write").some((reason) => reason.includes(created.idea.id))).toBe(true);

    // The status is not an editable field: an idea only moves through the machine.
    expect(
      (getDb().prepare("SELECT status FROM ideas WHERE id = ?").get(created.idea.id) as { status: string }).status,
    ).toBe("Proposed");
  });

  it("refuses an offering that is not a product", () => {
    expect(createIdea(rohan(), { ...newIdeaInput, title: "Another idea entirely", offering_slug: "not-a-product" })).toMatchObject({
      ok: false,
      status: 409,
    });
  });
});

describe("the status machine", () => {
  it("offers exactly the Section 14 edges", () => {
    expect(nextIdeaStatuses("Proposed")).toEqual(["Under review", "Not proceeding"]);
    expect(nextIdeaStatuses("Under review")).toEqual(["Planned", "Not proceeding"]);
    expect(nextIdeaStatuses("Planned")).toEqual(["In progress", "Not proceeding"]);
    expect(nextIdeaStatuses("In progress")).toEqual(["Released", "Not proceeding"]);
    expect(nextIdeaStatuses("Released")).toEqual([]);
    expect(nextIdeaStatuses("Not proceeding")).toEqual([]);
    expect(canMoveIdea("Proposed", "Released")).toBe(false);
    expect(ideaTransitionRule("Proposed", "In progress")).toBeNull();
  });

  it("refuses Proposed to Released with 409 and records nothing", () => {
    const idea = getIdea(IDEA_ID)!;
    const historyBefore = count("idea_status_history");
    const moved = moveIdeaStatus(rohan(), IDEA_ID, "Released", "Ship it now.");
    expect(moved).toMatchObject({ ok: false, status: 409 });
    expect(getIdea(IDEA_ID)!.status).toBe(idea.status);
    expect(count("idea_status_history")).toBe(historyBefore);
  });

  it("refuses the same-status move as well", () => {
    expect(moveIdeaStatus(rohan(), IDEA_ID, "Under review", "Nothing has changed.")).toMatchObject({ ok: false, status: 409 });
  });

  it("records a legal move with its reason, history row and audit", () => {
    const moved = moveIdeaStatus(rohan(), IDEA_ID, "Planned", "The team has taken it into the plan.");
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(moved.idea.status).toBe("Planned");

    const [latest] = ideaHistory(IDEA_ID);
    expect(latest).toMatchObject({ from_status: "Under review", to_status: "Planned", actor_email: "rohan.po@azentio.com" });
    expect(latest.reason).toBe("The team has taken it into the plan.");
    expect(auditReasons("idea.write").some((reason) => reason.includes("Under review to Planned"))).toBe(true);
  });

  it("refuses an idea id that is not there", () => {
    expect(moveIdeaStatus(rohan(), "idea-nope", "Planned", "No such idea.")).toMatchObject({ ok: false, status: 404 });
    expect(isIdeaStatus("Shipped")).toBe(false);
  });
});

describe("evidence is only what the idea was granted", () => {
  it("lists the three granted shared copies for the owner and nothing else", () => {
    const evidence = ideaEvidence(rohan(), IDEA_ID);
    expect(evidence.map((row) => row.id).sort()).toEqual(evidenceGrantIds(IDEA_ID).sort());
    expect(evidence).toHaveLength(3);
    expect(evidence.map((row) => row.id)).not.toContain("shared-view-contribution-c-delta-collections");
  });

  it("returns only shared-view keys, never an author, tenant or note", () => {
    for (const row of ideaEvidence(rohan(), IDEA_ID)) {
      for (const forbidden of FORBIDDEN_SHARED_KEYS) expect(row).not.toHaveProperty(forbidden);
    }
  });

  it("refuses an owner action from an account without the grant", () => {
    expect(grantEvidence(devEmp(), IDEA_ID, "shared-view-contribution-c-delta-collections")).toMatchObject({
      ok: false,
      status: 403,
    });
  });

  it("refuses to attach a shared copy it cannot read, and to detach one not attached", () => {
    expect(grantEvidence(rohan(), IDEA_ID, "shared-view-does-not-exist")).toMatchObject({ ok: false, status: 404 });
    expect(revokeEvidence(rohan(), IDEA_ID, "shared-view-contribution-c-delta-collections")).toMatchObject({
      ok: false,
      status: 404,
    });
  });

  it("detaches and re-attaches, and the count follows the grants", () => {
    const detached = revokeEvidence(rohan(), IDEA_ID, "shared-view-contribution-c-cedar-seasonality");
    expect(detached.ok).toBe(true);
    expect(ideaEvidence(rohan(), IDEA_ID)).toHaveLength(2);
    expect(ideaCounters(IDEA_ID).grants).toBe(2);

    const attached = grantEvidence(rohan(), IDEA_ID, "shared-view-contribution-c-cedar-seasonality");
    expect(attached.ok).toBe(true);
    expect(ideaEvidence(rohan(), IDEA_ID)).toHaveLength(3);
  });
});

describe("the client reads only approved text", () => {
  const HELD = "The plan is written down. Nothing here is a date, and the work has not started.";

  it("shows the seeded approved update in the client shape", () => {
    const aurora = clientIdeas("tenant-aurora");
    const idea = aurora.find((row) => row.id === IDEA_ID)!;
    expect(idea).toBeDefined();
    expect(idea.approved_text).toContain("under review and is not a delivery commitment");
    expect(Object.keys(idea).sort()).toEqual([
      "approved_text",
      "id",
      "last_update_at",
      "offering_slug",
      "owner_team",
      "status_plain",
      "title",
    ]);
    expect(idea.status_plain).not.toBe(getIdea(IDEA_ID)!.status);
  });

  it("holds a product owner's new text back until a moderator approves it", () => {
    const proposed = proposePublicUpdate(rohan(), IDEA_ID, HELD);
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;
    expect(proposed.approved).toBe(false);

    // Still invisible: the client sees the previously approved text.
    expect(clientIdeas("tenant-aurora").find((row) => row.id === IDEA_ID)!.approved_text).not.toBe(HELD);

    // Every moderator was told, with an idempotency key per moderator.
    const pending = pendingUpdates();
    expect(pending.map((row) => row.id)).toContain(proposed.update.id);
    expect(
      listNotifications((getDb().prepare("SELECT user_id FROM platform_grants WHERE permission = 'learning.moderate'").get() as { user_id: string }).user_id).some(
        (row) => row.kind === "idea.update.pending" && row.message.includes(HELD),
      ),
    ).toBe(true);

    const approved = approvePublicUpdate(meera(), IDEA_ID, proposed.update.id);
    expect(approved.ok).toBe(true);
    expect(clientIdeas("tenant-aurora").find((row) => row.id === IDEA_ID)!.approved_text).toBe(HELD);
    expect(pendingUpdates().map((row) => row.id)).not.toContain(proposed.update.id);

    // The author is told, and a second approval is a conflict rather than a silent rewrite.
    expect(
      listNotifications("user-rohan.po").some(
        (row) => row.kind === "idea.update.approved" && row.message.includes("approved the client update"),
      ),
    ).toBe(true);
    expect(approvePublicUpdate(meera(), IDEA_ID, proposed.update.id)).toMatchObject({ ok: false, status: 409 });
  });

  it("refuses a moderator writing the text, and a writer approving it", () => {
    expect(proposePublicUpdate(meera(), IDEA_ID, "A moderator cannot author the client-facing text.")).toMatchObject({
      ok: false,
      status: 403,
    });
    const newest = pendingUpdates();
    expect(newest.every((row) => !row.text.startsWith("A moderator cannot"))).toBe(true);

    const target = clientIdeas("tenant-aurora").find((row) => row.id === IDEA_ID)!;
    expect(target.approved_text).toBe(HELD);
    // The grant is checked before the record, so a writer cannot approve their own text.
    expect(approvePublicUpdate(rohan(), IDEA_ID, "idea-update-1")).toMatchObject({ ok: false, status: 403 });
  });

  it("counts what is waiting, so the console badge and the API agree", () => {
    const counters = ideaCounters(IDEA_ID);
    expect(counters.updates).toBe(2);
    expect(counters.pending).toBe(0);
    expect(pendingUpdates()).toHaveLength(0);
  });
});
