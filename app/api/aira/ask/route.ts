import { NextResponse } from "next/server";
import { z } from "zod";
import { askAira } from "@/lib/aira";
import { SESSION_AUDIENCE } from "@/lib/authorize";
import { badRequest, withAuth } from "@/lib/withAuth";

const schema = z.object({ question: z.string().min(3).max(500) });

export const POST = withAuth(
  async (req, { actor }) => {
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return badRequest("question is required");

    const result = askAira(actor, parsed.data.question);
    return NextResponse.json({
      snippets: result.snippets,
      notice: result.notice,
    });
  },
  { audience: SESSION_AUDIENCE, action: "read.aira" },
);
