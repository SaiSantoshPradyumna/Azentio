"use client";

import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";

export function LocaleSwitcher({ locale, label }: { locale: Locale; label: string }) {
  const router = useRouter();
  const next = locale === "en" ? "ar" : "en";

  async function switchLocale() {
    await fetch("/api/public/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: next }),
    });
    router.refresh();
  }

  return (
    <button type="button" className="btn-secondary text-sm" onClick={switchLocale} lang={next}>
      {label}
    </button>
  );
}
