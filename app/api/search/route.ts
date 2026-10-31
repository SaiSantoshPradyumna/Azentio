import { NextResponse } from "next/server";
import { filtersFromParams, visibleSharedViews } from "@/lib/visible";
import { withAuth } from "@/lib/withAuth";

// Search calls the same reader as the feed (Section 8), so a query can only ever narrow what the actor
// could already see. `q` is a substring match on title, summary and topic, case-insensitive.
export const GET = withAuth((req, { actor }) => {
  const filters = filtersFromParams(req.nextUrl.searchParams);
  const rows = visibleSharedViews(actor!, filters);

  return NextResponse.json({
    query: filters.q ?? null,
    items: rows,
    count: rows.length,
    notice: "Results are shared, de-identified, moderator-approved items only. Private drafts and unapproved text are never searched.",
  });
}, { audience: "community", action: "read.search" });
