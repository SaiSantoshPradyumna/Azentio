import { NextResponse } from "next/server";
import { z } from "zod";
import { getContentBlock, updateContentBlock } from "@/lib/content-blocks";
import { badRequest, failure, notFound, withAuth } from "@/lib/withAuth";

const putSchema = z.object({ body: z.string().min(1).max(4000) });

export const GET = withAuth(
  (_req, { params }) => {
    const block = getContentBlock(String(params.key ?? ""));
    if (!block) return notFound();
    return NextResponse.json({ item: block });
  },
  {
    audience: (_req, { params }) => {
      const block = getContentBlock(String(params.key ?? ""));
      return block ? block.audience : null;
    },
    action: "read.content",
    record: true,
  },
);

export const PUT = withAuth(
  async (req, { actor, params }) => {
    const key = String(params.key ?? "");
    // Refuse unknown keys with 404 after auth so existence does not leak to clients.
    if (!getContentBlock(key)) return notFound();
    const parsed = putSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return badRequest("body text is required");

    const result = updateContentBlock(actor!, key, parsed.data.body);
    if (!result.ok) return failure(result.status, result.reason);
    return NextResponse.json({ item: result.block, notice: "Content block updated." });
  },
  {
    // Section 7.3 step 2 makes `public` read-only, so writes use the employee audience and the
    // content.publish grant (Decision: content PUT). The block must still exist.
    audience: "employee",
    action: "content.update",
  },
);
