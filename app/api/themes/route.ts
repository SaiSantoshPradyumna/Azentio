import { NextResponse } from "next/server";
import { themeVisibilities, type ThemeFilters } from "@/lib/cohort";
import { withAuth } from "@/lib/withAuth";

// Section 17: /api/themes applies the cohort guard, so a caller with no organisation membership gets
// the same suppression shape as an empty theme. Filters narrow the counted set, never widen it.
function filtersOf(params: URLSearchParams): ThemeFilters {
  const value = (key: keyof ThemeFilters): string | undefined => {
    const raw = params.get(key);
    return raw && raw.trim() ? raw.trim() : undefined;
  };
  return { period: value("period"), q: value("q") };
}

export const GET = withAuth((req, { actor }) => {
  const items = themeVisibilities(actor!, filtersOf(req.nextUrl.searchParams));
  return NextResponse.json({
    items,
    count: items.length,
    notice: "A theme is shown only when at least the minimum number of organisations contributed its evidence. Suppression hides the evidence and every count, not just the label.",
  });
}, { audience: "community", action: "read.theme" });
