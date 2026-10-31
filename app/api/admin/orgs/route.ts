import { NextResponse } from "next/server";
import { z } from "zod";
import { createOrg, listOrgs, listProducts, setEntitlement } from "@/lib/admin-orgs";
import { badRequest, failure, withAuth } from "@/lib/withAuth";

export const GET = withAuth(
  () => NextResponse.json({ items: listOrgs(), products: listProducts() }),
  { audience: "employee", action: "org.manage" },
);

const postSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("create"),
    name: z.string().min(2).max(120),
    industry: z.string().min(2).max(80),
    region: z.string().min(2).max(80),
  }),
  z.object({
    op: z.literal("entitlement"),
    tenant_id: z.string().min(1),
    product_slug: z.string().min(1),
    entitled: z.boolean(),
  }),
]);

export const POST = withAuth(
  async (req, { actor }) => {
    const parsed = postSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return badRequest("invalid organisation operation");

    if (parsed.data.op === "create") {
      const result = createOrg(actor!, parsed.data);
      if (!result.ok) {
        if (result.status === 400) return badRequest(result.reason);
        return failure(result.status as 403 | 404 | 409, result.reason);
      }
      return NextResponse.json({ item: result.org, notice: "Organisation created." });
    }

    const result = setEntitlement(actor!, parsed.data.tenant_id, parsed.data.product_slug, parsed.data.entitled);
    if (!result.ok) return failure(result.status, result.reason);
    return NextResponse.json({ ok: true, notice: "Entitlement updated." });
  },
  { audience: "employee", action: "org.manage" },
);
