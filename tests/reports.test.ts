import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authorize } from "@/lib/authorize";
import type { Author } from "@/lib/contributions";
import { getContribution } from "@/lib/contributions";
import { getDb } from "@/lib/db";
import { themeVisibilityBySlug } from "@/lib/cohort";
import { sharedViewsCsv } from "@/lib/export";
import { openReports } from "@/lib/moderation";
import { listNotifications } from "@/lib/notify";
import { unpublishContribution } from "@/lib/publish";
import { hasOpenReport, reportSharedView, resolveReport } from "@/lib/reports";
import { buildActor, createOtp, createSession, loadSession, setActiveTenant, verifyOtp } from "@/lib/session";
import { ideaEvidence } from "@/lib/ideas";
import { visibleSharedViews } from "@/lib/visible";

// Section 9's report row and Section 22's AT-10: a report suspends the shared copy and tells the
// author. The record itself does not move — a moderator decides whether the copy comes back or the
// item is taken out — and every read path that goes through lib/visible.ts loses it in the same commit.

let dataDir: string;

function actorFor(email: string, tenantId?: string): Author {
  const { code } = createOtp(email);
  const verified = verifyOtp(email, code!);
  const session = createSession(verified.userId!);
  if (tenantId) setActiveTenant(session.sessionId, tenantId);
  return buildActor(loadSession(session.sessionId)!)!;
}

beforeAll(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "azentio-reports-"));
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
const sam = () => actorFor("sam@beacon.example");
const meera = () => actorFor("meera.mod@azentio.com");
const rohan = () => actorFor("rohan.po@azentio.com");

const BEACON = "shared-view-contribution-c-beacon-seasonality";
const BEACON_ITEM = "contribution-c-beacon-seasonality";
const DELTA = "shared-view-contribution-c-delta-collections";
const DELTA_ITEM = "contribution-c-delta-collections";

const viewState = (id: string) => (getDb().prepare("SELECT state FROM shared_views WHERE id = ?").get(id) as { state: string } | undefined)?.state;
const userIdOf = (email: string) => (getDb().prepare("SELECT id FROM users WHERE email = ?").get(email) as { id: string }).id;

function reportRow(id: string): { status: string } | undefined {
  return getDb().prepare("SELECT status FROM reports WHERE id = ?").get(id) as { status: string } | undefined;
}

describe("a report suspends the shared copy", () => {
  let reportId = "";

  it("leaves the feed, the search, the export, the theme and the idea evidence in one commit", () => {
    expect(visibleSharedViews(maya())).toHaveLength(4);
    expect(themeVisibilityBySlug(maya(), "seasonality-context")!.suppressed).toBe(false);
    expect(ideaEvidence(rohan(), "idea-seasonality-explanation")).toHaveLength(3);

    const raised = reportSharedView(maya(), BEACON, "This repeats a figure that identifies the borrower group.");
    expect(raised.ok).toBe(true);
    if (!raised.ok) return;
    reportId = raised.reportId;
    expect(raised.suspended).toBe(true);

    expect(viewState(BEACON)).toBe("suspended");
    expect(getContribution(BEACON_ITEM)!.state).toBe("Published");

    const feed = visibleSharedViews(maya()).map((row) => row.id);
    expect(feed).not.toContain(BEACON);
    expect(feed).toHaveLength(3);
    expect(visibleSharedViews(maya(), { q: "seasonal sales peaks" })).toEqual([]);
    expect(sharedViewsCsv(visibleSharedViews(maya()))).not.toContain("Manual adjustment");
    expect(ideaEvidence(rohan(), "idea-seasonality-explanation")).toHaveLength(2);
  });

  it("suppresses the theme, because two organisations are no longer enough evidence", () => {
    const theme = themeVisibilityBySlug(maya(), "seasonality-context");
    expect(theme!.suppressed).toBe(true);
    if (!theme!.suppressed) return;
    expect(theme!.reason).toBe("Fewer than the minimum number of organisations");
    expect(theme!.evidence).toEqual([]);
  });

  it("notifies the author and every moderator, and audits the report", () => {
    const forSam = listNotifications(userIdOf("sam@beacon.example")).find((row) => row.kind === "report.suspension");
    expect(forSam?.message).toContain("hidden from shared learning while a report is open");
    expect(listNotifications(userIdOf("meera.mod@azentio.com")).some((row) => row.kind === "moderation.report")).toBe(true);

    const audit = (
      getDb().prepare("SELECT decision, reason FROM audit_log WHERE action = 'shared.report' ORDER BY rowid DESC LIMIT 1").get() as {
        decision: string;
        reason: string;
      }
    );
    expect(audit.decision).toBe("allow");
    expect(audit.reason).toContain("copy suspended=true");
  });

  it("refuses a second report on the hidden copy, and one on a copy that is not there", () => {
    expect(reportSharedView(maya(), BEACON, "Again.")).toMatchObject({ ok: false, status: 404 });
    expect(reportSharedView(maya(), "shared-view-nope", "Not a copy.")).toMatchObject({ ok: false, status: 404 });
  });

  it("refuses the decision from an account without the moderation grant", () => {
    expect(authorize(sam(), "moderation.review", { audience: "employee" }).allow).toBe(false);
    expect(resolveReport(sam(), reportId, "restore", "")).toMatchObject({ ok: false, status: 403 });
    expect(viewState(BEACON)).toBe("suspended");
  });

  it("keeps the copy suspended while another open report still names it", () => {
    // A second reader reporting the same copy is only possible while it is live, so the row is written
    // directly: this is the race the guard exists for, and the restore must refuse it.
    getDb()
      .prepare("INSERT INTO reports (id, shared_view_id, reporter_user_id, reason, status, at) VALUES (?, ?, ?, ?, 'open', ?)")
      .run(
        "report-second",
        BEACON,
        userIdOf("admin@cedar.example"),
        "Independent report of the same figure.",
        new Date().toISOString(),
      );

    const blocked = resolveReport(meera(), reportId, "restore", "Checked again.");
    expect(blocked).toMatchObject({ ok: false, status: 409 });
    expect(blocked.ok ? "" : blocked.reason).toContain("other report(s) still name this copy");
    expect(viewState(BEACON)).toBe("suspended");
    expect(reportRow(reportId)!.status).toBe("open");

    getDb().prepare("DELETE FROM reports WHERE id = 'report-second'").run();
  });

  it("restores the same copy once no report remains, and the reads agree again", () => {
    const restored = resolveReport(meera(), reportId, "restore", "The figure is a coarse bucket, not an account.");
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.restored).toBe(true);

    expect(viewState(BEACON)).toBe("live");
    expect(reportRow(reportId)!.status).toBe("resolved");
    expect(getContribution(BEACON_ITEM)!.state).toBe("Published");
    expect(visibleSharedViews(maya())).toHaveLength(4);
    expect(themeVisibilityBySlug(maya(), "seasonality-context")!.suppressed).toBe(false);
    expect(
      listNotifications(userIdOf("sam@beacon.example")).some((row) => row.kind === "report.decision" && row.message.includes("back")),
    ).toBe(true);
    expect(listNotifications(userIdOf("maya@aurora.example")).some((row) => row.kind === "report.decision")).toBe(true);
    expect(resolveReport(meera(), reportId, "restore", "twice")).toMatchObject({ ok: false, status: 409 });
  });
});

