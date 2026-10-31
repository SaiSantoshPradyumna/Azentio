import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { authorize, CLIENT_ROLE_PERMISSIONS, type Actor } from "@/lib/authorize";

type Overrides = Partial<Omit<NonNullable<Actor>, "platformPerms" | "entitledProducts">> & {
  platformPerms?: string[];
  entitledProducts?: string[];
};

function makeActor(overrides: Overrides = {}): NonNullable<Actor> {
  return {
    userId: overrides.userId ?? "user-test",
    email: overrides.email ?? "someone@example.test",
    isEmployee: overrides.isEmployee ?? false,
    platformPerms: new Set(overrides.platformPerms ?? []),
    activeTenantId: overrides.activeTenantId ?? null,
    clientRole: overrides.clientRole ?? null,
    entitledProducts: new Set(overrides.entitledProducts ?? []),
  };
}

const auroraMember = makeActor({
  email: "maya@aurora.example",
  activeTenantId: "tenant-aurora",
  clientRole: "contributor",
  entitledProducts: ["sme-credit-decisioning", "credit-strategy-simulator"],
});

const employee = makeActor({ email: "meera.mod@azentio.com", isEmployee: true, platformPerms: ["learning.moderate"] });

describe("policy: audience", () => {
  it("denies a missing, empty or unknown audience and never treats it as public", () => {
    for (const audience of ["", "staff", "Public", "tenant:", "tenant-aurora", undefined as unknown as string]) {
      const decision = authorize(auroraMember, "read.anything", { audience });
      expect(decision.allow).toBe(false);
      expect(decision.reason).toBe("missing or invalid audience");
    }
  });

  it("lets anyone read public resources but never write them", () => {
    expect(authorize(null, "read.public.page", { audience: "public" }).allow).toBe(true);
    expect(authorize(auroraMember, "read.public.page", { audience: "public" }).allow).toBe(true);
    const write = authorize(auroraMember, "content.update", { audience: "public" });
    expect(write.allow).toBe(false);
    expect(write.reason).toBe("public resources are read-only");
  });

  it("denies every non-public audience without a session", () => {
    for (const audience of ["employee", "community", "tenant:tenant-aurora", "tenant:tenant-aurora:product:riva"]) {
      const decision = authorize(null, "read.anything", { audience });
      expect(decision.allow).toBe(false);
      expect(decision.reason).toBe("unauthenticated");
    }
  });

  it("separates employees from client users", () => {
    expect(authorize(employee, "read.employee.dashboard", { audience: "employee" }).allow).toBe(true);

    const clientOnEmployee = authorize(auroraMember, "read.employee.dashboard", { audience: "employee" });
    expect(clientOnEmployee.allow).toBe(false);
    expect(clientOnEmployee.reason).toBe("employee access required");

    // The address alone is not enough: isEmployee is only set when provisioning is active.
    const unprovisioned = makeActor({ email: "ghost@azentio.com", isEmployee: false });
    expect(authorize(unprovisioned, "read.employee.dashboard", { audience: "employee" }).reason).toBe(
      "employee access required",
    );
  });

  it("denies a client actor whose active organisation differs from the resource tenant", () => {
    const beaconActor = makeActor({
      activeTenantId: "tenant-beacon",
      clientRole: "contributor",
      entitledProducts: ["sme-credit-decisioning", "similar-portfolio-intelligence"],
    });
    const decision = authorize(beaconActor, "read.contribution", { audience: "tenant:tenant-aurora" });
    expect(decision.allow).toBe(false);
    expect(decision.reason).toBe("not the active organisation");

    // A record that belongs to another tenant is rejected even if the audience string matches the session.
    const mismatch = authorize(auroraMember, "read.contribution", {
      audience: "tenant:tenant-aurora",
      tenantId: "tenant-beacon",
    });
    expect(mismatch.allow).toBe(false);
    expect(mismatch.reason).toBe("resource tenant does not match audience");

    // No active organisation at all.
    const noTenant = makeActor({ clientRole: null });
    expect(authorize(noTenant, "read.contribution", { audience: "tenant:tenant-aurora" }).reason).toBe(
      "not the active organisation",
    );
  });

  it("denies an entitlement the active organisation does not hold", () => {
    const allowed = authorize(auroraMember, "playground.run", {
      audience: "tenant:tenant-aurora:product:sme-credit-decisioning",
    });
    expect(allowed.allow).toBe(true);

    const denied = authorize(auroraMember, "playground.run", { audience: "tenant:tenant-aurora:product:riva" });
    expect(denied.allow).toBe(false);
    expect(denied.reason).toBe("product not entitled to this organisation");
  });

  it("allows community reads for members and for moderators, and nothing else", () => {
    expect(authorize(auroraMember, "read.feed", { audience: "community" }).allow).toBe(true);
    expect(authorize(employee, "read.feed", { audience: "community" }).allow).toBe(true);

    const visitorWithSession = makeActor({ userId: "user-visitor" });
    const decision = authorize(visitorWithSession, "read.feed", { audience: "community" });
    expect(decision.allow).toBe(false);
    expect(decision.reason).toBe("community access needs an organisation or a learning role");
  });
});

