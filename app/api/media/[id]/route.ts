import fs from "node:fs";
import { NextResponse } from "next/server";
import { getMediaAsset, mediaFileStats, parseRangeHeader } from "@/lib/media";
import { notFound, withAuth } from "@/lib/withAuth";

export const GET = withAuth(
  async (req, { params }) => {
    const id = String(params.id ?? "");
    const asset = getMediaAsset(id);
    if (!asset) return notFound();

    const stats = mediaFileStats(asset);
    if (!stats) return notFound();

    const range = parseRangeHeader(req.headers.get("range"), stats.size);
    if (range === "invalid") {
      return new NextResponse(null, {
        status: 416,
        headers: {
          "Content-Range": `bytes */${stats.size}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "no-store",
        },
      });
    }

    if (range) {
      const length = range.end - range.start + 1;
      const buffer = Buffer.alloc(length);
      const fd = fs.openSync(stats.absolute, "r");
      fs.readSync(fd, buffer, 0, length, range.start);
      fs.closeSync(fd);
      return new NextResponse(buffer, {
        status: 206,
        headers: {
          "Content-Type": asset.mime,
          "Content-Length": String(length),
          "Content-Range": `bytes ${range.start}-${range.end}/${stats.size}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "no-store",
        },
      });
    }

    const buffer = fs.readFileSync(stats.absolute);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": asset.mime,
        "Content-Length": String(stats.size),
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store",
      },
    });
  },
  {
    audience: (_req, { params }) => {
      const asset = getMediaAsset(String(params.id ?? ""));
      return asset ? asset.audience : null;
    },
    action: "read.media",
    record: true,
  },
);
