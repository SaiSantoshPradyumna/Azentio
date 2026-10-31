import Link from "next/link";
import { Logo } from "./logo";
import { LocaleSwitcher } from "./locale-switcher";
import { HijriDate } from "./hijri-date";
import { currentLocale, tr } from "@/lib/locale-server";

// Visitor navigation (Section 18): no Admin, no Playground, no dead links.
export function SiteHeader() {
  const locale = currentLocale();
  const NAV = [
    { href: "/products", label: tr("nav.products", locale) },
    { href: "/solutions", label: tr("nav.solutions", locale) },
    { href: "/technology", label: tr("nav.technology", locale) },
    { href: "/media", label: tr("nav.media", locale) },
    { href: "/insights", label: tr("nav.insights", locale) },
    { href: "/about", label: tr("nav.about", locale) },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
      <div className="container-page flex flex-wrap items-center justify-between gap-md py-md">
        <div className="flex flex-col gap-xs">
          <Logo />
          <HijriDate locale={locale} label={tr("hijri.label", locale)} />
        </div>
        <nav aria-label="Primary" className="order-3 w-full md:order-2 md:w-auto">
          <ul className="flex flex-wrap items-center gap-x-lg gap-y-sm text-sm font-medium">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-content-muted hover:text-accent">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="order-2 flex flex-wrap items-center gap-sm md:order-3">
          <LocaleSwitcher locale={locale} label={tr("locale.switch", locale)} />
          <Link href="/connect" className="btn-primary text-sm">
            {tr("nav.connect", locale)}
          </Link>
          <Link href="/login" className="btn-secondary text-sm">
            {tr("nav.signin", locale)}
          </Link>
        </div>
      </div>
      <div className="border-t border-line bg-surface-sunken">
        <p className="container-page py-xs text-xs text-content-muted">{tr("islamic.standards", locale)}</p>
      </div>
    </header>
  );
}
