import { NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_AUDIENCE } from "@/lib/authorize";
import { acceptInvitation } from "@/lib/invitations";
import { setActiveTenant, SESSION_COOKIE } from "@/lib/session";
import { badRequest, failure, withAuth } from "@/lib/withAuth";

const schema = z.object({ token: z.string().min(16) });

export const POST = withAuth(
  async (req, { actor }) => {
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return badRequest("token is required");

    const result = acceptInvitation(actor!, parsed.data.token);
    if (!result.ok) {
      if (result.status === 400) return badRequest(result.reason);
      return failure(result.status, result.reason);
    }

    const sid = req.cookies.get(SESSION_COOKIE)?.value;
    if (sid) setActiveTenant(sid, result.tenantId);

    return NextResponse.json({
      ok: true,
      tenant_id: result.tenantId,
      notice: "Membership created. Active organisation switched to the invited tenant.",
    });
  },
  { audience: SESSION_AUDIENCE, action: "invite.accept" },
);
