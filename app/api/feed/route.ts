import { NextResponse } from "next/server";
import { filtersFromParams, visibleFacets, visibleSharedViews } from "@/lib/visible";
import { withAuth } from "@/lib/withAuth";

// Section 8 and 17: the community feed is visibleSharedViews() and nothing else. `count` is the length
// of the same array, so a count can never disagree with the results underneath it.
export const GET = withAuth((req, { actor }) => {
  const rows = visibleSharedViews(actor!, filtersFromParams(req.nextUrl.searchParams));
  return NextResponse.json({
    items: rows,
    count: rows.length,
    facets: visibleFacets(actor!),
    notice: "Shared, de-identified and moderator-approved. A count of items is not evidence of market prevalence.",
  });
}, { audience: "community", action: "read.shared" });
