import { describe, expect, it } from "vitest";
import { dirFor, formatDualDate, parseLocale, t } from "@/lib/i18n";

describe("i18n / Hijri / RTL", () => {
  it("parses locales and dirs", () => {
    expect(parseLocale("ar")).toBe("ar");
    expect(parseLocale("en")).toBe("en");
    expect(dirFor("ar")).toBe("rtl");
    expect(dirFor("en")).toBe("ltr");
  });

  it("returns Arabic copy for nav keys", () => {
    expect(t("ar", "nav.products")).toBe("المنتجات");
    expect(t("en", "nav.products")).toBe("Products");
  });

  it("formats a dual Gregorian + Hijri date", () => {
    const dual = formatDualDate(new Date("2026-10-31T12:00:00Z"), "en");
    expect(dual.hijri.length).toBeGreaterThan(3);
    expect(dual.combined).toContain("AH");
  });

  it("mentions Islamic standards bodies in copy", () => {
    expect(t("en", "islamic.standards")).toMatch(/AAOIFI/);
    expect(t("en", "islamic.standards")).toMatch(/IFSB/);
    expect(t("en", "islamic.standards")).toMatch(/IIFM/);
  });
});
