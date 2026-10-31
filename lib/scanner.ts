// Section 10.1 and 10.2. The scan is a hint, not a guarantee: publishing stays blocked until a
// moderator resolves every flag, and the flag list is only ever a prompt to look closer.
//
// This module is pure — no database, no session. lib/moderation-actions.ts stores what scan() finds,
// and lib/publish.ts uses the two coarsening helpers. That keeps one copy of every pattern, so the
// seed, the submit path and the review screen can never disagree about what is sensitive.

export const FLAG_KINDS = [
  "email",
  "phone",
  "long_number",
  "amount",
  "credential",
  "customer_name",
  "rare_place",
] as const;

export type FlagKind = (typeof FLAG_KINDS)[number];

/** Seed blocklists from Section 10.1. Synthetic company and place names only. */
export const CUSTOMER_BLOCKLIST = ["Harbor Foods", "Maple Retail", "Sunrise Textiles", "Kestrel Logistics"];
export const SMALL_PLACES = ["Kodaikanal", "Hampi", "Munnar"];

export const FLAG_LABELS: Record<FlagKind, string> = {
  email: "Email address",
  phone: "Phone-number shaped text",
  long_number: "Long number",
  amount: "Currency amount",
  credential: "Credential-shaped text",
  customer_name: "Named customer",
  rare_place: "Small place name",
};

export const FLAG_WHY: Record<FlagKind, string> = {
  email: "A personal or work address identifies someone.",
  phone: "A run of digits can be a contact number.",
  long_number: "Account, loan or agreement numbers are usually nine digits or longer.",
  amount: "A specific amount can identify a single facility.",
  credential: "Secrets never belong in shared learning.",
  customer_name: "A named customer is identifiable even without an account number.",
  rare_place: "A small place narrows a group down to very few people.",
};

function escapeForPattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function alternatives(names: string[]): string {
  return names.map(escapeForPattern).join("|");
}

// Rebuilt on each call rather than cached in a module constant: a global RegExp keeps lastIndex
// between calls, which would silently skip matches on a second scan of the same process.
function patternFor(kind: FlagKind): RegExp {
  switch (kind) {
    case "email":
      return /[\w.+-]+@[\w-]+\.[\w.-]+/g;
    case "phone":
      return /\+?\d[\d\s().-]{8,}\d/g;
    case "long_number":
      return /\b\d{9,}\b/g;
    case "amount":
      return /(₹|\$|€|£|INR|USD|Rs\.?)\s?\d[\d,\.]*/gi;
    case "credential":
      return /(password|passwd|secret|api[_-]?key|token)\s*[:=]/gi;
    case "customer_name":
      return new RegExp(alternatives(CUSTOMER_BLOCKLIST), "gi");
    case "rare_place":
      return new RegExp(alternatives(SMALL_PLACES), "gi");
  }
}

export type ScanFlag = { kind: FlagKind; snippet: string };

const SNIPPET_LIMIT = 120;

/** Every match of every pattern, in the order the patterns are declared. */
export function scan(text: string): ScanFlag[] {
  const flags: ScanFlag[] = [];
  for (const kind of FLAG_KINDS) {
    for (const match of text.matchAll(patternFor(kind))) {
      const snippet = match[0] ?? "";
      if (!snippet) continue;
      flags.push({ kind, snippet: snippet.slice(0, SNIPPET_LIMIT) });
    }
  }
  return flags;
}

/** True when any of the seven patterns would fire — used by tests and by the review screen header. */
export function hasSensitiveShape(text: string): boolean {
  return FLAG_KINDS.some((kind) => patternFor(kind).test(text));
}

// Section 10.2 coarsening. The map is exactly the set of examples the spec gives; anything else is
// deliberately widened to "Unspecified region" rather than guessed at.
const BROAD_REGIONS = ["South India", "West India", "North India", "East India"];

const REGION_BY_PLACE: Record<string, string> = {
  bengaluru: "South India",
  mysuru: "South India",
  chennai: "South India",
  mumbai: "West India",
  pune: "West India",
  delhi: "North India",
  kolkata: "East India",
};

/** City or state to a broad region. Already-broad values pass through; unknown values widen. */
export function coarseRegion(value: string): string {
  const text = value.trim().toLowerCase();
  if (!text) return "Unspecified region";
  if (BROAD_REGIONS.some((region) => region.toLowerCase() === text)) {
    return BROAD_REGIONS.find((region) => region.toLowerCase() === text)!;
  }
  for (const [place, region] of Object.entries(REGION_BY_PLACE)) {
    if (text.includes(place)) return region;
  }
  return "Unspecified region";
}

/** `YYYY-MM` to `YYYY-Qn`. Anything that is not that shape becomes `Unspecified period`. */
export function coarseQuarter(period: string): string {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period.trim());
  if (!match) return "Unspecified period";
  return `${match[1]}-Q${Math.ceil(Number(match[2]) / 3)}`;
}
