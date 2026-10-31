import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ensureSchema } from "@/lib/db";
import { audit } from "@/lib/audit";
import {
  ABSOLUTE_MS,
  allowVerifyAttempt,
  buildActor,
  createSession,
  loadSession,
  SESSION_COOKIE,
  verifyOtp,
} from "@/lib/session";

// Public endpoint (Section 7.4 public list): this is the handler that creates the session.
const schema = z.object({ email: z.string().trim().email().max(120), code: z.string().regex(/^\d{6}$/) });

function isLocalHost(host: string): boolean {
  return /^localhost(:\d+)?$/.test(host) || /^127\.0\.0\.1(:\d+)?$/.test(host);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  ensureSchema();

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();

  if (!allowVerifyAttempt(email)) {
    audit(null, "auth.verify", "session", "deny", "rate limit exceeded");
    return NextResponse.json({ error: "too many attempts" }, { status: 429 });
  }

  const result = verifyOtp(email, parsed.data.code);
  if (!result.ok || !result.userId) {
    audit(null, "auth.verify", "session", "deny", result.reason ?? "invalid code");
    return NextResponse.json({ error: "invalid code" }, { status: 401 });
  }

  const { sessionId, activeTenantId, membershipCount } = createSession(result.userId);
  const needsWorkspaceChoice = activeTenantId === null && membershipCount > 1;
  const session = loadSession(sessionId);

  audit(
    session ? buildActor(session) : null,
    "auth.verify",
    "session",
    "allow",
    needsWorkspaceChoice ? "session created, workspace choice pending" : "session created",
  );

  const response = NextResponse.json({ ok: true, activeTenantId, needsWorkspaceChoice });
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set({
    name: SESSION_COOKIE,
    value: sessionId,
    httpOnly: true,
    sameSite: "lax",
    secure: !isLocalHost(req.nextUrl.host),
    path: "/",
    maxAge: Math.floor(ABSOLUTE_MS / 1000),
  });
  return response;
}
