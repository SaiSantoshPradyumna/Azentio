import { NextResponse } from "next/server";
import { clientIdeas } from "@/lib/ideas";
import { withAuth } from "@/lib/withAuth";

// Section 17: GET /api/client/ideas is community-read and returns approved update text only. The
// tenant comes from the session (Section 7.5), and clientIdeaDTO() is the whole shape — no priority,
// no history reason, no delivery date.
export const GET = withAuth((req, { actor }) => {
  const items = clientIdeas(actor!.activeTenantId ?? "");

  return NextResponse.json({
    items,
    count: items.length,
    notice: "Plain-language status and approved text only. Internal prioritisation, history reasons and delivery dates are never shown here.",
  });
}, { audience: "community", action: "read.ideas" });
