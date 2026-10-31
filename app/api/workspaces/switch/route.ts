import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { SESSION_COOKIE, setActiveTenant } from "@/lib/session";
import { badRequest, notFound, withAuth } from "@/lib/withAuth";

const schema = z.object({ tenantId: z.string().min(1).max(60) });

// The body carries only the requested target. Membership is verified against the session user and
// the session row is what changes (Section 6 and 7.5).
export const POST = withAuth(
  async (req, { actor }) => {
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return badRequest("invalid request");

    const sessionId = req.cookies.get(SESSION_COOKIE)?.value;
    if (!sessionId || !actor) return notFound();

    const ok = setActiveTenant(sessionId, parsed.data.tenantId);
    audit(actor, "workspace.switch", `tenant:${parsed.data.tenantId}`, ok ? "allow" : "deny", ok ? "active membership" : "no active membership for this organisation");

    if (!ok) return notFound();
    return NextResponse.json({ ok: true, activeTenantId: parsed.data.tenantId });
  },
  { audience: "session", action: "workspace.switch" },
);
