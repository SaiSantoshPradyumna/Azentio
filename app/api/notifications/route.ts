import { NextResponse } from "next/server";
import { listNotifications, unreadCount } from "@/lib/notify";
import { withAuth } from "@/lib/withAuth";

// Section 15: stored in-app notifications, own rows only. Nothing here is described as delivered.
export const GET = withAuth((_req, { actor }) => {
  return NextResponse.json({
    items: listNotifications(actor!.userId),
    unread: unreadCount(actor!.userId),
  });
}, { audience: "session", action: "read.notifications" });
