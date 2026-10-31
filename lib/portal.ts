import { cookies } from "next/headers";
import { authorize, SESSION_AUDIENCE, type Actor } from "./authorize";
import { audit } from "./audit";
import { getDb } from "./db";
import { actorFromSessionId, SESSION_COOKIE } from "./session";

export type PageAccess =
  | { ok: true; actor: NonNullable<Actor> }
  | { ok: false; status: "unauthenticated" | "denied"; reason: string };

export function currentActor(): Actor {
  return actorFromSessionId(cookies().get(SESSION_COOKIE)?.value).actor;
}

/**
 * Page-level guard used by protected layouts. It runs the same authorize() as the API and
 * audits the decision, so a blocked URL appears in the audit log exactly like a blocked call.
 */
export function protectPage(action: string, audience: string, path: string): PageAccess {
  const actor = currentActor();

  if (audience === SESSION_AUDIENCE) {
    if (!actor) {
      audit(null, action, `page:${path}`, "deny", "unauthenticated");
      return { ok: false, status: "unauthenticated", reason: "unauthenticated" };
    }
    // "session" is a self-scope, not one of the Section 7.2 resource audiences, so authorize()
    // cannot judge it. A live session is the whole requirement.
    audit(actor, action, `page:${path}`, "allow", "active session");
    return { ok: true, actor };
  }

  if (!actor) {
    audit(null, action, `page:${path}`, "deny", "unauthenticated");
    return { ok: false, status: "unauthenticated", reason: "unauthenticated" };
  }

  const decision = authorize(actor, action, { audience });
  audit(actor, action, `page:${path}`, decision.allow ? "allow" : "deny", decision.reason);

  if (!decision.allow) {
    return { ok: false, status: "denied", reason: decision.reason };
  }
  return { ok: true, actor };
}

export function hasAnyAdminGrant(actor: Actor): boolean {
  if (!actor) return false;
  return ["org.manage", "platform.role.grant", "audit.read"].some((p) => actor.platformPerms.has(p));
}

export function tenantNameById(tenantId: string): string {
  const row = getDb().prepare("SELECT name FROM tenants WHERE id = ?").get(tenantId) as { name: string } | undefined;
  return row ? row.name : "Unknown organisation";
}