describe("policy: action permissions", () => {
  it("requires the platform grant behind a moderation action", () => {
    const plainEmployee = makeActor({ email: "dev.emp@azentio.com", isEmployee: true });
    expect(authorize(plainEmployee, "moderation.review", { audience: "employee" }).reason).toBe(
      "missing permission learning.moderate",
    );
    expect(authorize(employee, "moderation.publish", { audience: "employee" }).allow).toBe(true);
  });

  it("derives client permissions from client_role only", () => {
    for (const role of ["client_admin", "contributor", "viewer"] as const) {
      const actor = makeActor({ activeTenantId: "tenant-aurora", clientRole: role, entitledProducts: ["riva"] });
      for (const permission of CLIENT_ROLE_PERMISSIONS[role]) {
        expect(authorize(actor, permission, { audience: `tenant:tenant-aurora` }).allow).toBe(true);
      }
    }

    const viewer = makeActor({ activeTenantId: "tenant-aurora", clientRole: "viewer" });
    expect(authorize(viewer, "contribution.create", { audience: "tenant:tenant-aurora" }).reason).toBe(
      "missing permission contribution.create",
    );
    expect(authorize(viewer, "invite.create", { audience: "tenant:tenant-aurora" }).reason).toBe(
      "missing permission client.invite",
    );
  });

  it("never lets a client admin reach a platform permission", () => {
    const clientAdmin = makeActor({
      email: "admin@aurora.example",
      activeTenantId: "tenant-aurora",
      clientRole: "client_admin",
    });
    expect(authorize(clientAdmin, "role.grant.platform", { audience: "tenant:tenant-aurora" }).reason).toBe(
      "missing permission platform.role.grant",
    );
    expect(authorize(clientAdmin, "audit.read", { audience: "employee" }).reason).toBe("employee access required");

    const platformAdmin = makeActor({
      email: "priya.admin@azentio.com",
      isEmployee: true,
      platformPerms: ["platform.role.grant", "org.manage", "audit.read"],
    });
    expect(authorize(platformAdmin, "role.grant.platform", { audience: "employee" }).allow).toBe(true);
    expect(authorize(platformAdmin, "audit.read", { audience: "employee" }).allow).toBe(true);
    expect(authorize(platformAdmin, "content.update", { audience: "employee" }).reason).toBe(
      "missing permission content.publish",
    );
  });

  it("does not widen a public write into a permission check", () => {
    // Order matters: the audience rule rejects before ACTION_PERMISSION is consulted.
    const admin = makeActor({ isEmployee: true, platformPerms: ["content.publish"] });
    expect(authorize(admin, "content.update", { audience: "public" }).reason).toBe("public resources are read-only");
  });
});

describe("policy: handlers must be wrapped", () => {
  const PUBLIC_ROUTES = ["app/api/auth/otp/route.ts", "app/api/auth/verify/route.ts", "app/api/enquiries/route.ts"];

  function toPosix(p: string): string {
    return p.split(path.sep).join("/");
  }

  function isPublic(rel: string): boolean {
    return PUBLIC_ROUTES.includes(rel) || rel.startsWith("app/api/public/");
  }

  function routeSources(root = path.join(process.cwd(), "app", "api")): { rel: string; source: string }[] {
    if (!fs.existsSync(root)) return [];
    const entries: { rel: string; source: string }[] = [];
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      const full = path.join(root, entry.name);
      if (entry.isDirectory()) {
        entries.push(...routeSources(full));
      } else if (entry.name === "route.ts") {
        entries.push({ rel: toPosix(path.relative(process.cwd(), full)), source: fs.readFileSync(full, "utf8") });
      }
    }
    return entries;
  }

  function handlersWithoutWithAuth(entries: { rel: string; source: string }[]): string[] {
    return entries.filter((entry) => !isPublic(entry.rel) && !/from\s+["']@\/lib\/withAuth["']/.test(entry.source)).map(
      (entry) => entry.rel,
    );
  }

  it("finds every route file under app/api", () => {
    const files = routeSources().map((entry) => entry.rel).sort();
    expect(files).toContain("app/api/me/route.ts");
    expect(files).toContain("app/api/auth/otp/route.ts");
    expect(files.length).toBeGreaterThanOrEqual(6);
  });

  it("wraps every non-public handler with withAuth", () => {
    expect(handlersWithoutWithAuth(routeSources())).toEqual([]);
  });

  it("fails for a handler that forgets withAuth", () => {
    const leaks = handlersWithoutWithAuth([
      { rel: "app/api/contributions/route.ts", source: 'export async function GET() { return new Response("ok"); }' },
      { rel: "app/api/me/route.ts", source: 'import { withAuth } from "@/lib/withAuth";' },
      { rel: "app/api/public/products/route.ts", source: "export async function GET() {}" },
    ]);
    expect(leaks).toEqual(["app/api/contributions/route.ts"]);
  });
});
