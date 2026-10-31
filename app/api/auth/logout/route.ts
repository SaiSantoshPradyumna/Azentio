import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import { revokeSession, SESSION_COOKIE } from "@/lib/session";

export const POST = withAuth(
  async (req) => {
    const sessionId = req.cookies.get(SESSION_COOKIE)?.value;
    if (sessionId) revokeSession(sessionId);

    const response = NextResponse.json({ ok: true });
    response.headers.set("Cache-Control", "no-store");
    response.cookies.set({ name: SESSION_COOKIE, value: "", httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
    return response;
  },
  { audience: "session", action: "auth.logout" },
);
