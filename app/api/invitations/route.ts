import { NextResponse } from "next/server";
import { z } from "zod";
import { createInvitation, listInvitationsForTenant } from "@/lib/invitations";
import { badRequest, failure, withAuth } from "@/lib/withAuth";

const postSchema = z.object({
  email: z.string().email(),
  client_role: z.string(),
});

export const GET = withAuth(
  (_req, { actor }) => {
    const items = listInvitationsForTenant(actor!.activeTenantId!);
    return NextResponse.json({ items, notice: "Invitation links are shown here and in the Dev outbox — nothing was emailed." });
  },
  {
    audience: (_req, { actor }) => (actor?.activeTenantId ? `tenant:${actor.activeTenantId}` : "tenant:missing"),
    action: "invite.create",
  },
);

export const POST = withAuth(
  async (req, { actor }) => {
    const parsed = postSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return badRequest("email and client_role are required");

    const result = createInvitation(actor!, {
      email: parsed.data.email,
      clientRole: parsed.data.client_role,
    });
    if (!result.ok) {
      if (result.status === 400) return badRequest(result.reason);
      return failure(result.status, result.reason);
    }

    return NextResponse.json({
      invitation: {
        id: result.invitation.id,
        email: result.invitation.email,
        client_role: result.invitation.client_role,
        expires_at: result.invitation.expires_at,
      },
      accept_path: result.acceptPath,
      token: result.token,
      notice: "Invitation stored. Link shown to the inviter and queued in the Dev outbox — not emailed.",
    });
  },
  {
    audience: (_req, { actor }) => (actor?.activeTenantId ? `tenant:${actor.activeTenantId}` : "tenant:missing"),
    action: "invite.create",
  },
);
