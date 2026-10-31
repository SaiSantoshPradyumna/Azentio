import { NextResponse } from "next/server";
import { z } from "zod";
import { storeFeedback } from "@/lib/playground-store";
import { badRequest, failure, withAuth } from "@/lib/withAuth";
import { SESSION_AUDIENCE } from "@/lib/authorize";

const schema = z.object({
  run_id: z.string().min(1),
  usefulness: z.number().int().min(1).max(5),
  unclear: z.boolean().default(false),
  comment: z.string().max(1000).default(""),
});

export const POST = withAuth(
  async (req, { actor }) => {
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return badRequest("run_id and usefulness 1–5 are required");

    const result = storeFeedback(actor!, parsed.data.run_id, {
      usefulness: parsed.data.usefulness,
      unclear: parsed.data.unclear,
      comment: parsed.data.comment,
    });
    if (!result.ok) return failure(result.status, result.reason);

    return NextResponse.json({
      ok: true,
      notice: "Feedback stored. Nothing was emailed.",
    });
  },
  { audience: SESSION_AUDIENCE, action: "playground.feedback" },
);
