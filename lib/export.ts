import { SHARED_VIEW_DTO_KEYS, type SharedViewDTO } from "./visible";

// Section 8: an export is the same DTO list as the feed, in another encoding. This module only formats;
// it never queries, so it cannot widen what is exportable.

/**
 * A cell that starts with a formula character is neutralised before it is written. Shared text is
 * moderator-approved but still user-supplied, and a CSV opened in a spreadsheet would otherwise
 * evaluate it.
 */
function csvCell(value: string | null): string {
  if (value === null) return "";
  const text = /^([=+\-@\t\r])/.test(value) ? `'${value}` : value;
  return `"${text.replace(/"/g, '""').replace(/[\r\n]+/g, " ")}"`;
}

/** Header and rows in the Section 8 field order, nothing else. */
export function sharedViewsCsv(rows: SharedViewDTO[]): string {
  const lines = [SHARED_VIEW_DTO_KEYS.join(",")];
  for (const row of rows) lines.push(SHARED_VIEW_DTO_KEYS.map((key) => csvCell(row[key])).join(","));
  return `${lines.join("\r\n")}\r\n`;
}

/**
 * The JSON encoding is the DTO array itself. `Content-Disposition` names are plain ASCII so the header
 * cannot carry a stray quote.
 */
export function exportFilename(format: "csv" | "json"): string {
  return `shared-learning.${format === "csv" ? "csv" : "json"}`;
}
