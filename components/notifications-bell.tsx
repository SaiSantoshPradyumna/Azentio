"use client";

import Link from "next/link";
import { useState } from "react";

type Item = { id: string; kind: string; message: string; read_at: string | null; created_at: string };

// Section 15: the bell lists stored in-app notifications. Nothing is described as delivered.
export function NotificationsBell({ initialUnread }: { initialUnread: number }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const [unread, setUnread] = useState(initialUnread);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onToggle() {
    const next = !open;
    setOpen(next);
    setError(null);
    if (!next || items !== null) return;

    setBusy(true);
    try {
      const response = await fetch("/api/notifications");
      if (!response.ok) throw new Error("Could not load notifications");
      const data = (await response.json()) as { items: Item[]; unread: number };
      setItems(data.items);
      setUnread(data.unread);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load notifications");
    } finally {
      setBusy(false);
    }
  }

  async function onMarkRead(id: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/notifications/${id}/read`, { method: "POST" });
      if (!response.ok) throw new Error("Could not mark it read");
      setItems((current) => (current ?? []).map((item) => (item.id === id ? { ...item, read_at: new Date().toISOString() } : item)));
      setUnread((count) => Math.max(0, count - 1));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not mark it read");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="btn-secondary text-sm"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="notification-panel"
      >
        <span aria-hidden="true">🔔</span> {unread > 0 ? `${unread} unread` : "Notifications"}
      </button>

      {open ? (
        <div id="notification-panel" className="card absolute right-0 z-20 mt-sm w-[min(22rem,90vw)] text-left">
          <p className="text-xs text-content-muted" aria-live="polite">
            {busy ? "Loading…" : error ?? (items === null ? "" : `${unread} unread`)}
          </p>

          {items && items.length === 0 ? (
            <p className="mt-sm text-sm text-content-muted">No stored notifications yet.</p>
          ) : (
            <ul className="mt-sm space-y-sm">
              {(items ?? []).slice(0, 8).map((item) => (
                <li key={item.id} className="rounded-card border border-line p-sm">
                  <p className="text-sm">{item.message}</p>
                  <p className="mt-xs flex flex-wrap items-center justify-between gap-sm text-xs text-content-muted">
                    <span>
                      {item.kind} · stored {item.created_at.slice(0, 16)} · {item.read_at ? "read" : "unread"}
                    </span>
                    {item.read_at ? null : (
                      <button type="button" className="btn-secondary text-xs" disabled={busy} onClick={() => onMarkRead(item.id)}>
                        Mark as read
                      </button>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <Link href="/notifications" className="mt-sm block text-sm font-semibold text-accent hover:underline">
            Open the full list
          </Link>
        </div>
      ) : null}
    </div>
  );
}
