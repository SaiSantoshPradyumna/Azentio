import Link from "next/link";
import { hasAnyAdminGrant, tenantNameById } from "@/lib/portal";
import type { Actor } from "@/lib/authorize";
import { membershipsForUser } from "@/lib/session";
import { unreadCount } from "@/lib/notify";
import { NotificationsBell } from "./notifications-bell";
import { SignOutButton } from "./sign-out-button";
import { WorkspaceSwitcher } from "./workspace-switcher";

// Section 18 header, on every authenticated page: active organisation chip, workspace switcher for
// multi-membership accounts, notifications bell and sign out. Links appear only for areas the actor
// can actually open.
export function SessionBar({ actor }: { actor: NonNullable<Actor> }) {
  const memberships = membershipsForUser(actor.userId);
  const links = [
    actor.activeTenantId ? { href: `/c/${actor.activeTenantId}`, label: "Dashboard" } : null,
    actor.activeTenantId ? { href: `/c/${actor.activeTenantId}/observations`, label: "Observations" } : null,
    actor.activeTenantId ? { href: `/c/${actor.activeTenantId}/learning`, label: "Shared learning" } : null,
    actor.activeTenantId ? { href: `/c/${actor.activeTenantId}/themes`, label: "Themes" } : null,
    actor.activeTenantId ? { href: `/c/${actor.activeTenantId}/ideas`, label: "Ideas" } : null,
    actor.activeTenantId && actor.clientRole === "client_admin"
      ? { href: `/c/${actor.activeTenantId}/admin`, label: "Org admin" }
      : null,
    actor.isEmployee ? { href: "/employee/playground", label: "Playground" } : null,
    actor.platformPerms.has("product.owner") ? { href: "/employee/ideas", label: "Product owner" } : null,
    actor.isEmployee ? { href: "/employee", label: "Employee" } : null,
    actor.platformPerms.has("learning.moderate") ? { href: "/moderate", label: "Moderation" } : null,
    hasAnyAdminGrant(actor) ? { href: "/admin", label: "Admin" } : null,
  ].filter(Boolean) as { href: string; label: string }[];

  return (
    <div className="border-b border-line bg-surface-sunken">
      <div className="container-page flex flex-wrap items-center justify-between gap-md py-sm">
        <div className="flex flex-wrap items-center gap-sm">
          <span className="badge" data-testid="active-org">
            <span aria-hidden="true">🏢</span>
            {actor.activeTenantId
              ? `Active organisation: ${tenantNameById(actor.activeTenantId)}`
              : "No active organisation"}
          </span>
          <span className="text-sm text-content-muted">
            {actor.email}
            {actor.isEmployee ? " · Azentio employee" : ""}
            {actor.clientRole ? ` · ${actor.clientRole}` : ""}
          </span>
        </div>
        <nav aria-label="Portal" className="flex flex-wrap items-center gap-md">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm font-medium hover:text-accent">
              {link.label}
            </Link>
          ))}
          {memberships.length > 1 ? (
            <WorkspaceSwitcher memberships={memberships} activeTenantId={actor.activeTenantId} />
          ) : null}
          <NotificationsBell initialUnread={unreadCount(actor.userId)} />
          <SignOutButton />
        </nav>
      </div>
    </div>
  );
}
