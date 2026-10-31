import fs from "node:fs";
import path from "node:path";
import { getDb, dataDir } from "./db";

export type MediaAsset = {
  id: string;
  title: string;
  file_path: string;
  mime: string;
  audience: string;
  kind: string;
};

export function getMediaAsset(id: string): MediaAsset | null {
  const row = getDb()
    .prepare("SELECT id, title, file_path, mime, audience, kind FROM media_assets WHERE id = ?")
    .get(id) as MediaAsset | undefined;
  return row ?? null;
}

export function listMediaByAudience(audiences: string[]): MediaAsset[] {
  if (audiences.length === 0) return [];
  const placeholders = audiences.map(() => "?").join(",");
  return getDb()
    .prepare(
      `SELECT id, title, file_path, mime, audience, kind FROM media_assets WHERE audience IN (${placeholders}) ORDER BY rowid`,
    )
    .all(...audiences) as MediaAsset[];
}

export function absoluteMediaPath(relPath: string): string {
  // Files live under data/private-media/, never under public/ (Section 16).
  return path.join(dataDir(), "private-media", path.basename(relPath));
}

export function mediaFileStats(asset: MediaAsset): { absolute: string; size: number } | null {
  const absolute = absoluteMediaPath(asset.file_path);
  if (!fs.existsSync(absolute)) return null;
  return { absolute, size: fs.statSync(absolute).size };
}

export function parseRangeHeader(
  header: string | null,
  size: number,
): { start: number; end: number } | "invalid" | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if (!match) return "invalid";
  const startText = match[1];
  const endText = match[2];
  if (startText === "" && endText === "") return "invalid";

  let start: number;
  let end: number;
  if (startText === "") {
    const suffix = Number(endText);
    if (!Number.isFinite(suffix) || suffix <= 0) return "invalid";
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(startText);
    end = endText === "" ? size - 1 : Number(endText);
  }

  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= size) {
    return "invalid";
  }
  end = Math.min(end, size - 1);
  return { start, end };
}
