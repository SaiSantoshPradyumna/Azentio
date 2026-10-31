import { exportFilename, sharedViewsCsv } from "@/lib/export";
import { filtersFromParams, visibleSharedViews } from "@/lib/visible";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";

// Section 8: an export is the same DTO list as the feed, encoded as CSV or JSON. No extra field and no
// extra row can appear, because the data comes from visibleSharedViews() and the CSV writes the DTO keys.
export const GET = withAuth((req, { actor }) => {
  const format = req.nextUrl.searchParams.get("format") === "csv" ? "csv" : "json";
  const rows = visibleSharedViews(actor!, filtersFromParams(req.nextUrl.searchParams));
  const disposition = `attachment; filename="${exportFilename(format)}"`;

  if (format === "csv") {
    return new Response(sharedViewsCsv(rows), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": disposition },
    });
  }

  return NextResponse.json({ items: rows, count: rows.length, format }, { headers: { "content-disposition": disposition } });
}, { audience: "community", action: "read.export" });
