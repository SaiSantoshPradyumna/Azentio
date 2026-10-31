import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureSchema, getDb } from "@/lib/db";
import { allowOtpRequest, createOtp, OTP_TTL_MS } from "@/lib/session";
import { pushDevOutbox } from "@/lib/notify";

// Public endpoint (Section 7.4 public list). Always answers { ok: true } so accounts are not enumerable.
const schema = z.object({ email: z.string().trim().email().max(120) });

export async function POST(req: Request): Promise<NextResponse> {
  ensureSchema();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: true });

  const email = parsed.data.email.toLowerCase();
  if (!allowOtpRequest(email)) return NextResponse.json({ ok: true });

  const { code } = createOtp(email);
  if (!code) return NextResponse.json({ ok: true });

  const user = getDb().prepare("SELECT id FROM users WHERE email = ?").get(email) as { id: string };
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
  pushDevOutbox({
    userId: user.id,
    kind: "otp",
    email,
    detail: `Sign-in code ${code} for ${email} — queued (demo), expires ${expiresAt}. Not sent by email.`,
    key: `otp:${email}:${code}`,
  });

  return NextResponse.json({ ok: true });
}
