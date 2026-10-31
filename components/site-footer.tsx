import Link from "next/link";
import { FOOTER_NOTE } from "@/lib/site-content";
import { currentLocale, tr } from "@/lib/locale-server";
import { HijriDate } from "./hijri-date";

export function SiteFooter() {
  const locale = currentLocale();
  return (
    <footer className="mt-2xl border-t border-line bg-surface-sunken">
      <div className="container-page flex flex-col gap-md py-xl md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-xs">
          <p className="font-display text-sm font-semibold">Azentio</p>
          <p className="text-sm text-content-muted">{FOOTER_NOTE}</p>
          <p className="text-xs text-content-muted">{tr("islamic.standards", locale)}</p>
          <HijriDate locale={locale} label={tr("hijri.label", locale)} />
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-lg text-sm">
            <li>
              <Link href="/about" className="text-content-muted hover:text-accent">
                {tr("nav.about", locale)}
              </Link>
            </li>
            <li>
              <Link href="/trust" className="text-content-muted hover:text-accent">
                {tr("nav.trust", locale)}
              </Link>
            </li>
            <li>
              <Link href="/connect" className="text-content-muted hover:text-accent">
                {tr("nav.connect", locale)}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
