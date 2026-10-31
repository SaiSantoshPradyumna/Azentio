"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Marks one of your own notifications read. The server pairs the id with the session user. */
export function NotificationReadButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function onClick() {
    setBusy(true);
    setFailed(false);
    try {
      const response = await fetch(`/api/notifications/${id}/read`, { method: "POST", body: "{}" });
      if (!response.ok) setFailed(true);
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="btn-secondary text-xs" onClick={onClick} disabled={busy}>
      {busy ? "Marking…" : failed ? "Could not mark read" : "Mark as read"}
    </button>
  );
}
