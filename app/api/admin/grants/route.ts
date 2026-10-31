import { NextResponse } from "next/server";
import { z } from "zod";
import { decidePlatformGrant, listGrantRequests, listPlatformGrants, requestPlatformGrant } from "@/lib/admin-grants";
import { badRequest, failure, withAuth } from "@/lib/withAuth";

export const GET = withAuth(
  () =>
    NextResponse.json({
      requests: listGrantRequests(),
      grants: listPlatformGrants(),
      notice: "Platform grants need two different users with platform.role.grant (request then approve).",
    }),
  { audience: "employee", action: "role.grant.platform" },
);

const postSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("request"),
    email: z.string().email(),
    permission: z.string().min(1),
  }),
  z.object({
    op: z.literal("decide"),
    request_id: z.string().min(1),
    decision: z.enum(["approve", "reject"]),
  }),
]);

export const POST = withAuth(
  async (req, { actor }) => {
    const parsed = postSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return badRequest("invalid grant operation");

    if (parsed.data.op === "request") {
      const result = requestPlatformGrant(actor!, parsed.data);
      if (!result.ok) {
        if (result.status === 400) return badRequest(result.reason);
        return failure(result.status, result.reason);
      }
      return NextResponse.json({
        request: result.request,
        notice: "Request stored. A different administrator must approve before the grant is written.",
      });
    }

    const result = decidePlatformGrant(actor!, parsed.data.request_id, parsed.data.decision);
    if (!result.ok) {
      if (result.status === 400) return badRequest(result.reason);
      return failure(result.status, result.reason);
    }
    return NextResponse.json({ request: result.request, notice: `Grant ${parsed.data.decision}d.` });
  },
  { audience: "employee", action: "role.grant.platform" },
);
