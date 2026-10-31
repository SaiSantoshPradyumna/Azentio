import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { audit, verifyChain } from "@/lib/audit";
import { authorize } from "@/lib/authorize";
import { getDb } from "@/lib/db";
import {
  allowOtpRequest,
  allowVerifyAttempt,
  buildActor,
  createOtp,
  createSession,
  isEmployeeEmail,
  loadSession,
  membershipsForUser,
  revokeSession,
  setActiveTenant,
  verifyOtp,
} from "@/lib/session";

let dataDir: string;

beforeAll(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "azentio-auth-"));
  execFileSync(process.execPath, ["--import", "tsx", "lib/seed.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, DATA_DIR: dataDir, COHORT_MIN: "3", DEMO_MODE: "true" },
    stdio: "pipe",
  });
  // getDb() resolves DATA_DIR lazily, so every lib call below uses the isolated copy.
  process.env.DATA_DIR = dataDir;
});

afterAll(() => {
  getDb().close();
  if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
});

function signIn(email: string): { userId: string; sessionId: string; activeTenantId: string | null; code: string } {
  const { code } = createOtp(email);
  expect(code).not.toBeNull();
  const result = verifyOtp(email, code!);
  expect(result.ok).toBe(true);
  const session = createSession(result.userId!);
  return { userId: result.userId!, code: code!, ...session };
}

describe("one-time codes", () => {
  it("issues a code for a seeded account and verifies it once", () => {
    const email = "maya@aurora.example";
    const { code, userId, activeTenantId } = signIn(email);

    expect(userId).toBe("user-maya-aurora.example");
    expect(activeTenantId).toBe("tenant-aurora");
    expect(code).toMatch(/^\d{6}$/);

    // The same code cannot be replayed.
    expect(verifyOtp(email, code).ok).toBe(false);
  });

  it("creates no code for an unknown address, so accounts are not enumerable", () => {
    expect(createOtp("nobody@nowhere.example").code).toBeNull();
    expect(verifyOtp("nobody@nowhere.example", "123456").ok).toBe(false);
  });

  it("rejects an expired or wrong code", () => {
    const email = "sam@beacon.example";
    const { code } = createOtp(email);
    expect(verifyOtp(email, code === "000000" ? "999999" : "000000").ok).toBe(false);

    getDb().prepare("UPDATE otp_codes SET expires_at = ? WHERE email = ?").run(new Date(Date.now() - 1000).toISOString(), email);
    expect(verifyOtp(email, code!).ok).toBe(false);
  });

  it("limits five code requests and ten verifies per address", () => {
    const otpEmail = "rate.otp@azentio.com";
    let allowed = 0;
    for (let i = 0; i < 8; i += 1) if (allowOtpRequest(otpEmail)) allowed += 1;
    expect(allowed).toBe(5);

    const verifyEmail = "rate.verify@azentio.com";
    let attempts = 0;
    for (let i = 0; i < 14; i += 1) if (allowVerifyAttempt(verifyEmail)) attempts += 1;
    expect(attempts).toBe(10);
  });
});

describe("employee rule", () => {
  it("needs the domain and an active provisioning row", () => {
    expect(isEmployeeEmail("meera.mod@azentio.com")).toBe(true);
    expect(isEmployeeEmail("MAYA@AURORA.EXAMPLE".toLowerCase())).toBe(false);
    // A future hire at the right domain with no provisioning row gets nothing.
    expect(isEmployeeEmail("newhire@azentio.com")).toBe(false);
  });

  it("builds an employee actor with platform grants and no client role", () => {
    const { sessionId } = signIn("meera.mod@azentio.com");
    const actor = buildActor(loadSession(sessionId)!);
    expect(actor!.isEmployee).toBe(true);
    expect(actor!.platformPerms.has("learning.moderate")).toBe(true);
    expect(actor!.clientRole).toBeNull();
    expect(actor!.activeTenantId).toBeNull();
    expect(authorize(actor, "moderation.review", { audience: "employee" }).allow).toBe(true);
  });

  it("gives an unprovisioned employee address no employee access", () => {
    const db = getDb();
    db.prepare("INSERT INTO users (id, email, name, created_at) VALUES (?, ?, ?, ?)").run(
      "user-offboarded",
      "offboarded@azentio.com",
      "Offboarded",
      new Date().toISOString(),
    );
    db.prepare("UPDATE employee_provisioning SET active = 0 WHERE email = ?").run("dev.emp@azentio.com");

    expect(isEmployeeEmail("offboarded@azentio.com")).toBe(false);
    const { sessionId } = signIn("dev.emp@azentio.com");
    const actor = buildActor(loadSession(sessionId)!);
    expect(actor!.isEmployee).toBe(false);
    expect(authorize(actor, "read.employee.dashboard", { audience: "employee" }).reason).toBe(
      "employee access required",
    );

    db.prepare("UPDATE employee_provisioning SET active = 1 WHERE email = ?").run("dev.emp@azentio.com");
    db.prepare("DELETE FROM users WHERE id = ?").run("user-offboarded");
  });
});

