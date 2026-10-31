import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildActor, createOtp, createSession, loadSession, setActiveTenant, verifyOtp } from "@/lib/session";
import { getDb } from "@/lib/db";
import { listNotifications } from "@/lib/notify";
import { getContribution, canReadContribution } from "@/lib/contributions";
import { visibleSharedViews } from "@/lib/visible";
import { themeVisibilityBySlug } from "@/lib/cohort";
import { visibilityEpoch, withdrawContribution } from "@/lib/withdraw";

// Section 12. Withdrawal is the one write that reaches every reader at once, so this file checks the
// rows it removes, the counter it moves, the people it tells and the clock it reports.

let dataDir: string;

function actorFor(email: string, tenantId?: string) {
  const { code } = createOtp(email);
  const verified = verifyOtp(email, code!);
  const session = createSession(verified.userId!);
  if (tenantId) setActiveTenant(session.sessionId, tenantId);
  return buildActor(loadSession(session.sessionId)!)!;
}

beforeAll(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "azentio-withdraw-"));
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
const userIdOf = (email: string) =>
  (getDb().prepare("SELECT id FROM users WHERE email = ?").get(email) as { id: string }).id;

function sharedViewIds(contributionId: string): string[] {
  return (
    getDb()
      .prepare("SELECT id FROM shared_views WHERE contribution_id = ?")
      .all(contributionId) as { id: string }[]
  ).map((row) => row.id);
}

function grantCount(viewIds: string[]): number {
  if (viewIds.length === 0) return 0;
  const placeholders = viewIds.map(() => "?").join(",");
  return (
    getDb()
      .prepare(`SELECT COUNT(*) AS n FROM idea_evidence_grants WHERE shared_view_id IN (${placeholders})`)
      .get(...viewIds) as { n: number }
  ).n;
}

describe("who may withdraw", () => {
  it("answers 404 for another organisation's item, so existence does not leak", () => {
    const cedar = withdrawContribution(maya(), "contribution-c-cedar-seasonality");
    expect(cedar).toMatchObject({ ok: false, status: 404 });
    expect(getContribution("contribution-c-cedar-seasonality")!.state).toBe("Published");
  });

  it("answers 403 for a viewer who is neither the author nor an organisation admin", () => {
    const viewer = actorFor("shared@consult.example", "tenant-aurora");
    expect(viewer.clientRole).toBe("viewer");
    expect(withdrawContribution(viewer, "contribution-c-aurora-seasonality")).toMatchObject({ ok: false, status: 403 });
  });

  it("refuses a state the machine does not allow, before anyone else is touched", () => {
    const submitted = withdrawContribution(maya(), "contribution-c-aurora-submitted");
    expect(submitted).toMatchObject({ ok: false, status: 409 });
    expect(sharedViewIds("contribution-c-aurora-submitted")).toEqual([]);
  });
});

describe("the withdrawal of Aurora's published item", () => {
  it("suppresses the seasonality theme and reports a clock of all true under a second", () => {
    // Three organisations are behind the theme right now, so it is shown before the withdrawal.
    expect(themeVisibilityBySlug(maya(), "seasonality-context")!.suppressed).toBe(false);

    const before = visibilityEpoch();
    const mayaId = userIdOf("maya@aurora.example");
    const rohanId = userIdOf("rohan.po@azentio.com");

    const result = withdrawContribution(maya(), "contribution-c-aurora-seasonality");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Two organisations are left, so the theme withholds its evidence and its count.
    const theme = themeVisibilityBySlug(maya(), "seasonality-context");
    expect(theme!.suppressed).toBe(true);
    if (!theme!.suppressed) return;
    expect(theme!.evidence).toEqual([]);

    expect(sharedViewIds("contribution-c-aurora-seasonality")).toEqual([]);
    expect(visibilityEpoch()).toBe(before + 1);
    expect(result.clock).not.toBeNull();

    // The product owner of the idea that cited this evidence is told, with an idempotency key.
    const forRohan = listNotifications(rohanId).find((row) => row.kind === "idea.evidence_withdrawn");
    expect(forRohan).toBeDefined();
    expect(
      (
        getDb()
          .prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND kind = 'contribution.withdrawn'")
          .get(mayaId) as { n: number }
      ).n
    ).toBe(1);

    expect(result.clock!.elapsedMs).toBeLessThan(1000);
    expect(result.clock!.checks).toEqual({ search: true, feed: true, theme: true, aira: true });
  });

  it("leaves the feed, the search and the count agreeing on three items", () => {
    const rows = visibleSharedViews(maya());
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.topic).sort()).toEqual(["collections-tone", "sme-seasonality", "sme-seasonality"]);
    expect(rows.map((row) => row.id)).not.toContain("shared-view-contribution-c-aurora-seasonality");
    expect(visibleSharedViews(maya(), { q: "misread" })).toEqual([]);
  });
});

describe("an organisation admin may withdraw a colleague's published item", () => {
  it("purges Beacon's row, its evidence grant and the epoch in one write", () => {
    const admin = actorFor("admin@beacon.example");
    const samId = userIdOf("sam@beacon.example");
    const before = visibilityEpoch();
    const ids = sharedViewIds("contribution-c-beacon-seasonality");
    expect(ids).toHaveLength(1);
    expect(grantCount(ids)).toBe(1);

    const result = withdrawContribution(admin, "contribution-c-beacon-seasonality");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(getContribution("contribution-c-beacon-seasonality")!.state).toBe("Withdrawn");
    expect(sharedViewIds("contribution-c-beacon-seasonality")).toEqual([]);
    expect(grantCount(ids)).toBe(0);
    expect(visibilityEpoch()).toBe(before + 1);
    expect(result.clock).not.toBeNull();

    // The author is notified even though the admin acted.
    const forSam = listNotifications(samId).find((row) => row.kind === "contribution.withdrawn");
    expect(forSam?.message).toContain("An organisation admin withdrew your observation");

    const detail = (
      getDb()
        .prepare("SELECT reason FROM audit_log WHERE action = 'contribution.withdraw' ORDER BY rowid DESC LIMIT 1")
        .get() as { reason: string }
    ).reason;
    expect(detail).toContain("shared view(s) purged");
    expect(detail).toContain("visibility epoch incremented");
  });

  it("hides the withdrawn item from its own organisation, not just the community", () => {
    // The author still sees their own withdrawn record; a colleague who did not act does not.
    expect(canReadContribution(actorFor("sam@beacon.example"), getContribution("contribution-c-beacon-seasonality")!)).toBe(true);
    expect(visibleSharedViews(maya()).map((row) => row.id)).not.toContain("shared-view-contribution-c-beacon-seasonality");
    expect(visibleSharedViews(maya())).toHaveLength(2);
  });
});
