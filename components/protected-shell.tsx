import { notFound, redirect } from "next/navigation";
import { AccessDenied } from "./access-denied";
import { SessionBar } from "./session-bar";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import type { PageAccess } from "@/lib/portal";

/**
 * Renders a protected area. Unauthenticated visitors are sent to /login, denied users see the policy
 * reason, and `hideWhenDenied` turns the area into a plain 404 so existence is not revealed.
 */
export function ProtectedShell({
  access,
  hideWhenDenied = false,
  title,
  blurb,
  children,
}: {
  access: PageAccess;
  hideWhenDenied?: boolean;
  title: string;
  blurb: string;
  children: React.ReactNode;
}) {
  if (!access.ok) {
    if (access.status === "unauthenticated") redirect("/login");
    if (hideWhenDenied) notFound();
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main id="main" className="container-page flex-1 py-2xl">
          <h1 className="font-display text-3xl font-semibold">{title}</h1>
          <div className="mt-lg">
            <AccessDenied reason={access.reason} />
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <SessionBar actor={access.actor} />
      <main id="main" className="flex-1">
        <div className="container-page py-2xl">
          <h1 className="font-display text-3xl font-semibold">{title}</h1>
          <p className="mt-sm max-w-2xl text-content-muted">{blurb}</p>
          <div className="mt-xl">{children}</div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
