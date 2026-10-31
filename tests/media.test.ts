import { describe, expect, it } from "vitest";
import { parseRangeHeader } from "@/lib/media";

describe("media Range parsing", () => {
  it("parses a closed byte range", () => {
    expect(parseRangeHeader("bytes=0-99", 1000)).toEqual({ start: 0, end: 99 });
  });

  it("parses an open-ended range", () => {
    expect(parseRangeHeader("bytes=100-", 500)).toEqual({ start: 100, end: 499 });
  });

  it("parses a suffix range", () => {
    expect(parseRangeHeader("bytes=-50", 200)).toEqual({ start: 150, end: 199 });
  });

  it("rejects invalid ranges", () => {
    expect(parseRangeHeader("bytes=500-100", 200)).toBe("invalid");
    expect(parseRangeHeader("cookies=1-2", 200)).toBe("invalid");
  });

  it("returns null when no header", () => {
    expect(parseRangeHeader(null, 200)).toBeNull();
  });
});