describe("sessions and workspaces", () => {
  it("sets the single active membership automatically and requires a choice for several", () => {
    const solo = signIn("admin@cedar.example");
    expect(solo.activeTenantId).toBe("tenant-cedar");

    const multi = signIn("shared@consult.example");
    expect(multi.activeTenantId).toBeNull();
    expect(membershipsForUser(multi.userId)).toHaveLength(2);

    expect(setActiveTenant(multi.sessionId, "tenant-beacon")).toBe(true);
    expect(buildActor(loadSession(multi.sessionId)!)!.activeTenantId).toBe("tenant-beacon");

    // A tenant the user does not belong to cannot be activated.
    expect(setActiveTenant(multi.sessionId, "tenant-delta")).toBe(false);
    expect(buildActor(loadSession(multi.sessionId)!)!.activeTenantId).toBe("tenant-beacon");
  });

  it("revokes, expires and idles sessions out", () => {
    const signedIn = signIn("admin@aurora.example");
    expect(loadSession(signedIn.sessionId)).not.toBeNull();

    const db = getDb();
    db.prepare("UPDATE sessions SET last_seen = ? WHERE id = ?").run(
      new Date(Date.now() - 31 * 60 * 1000).toISOString(),
      signedIn.sessionId,
    );
    expect(loadSession(signedIn.sessionId)).toBeNull();

    db.prepare("UPDATE sessions SET last_seen = ?, expires_at = ? WHERE id = ?").run(
      new Date().toISOString(),
      new Date(Date.now() - 1000).toISOString(),
      signedIn.sessionId,
    );
    expect(loadSession(signedIn.sessionId)).toBeNull();

    const another = signIn("admin@aurora.example");
    revokeSession(another.sessionId);
    expect(loadSession(another.sessionId)).toBeNull();
  });

  it("refuses a tenant session to a member whose membership was revoked", () => {
    const { userId, sessionId } = signIn("ex.member@aurora.example");
    const actor = buildActor(loadSession(sessionId)!);

    expect(membershipsForUser(userId)).toHaveLength(0);
    expect(actor!.activeTenantId).toBeNull();

    const decision = authorize(actor, "read.contribution", { audience: "tenant:tenant-aurora" });
    expect(decision.allow).toBe(false);
    expect(decision.reason).toBe("not the active organisation");

    // Even naming the tenant in the request body changes nothing: the session is the authority.
    expect(setActiveTenant(sessionId, "tenant-aurora")).toBe(false);
    expect(loadSession(sessionId)!.active_tenant_id).toBeNull();
  });

  it("carries the entitlements of the active organisation only", () => {
    const { sessionId } = signIn("sam@beacon.example");
    const actor = buildActor(loadSession(sessionId)!)!;
    expect([...actor.entitledProducts].sort()).toEqual(["similar-portfolio-intelligence", "sme-credit-decisioning"]);
    expect(authorize(actor, "playground.run", { audience: "tenant:tenant-beacon:product:riva" }).reason).toBe(
      "product not entitled to this organisation",
    );
  });
});

describe("audit trail", () => {
  it("records denies as well as allows and keeps the hash chain valid", () => {
    const actor = buildActor(loadSession(signIn("priya.admin@azentio.com").sessionId)!)!;
    audit(actor, "audit.read", "employee", "allow", "allowed");
    audit(null, "read.employee.dashboard", "page:/employee", "deny", "unauthenticated");

    const before = verifyChain();
    expect(before.ok).toBe(true);

    const db = getDb();
    const row = db.prepare("SELECT id, reason FROM audit_log ORDER BY id DESC LIMIT 1").get() as {
      id: number;
      reason: string;
    };
    db.prepare("UPDATE audit_log SET reason = ? WHERE id = ?").run("edited after the fact", row.id);
    const after = verifyChain();
    expect(after.ok).toBe(false);
    expect(after.firstBadId).toBe(row.id);

    db.prepare("UPDATE audit_log SET reason = ? WHERE id = ?").run(row.reason, row.id);
    expect(verifyChain().ok).toBe(true);
  });
});
