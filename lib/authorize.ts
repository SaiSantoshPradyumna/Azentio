// Policy engine (BUILD_SPEC.md Section 7.3). Evaluate in order, return the first deny.

export type ClientRole = "client_admin" | "contributor" | "viewer";

export type Actor = {
  userId: string;
  email: string;
  isEmployee: boolean;
  platformPerms: Set<string>;
  activeTenantId: string | null;
  clientRole: ClientRole | null;
  entitledProducts: Set<string>;
} | null;

export type Resource = { audience: string; tenantId?: string };

export const PUBLIC_AUDIENCE = "public";
export const SESSION_AUDIENCE = "session";

const TENANT_ONLY = /^tenant:([A-Za-z0-9._-]+)$/;
const TENANT_PRODUCT = /^tenant:([A-Za-z0-9._-]+):product:([A-Za-z0-9._-]+)$/;

// Client permissions derived from client_role (Section 7.1).
export const CLIENT_ROLE_PERMISSIONS: Record<ClientRole, string[]> = {
  client_admin: ["client.invite", "client.role.grant", "contribution.create", "contribution.read.org"],
  contributor: ["contribution.create", "contribution.read.org"],
  viewer: ["contribution.read.org"],
};

// Action to permission (Section 7.3). Actions absent here need no permission beyond the audience.
export const ACTION_PERMISSION: Record<string, string> = {
  "content.update": "content.publish",
  "video.configure": "video.publish",
  "moderation.review": "learning.moderate",
  "moderation.publish": "learning.moderate",
  "moderation.unpublish": "learning.moderate",
  "idea.write": "product.owner",
  "idea.public_update": "product.owner",
  "org.manage": "org.manage",
  "role.grant.platform": "platform.role.grant",
  "audit.read": "audit.read",
  "invite.create": "client.invite",
  "role.grant.client": "client.role.grant",
  "contribution.create": "contribution.create",
};

function parseAudience(audience: string):
  | { kind: "public" }
  | { kind: "employee" }
  | { kind: "community" }
  | { kind: "tenant"; tenantId: string }
  | { kind: "tenant_product"; tenantId: string; slug: string }
  | { kind: "invalid" } {
  if (typeof audience !== "string" || audience.length === 0) return { kind: "invalid" };
  if (audience === PUBLIC_AUDIENCE) return { kind: "public" };
  if (audience === "employee") return { kind: "employee" };
  if (audience === "community") return { kind: "community" };
  const tp = TENANT_PRODUCT.exec(audience);
  if (tp) return { kind: "tenant_product", tenantId: tp[1], slug: tp[2] };
  const t = TENANT_ONLY.exec(audience);
  if (t) return { kind: "tenant", tenantId: t[1] };
  return { kind: "invalid" };
}

function has(actor: Exclude<Actor, null>, permission: string): boolean {
  if (actor.platformPerms.has(permission)) return true;
  if (!actor.clientRole) return false;
  return CLIENT_ROLE_PERMISSIONS[actor.clientRole].includes(permission);
}

export function authorize(actor: Actor, action: string, resource: Resource): { allow: boolean; reason: string } {
  const parsed = parseAudience(resource.audience);

  // 1. A missing, empty or unknown audience is denied. It is never treated as public.
  if (parsed.kind === "invalid") return { allow: false, reason: "missing or invalid audience" };

  // 2. Public resources are read-only for everyone, including anonymous callers.
  if (parsed.kind === "public") {
    if (action.startsWith("read")) return { allow: true, reason: "public read" };
    return { allow: false, reason: "public resources are read-only" };
  }

  // 3. Everything below needs a live session.
  if (!actor) return { allow: false, reason: "unauthenticated" };

  if (parsed.kind === "employee") {
    if (!actor.isEmployee) return { allow: false, reason: "employee access required" };
  }

  if (parsed.kind === "tenant") {
    if (resource.tenantId && resource.tenantId !== parsed.tenantId) {
      return { allow: false, reason: "resource tenant does not match audience" };
    }
    if (actor.activeTenantId !== parsed.tenantId) {
      return { allow: false, reason: "not the active organisation" };
    }
  }

  if (parsed.kind === "tenant_product") {
    if (resource.tenantId && resource.tenantId !== parsed.tenantId) {
      return { allow: false, reason: "resource tenant does not match audience" };
    }
    if (actor.activeTenantId !== parsed.tenantId) {
      return { allow: false, reason: "not the active organisation" };
    }
    if (!actor.entitledProducts.has(parsed.slug)) {
      return { allow: false, reason: "product not entitled to this organisation" };
    }
  }

  if (parsed.kind === "community") {
    const moderatorOrOwner =
      actor.isEmployee && (actor.platformPerms.has("learning.moderate") || actor.platformPerms.has("product.owner"));
    if (!actor.activeTenantId && !moderatorOrOwner) {
      return { allow: false, reason: "community access needs an organisation or a learning role" };
    }
  }

  // 8. Permission check.
  const permission = ACTION_PERMISSION[action];
  if (permission && !has(actor, permission)) {
    return { allow: false, reason: `missing permission ${permission}` };
  }

  return { allow: true, reason: "allowed" };
}

/** Platform grants plus the permissions implied by the active tenant's client role. */
export function effectivePermissions(actor: Exclude<Actor, null>): string[] {
  const fromRole = actor.clientRole ? CLIENT_ROLE_PERMISSIONS[actor.clientRole] : [];
  return [...new Set([...actor.platformPerms, ...fromRole])].sort();
}
