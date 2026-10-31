import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureSchema, getDb, uuid, nowIso } from "@/lib/db";

// Public endpoint (see BUILD_SPEC.md Section 7.4 public list). No authority data is read from the request.
const enquirySchema = z.object({
  kind: z.enum(["demo", "hackathon"]),
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120),
  org: z.string().trim().max(120).optional(),
  message: z.string().trim().max(2000).optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = enquirySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  ensureSchema();
  const d = parsed.data;
  getDb()
    .prepare(
      "INSERT INTO enquiries (id, kind, name, email, org, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(uuid(), d.kind, d.name, d.email, d.org ?? null, d.message ?? null, nowIso());

  return NextResponse.json({ ok: true }, { status: 201 });
}
