import { NextResponse } from "next/server";
import { themeVisibilityBySlug, type ThemeFilters } from "@/lib/cohort";
import { badRequest, notFound, withAuth } from "@/lib/withAuth";

// Section 17: one theme, through the same guard as the list. An unknown slug answers 404, exactly like
// a theme with no rows, so the endpoint never distinguishes the two.
function filtersOf(params: URLSearchParams): ThemeFilters {
  const value = (key: keyof ThemeFilters): string | undefined => {
    const raw = params.get(key);
    return raw && raw.trim() ? raw.trim() : undefined;
  };
  return { period: value("period"), q: value("q") };
}

function slugOf(params: Record<string, string | string[]>): string {
  const raw = params.slug;
  return (Array.isArray(raw) ? raw[0] : raw ?? "").trim();
}

export const GET = withAuth((req, { actor, params }) => {
  const slug = slugOf(params);
  if (!slug) return badRequest("slug is required");

  const view = themeVisibilityBySlug(actor!, slug, filtersOf(req.nextUrl.searchParams));
  if (!view) return notFound();

  return NextResponse.json({
    item: view,
    notice: view.suppressed
      ? "This theme is not shown yet. Its evidence and its organisation count stay hidden until enough independent organisations contribute."
      : "The evidence list comes from the same reader the feed, search and export use. Statistics are bucketed, never per organisation.",
  });
}, { audience: "community", action: "read.theme" });