describe("upholding a report takes the item out", () => {
  it("moves the record to Unpublished through the Section 9 machine and closes the report", () => {
    const raised = reportSharedView(maya(), BEACON, "The bucket still allows a single borrower to be picked out.");
    expect(raised.ok).toBe(true);
    if (!raised.ok) return;

    const upheld = resolveReport(meera(), raised.reportId, "keep_out", "Agreed: one organisation describes exactly this file.");
    expect(upheld.ok).toBe(true);
    if (!upheld.ok) return;
    expect(upheld.restored).toBe(false);

    expect(reportRow(raised.reportId)!.status).toBe("closed");
    expect(getContribution(BEACON_ITEM)!.state).toBe("Unpublished");
    expect(visibleSharedViews(maya()).map((row) => row.id)).not.toContain(BEACON);

    // The unpublish path is what moved it, so its own audit row and notification exist too.
    const unpublishAudits = (
      getDb().prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'moderation.unpublish'").get() as { n: number }
    ).n;
    expect(unpublishAudits).toBeGreaterThanOrEqual(1);
    expect(
      listNotifications(userIdOf("sam@beacon.example")).some((row) => row.kind === "moderation.decision" && row.message.includes("unpublished")),
    ).toBe(true);
  });
});

describe("a report against a record the state machine has already left", () => {
  it("refuses a restore when the item is no longer Published", () => {
    const raised = reportSharedView(actorFor("admin@beacon.example"), DELTA, "The practice described is not ours to share.");
    expect(raised.ok).toBe(true);
    if (!raised.ok) return;

    // An open report is exactly the guard Section 9 needs for Published to Unpublished.
    expect(hasOpenReport(DELTA_ITEM)).toBe(true);
    const unpublished = unpublishContribution(meera(), DELTA_ITEM, "A report is open and the organisation asked for it.", null);
    expect(unpublished.ok).toBe(true);
    expect(getContribution(DELTA_ITEM)!.state).toBe("Unpublished");

    const restore = resolveReport(meera(), raised.reportId, "restore", "");
    expect(restore).toMatchObject({ ok: false, status: 409 });
    expect(restore.ok ? "" : restore.reason).toContain("the item is Unpublished");

    const upheld = resolveReport(meera(), raised.reportId, "keep_out", "The organisation was right.");
    expect(upheld.ok).toBe(true);
    expect(reportRow(raised.reportId)!.status).toBe("closed");
    expect(openReports().map((row) => row.id)).not.toContain(raised.reportId);
  });

  it("leaves a record nobody has published alone", () => {
    expect(reportSharedView(maya(), "shared-view-contribution-c-beacon-draft", "There is no such copy.")).toMatchObject({
      ok: false,
      status: 404,
    });
    expect(openReports()).toHaveLength(0);
  });
});
