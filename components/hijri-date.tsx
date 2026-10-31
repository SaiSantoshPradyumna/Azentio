import { formatDualDate, type Locale } from "@/lib/i18n";

export function HijriDate({ locale, label }: { locale: Locale; label: string }) {
  const dual = formatDualDate(new Date(), locale);
  return (
    <p className="text-xs text-content-muted" data-testid="hijri-date">
      <span className="font-semibold">{label}:</span> {dual.combined}
    </p>
  );
}
