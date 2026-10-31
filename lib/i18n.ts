// Bilingual (EN / AR), RTL-ready, Hijri-aware helpers for Islamic FI demos.
// Locale is a presentation preference only — never authority (roles stay server-side).

export type Locale = "en" | "ar";

export const LOCALES: Locale[] = ["en", "ar"];
export const LOCALE_COOKIE = "az_locale";

export function parseLocale(value: string | undefined | null): Locale {
  return value === "ar" ? "ar" : "en";
}

export function dirFor(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

/** Gregorian + Hijri dual date line for headers and footers. */
export function formatDualDate(date: Date = new Date(), locale: Locale = "en"): {
  gregorian: string;
  hijri: string;
  combined: string;
} {
  const gregorian = new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en-GB", {
    dateStyle: "medium",
  }).format(date);

  const hijri = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-ca-islamic" : "en-u-ca-islamic", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);

  // Intl islamic calendars already include era text in some locales — avoid "AH AH".
  const hijriClean = hijri.replace(/\s*AH\s*$/i, "").trim();
  const combined =
    locale === "ar" ? `${hijriClean} · ${gregorian}` : `${gregorian} · ${hijriClean} AH`;
  return { gregorian, hijri: hijriClean, combined };
}

type Dict = Record<string, string>;

const EN: Dict = {
  "brand.tagline": "Build Intelligence. Create Impact.",
  "nav.products": "Products",
  "nav.solutions": "Solutions",
  "nav.technology": "Technology",
  "nav.media": "Media",
  "nav.insights": "Insights",
  "nav.about": "About",
  "nav.connect": "Request Demo",
  "nav.signin": "Sign in",
  "nav.trust": "Trust",
  "locale.switch": "العربية",
  "locale.current": "English",
  "islamic.standards":
    "Designed for Islamic financial institutions with awareness of AAOIFI standards, IFSB prudential principles, and IIFM market documentation practices. Product information is indicative and subject to validation.",
  "islamic.short": "AAOIFI · IFSB · IIFM aware",
  "playground.synthetic": "Synthetic data",
  "playground.simulated": "Simulated output, not a credit decision",
  "hijri.label": "Hijri date",
};

const AR: Dict = {
  "brand.tagline": "ابنِ الذكاء. اصنع الأثر.",
  "nav.products": "المنتجات",
  "nav.solutions": "الحلول",
  "nav.technology": "التقنية",
  "nav.media": "الوسائط",
  "nav.insights": "رؤى",
  "nav.about": "حول",
  "nav.connect": "اطلب عرضًا",
  "nav.signin": "تسجيل الدخول",
  "nav.trust": "الثقة",
  "locale.switch": "English",
  "locale.current": "العربية",
  "islamic.standards":
    "مصمّم للمؤسسات المالية الإسلامية مع مراعاة معايير AAOIFI ومبادئ IFSB الاحترازية وممارسات توثيق IIFM. معلومات المنتج إرشادية وتخضع للتحقق.",
  "islamic.short": "مراعٍ لـ AAOIFI · IFSB · IIFM",
  "playground.synthetic": "بيانات اصطناعية",
  "playground.simulated": "مخرجات محاكاة، وليست قرار ائتمان",
  "hijri.label": "التاريخ الهجري",
};

const TABLES: Record<Locale, Dict> = { en: EN, ar: AR };

export function t(locale: Locale, key: string): string {
  return TABLES[locale][key] ?? TABLES.en[key] ?? key;
}

export function messages(locale: Locale): Dict {
  return TABLES[locale];
}
