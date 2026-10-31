import { NotificationReadButton } from "@/components/notification-read-button";
import { listNotifications } from "@/lib/notify";
import { currentActor } from "@/lib/portal";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  "moderation.queue": "Review queue",
  "moderation.decision": "Moderation decision",
  "contribution.submitted": "Submission",
  "contribution.withdrawn": "Withdrawal",
  invitation: "Invitation",
  otp: "Sign-in code",
};

export default function NotificationsPage() {
  const actor = currentActor();
  if (!actor) return null;

  const rows = listNotifications(actor.userId);
  const unread = rows.filter((row) => row.read_at === null).length;

  if (rows.length === 0) {
    return (
      <div className="card max-w-2xl" role="status">
        <h2 className="font-display text-lg font-semibold">Nothing stored yet</h2>
        <p className="mt-sm text-sm text-content-muted">
          Messages appear here when a submission of yours reaches review, when a moderator decides on it, or when you are
          invited to an organisation.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-lg">
      <p className="text-sm text-content-muted" aria-live="polite">
        {unread} of {rows.length} stored for {actor.email} are unread. In-app only: nothing in this list was delivered by
        email.
      </p>

      <ul className="card divide-y divide-line list-none" role="list">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-start justify-between gap-md py-md">
            <div className="max-w-2xl">
              <p className="font-mono text-xs text-content-muted">
                {KIND_LABEL[row.kind] ?? row.kind} · {row.created_at}
              </p>
              <p className="mt-xs text-sm">{row.message}</p>
              <p className="mt-xs text-xs font-semibold">{row.read_at === null ? "Unread" : `Read ${row.read_at}`}</p>
            </div>
            {row.read_at === null ? <NotificationReadButton id={row.id} /> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
