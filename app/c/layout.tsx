import Link from "next/link";
import { redirect } from "next/navigation";
import { SessionBar } from "@/components/session-bar";
import { SiteFooter } from "@/components/site-footer";
import { HijriDate } from "@/components/hijri-date";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { currentLocale, tr } from "@/lib/locale-server";
import { protectPage } from "@/lib/portal";

export const metadata = {
  title: "Organisation workspace",
  description: "Client workspace for the active organisation.",
};

// One chrome layer only. Nested /c/[tenantId]/layout must not repeat SiteHeader/SessionBar.
export default function ClientWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const access = protectPage("read.client.workspace", "session", "/c");
  if (!access.ok) redirect("/login");

  const locale = currentLocale();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-surface">
        <div className="container-page flex flex-wrap items-center justify-between gap-md py-sm">
          <div className="flex flex-col gap-xs">
            <Link href="/" className="font-display text-sm font-semibold text-content">
              azentio.ai
            </Link>
            <HijriDate locale={locale} label={tr("hijri.label", locale)} />
          </div>
          <div className="flex flex-wrap items-center gap-sm">
            <LocaleSwitcher locale={locale} label={tr("locale.switch", locale)} />
            <p className="max-w-md text-xs text-content-muted">{tr("islamic.short", locale)}</p>
          </div>
        </div>
      </header>
      <SessionBar actor={access.actor} />
      <main id="main" className="flex-1">
        <div className="container-page py-2xl">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
