import { NextResponse } from "next/server";
import { z } from "zod";
import { LOCALE_COOKIE, parseLocale } from "@/lib/i18n";

// Public (Section 7.4 public/*). Locale is presentation only — never authority.
const schema = z.object({ locale: z.enum(["en", "ar"]) });

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "locale must be en or ar" }, { status: 400 });
  }
  const locale = parseLocale(parsed.data.locale);
  const res = NextResponse.json({ locale, dir: locale === "ar" ? "rtl" : "ltr" });
  res.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
