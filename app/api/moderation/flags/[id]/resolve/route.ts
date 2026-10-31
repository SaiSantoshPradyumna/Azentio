import { NextResponse } from "next/server";
import { fieldErrors, flagResolveSchema } from "@/lib/contribution-schema";
import { recordId } from "@/lib/contributions";
import { resolveFlag } from "@/lib/moderation-actions";
import { unresolvedFlagCount } from "@/lib/publish";
import { badRequest, failure, withAuth } from "@/lib/withAuth";

// Section 10.1: a scan is a hint, so closing a hint is a recorded human decision — either "redaction
// applied" or "reviewed, not sensitive" — with a reason. Publishing stays blocked while any remain open.
export const POST = withAuth(async (req, { actor, params }) => {
  const parsed = flagResolveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("a resolution and a reason are required", fieldErrors(parsed.error));

  const resolved = resolveFlag(actor!, recordId(params), parsed.data.resolution, parsed.data.reason);
  if (!resolved.ok) return failure(resolved.status, resolved.reason);

  return NextResponse.json({
    item: { id: resolved.row.id, state: resolved.row.state },
    unresolved_flags: unresolvedFlagCount(resolved.row.id),
    note: "Hint resolved. Publishing unlocks only when no unresolved hint is left on this item.",
  });
}, { audience: "employee", action: "moderation.review" });
