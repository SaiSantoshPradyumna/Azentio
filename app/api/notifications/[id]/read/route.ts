import { NextResponse } from "next/server";
import { markNotificationRead } from "@/lib/notify";
import { notFound, withAuth } from "@/lib/withAuth";

function notificationId(params: Record<string, string | string[]>): string {
  const raw = params.id;
  return Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
}

// Own rows only: the id is paired with the session user, so another user's row reads as missing.
export const POST = withAuth((_req, { actor, params }) => {
  const ok = markNotificationRead(actor!.userId, notificationId(params));
  if (!ok) return notFound();

  return NextResponse.json({ ok: true });
}, { audience: "session", action: "notification.mark-read" });
