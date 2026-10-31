import Link from "next/link";
import { IdeaUpdateApproval } from "@/components/idea-update-approval";
import { ReportActions } from "@/components/report-actions";
import { StateBadge } from "@/components/state-badge";
import { authorize } from "@/lib/authorize";
import { pendingUpdates } from "@/lib/ideas";
import { moderationQueue, openReports, type QueueEntry } from "@/lib/moderation";
import { currentActor } from "@/lib/portal";

export const metadata = {
  title: "Review queue",
  description: "Submissions waiting for a moderator, and open reports on shared items.",
};

export default function ModerateQueuePage() {
  // The page guards itself, not only the layout: a segment Next still serialises into the response
  // body must never carry other people's private submissions for an account that cannot review them.
  // The check is the same action the queue API uses, so a screen and its endpoint cannot drift.
  const actor = currentActor();
  if (!actor || !authorize(actor, "moderation.review", { audience: "employee" }).allow) return null;

  const queue = moderationQueue();
  const reports = openReports();
  const pending = pendingUpdates();

  return (
    <div className="space-y-2xl">
      <div className="space-y-md">
        <h1 className="font-display text-2xl font-semibold">Review queue</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-content-muted">
          These items are private. Nothing reaches the shared learning feed until a moderator publishes a de-identified
          summary built from the whitelist in <span className="font-mono">lib/publish.ts</span>. A scanner hint is a prompt
          to look closer, not a guarantee either way, and publishing stays blocked while a hint is unresolved.
        </p>
        <p className="badge" data-testid="queue-count">
          🔒 Private · {queue.submitted.length} waiting · {queue.inReview.length} with a reviewer · {queue.returned.length}{" "}
          returned · {reports.length} open report(s) · {pending.length} client update(s) awaiting approval
        </p>
      </div>

      <QueueGroup
        heading="Waiting for a first decision"
        note="Submitted items nobody has opened yet. Taking one moves it to In review and records the decision."
        entries={queue.submitted}
      />
      <QueueGroup heading="In review" note="Items a moderator has taken. Publishing needs zero unresolved hints." entries={queue.inReview} />
      <QueueGroup
        heading="Returned to the author"
        note="The author was asked to change something. It comes back to this queue when they submit again."
        entries={queue.returned}
      />

      <section className="card space-y-md" aria-labelledby="open-reports">
        <h2 id="open-reports" className="font-display text-lg font-semibold">
          Open reports on shared items
        </h2>
        {reports.length === 0 ? (
          <p className="text-sm text-content-muted" role="status">
            No open reports. A report raised from the community feed appears here.
          </p>
        ) : (
          <ul className="list-none space-y-md">
            {reports.map((report) => (
              <li key={report.id} className="space-y-sm border-l-4 border-warning/60 pl-md">
                <p className="font-display text-sm font-semibold">{report.shared_title ?? "Shared item no longer present"}</p>
                <p className="text-sm">{report.reason}</p>
                <p className="font-mono text-xs text-content-muted">
                  reported by {report.reporter_email} at {report.at} · shared view {report.shared_view_id} · copy state{" "}
                  {report.view_state ?? "deleted"}
                  {report.contribution_id ? ` · record ${report.contribution_state ?? "deleted"}` : ""}
                </p>
                <p className="text-sm text-content-muted">
                  {report.view_state === "suspended"
                    ? "The shared copy is suspended: it is out of the feed, search, export, theme evidence and cohort counts while this report is open."
                    : report.view_state === "live"
                      ? "This copy is still live, which means it was suspended and put back, or the report was raised against a row that has since moved."
                      : "The copy is gone — the author withdrew it or it was deleted. The report stays open until you close it."}
                </p>
                {report.contribution_id ? (
                  <Link href={`/moderate/${report.contribution_id}`} className="text-sm font-semibold text-accent hover:underline">
                    Open the item under review
                  </Link>
                ) : null}
                <ReportActions reportId={report.id} contributionState={report.contribution_state ?? ""} />
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-content-muted">
          A report is stored and suspends the shared copy at once; nothing is emailed, and the author is notified in the app.
          The decision is yours: put the same copy back, or uphold the report and move the record to Unpublished. A copy that
          several reports still name stays suspended until none remain.
        </p>
      </section>

      <section className="card space-y-md" aria-labelledby="pending-updates">
        <h2 id="pending-updates" className="font-display text-lg font-semibold">
          Client-facing updates waiting for you
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-content-muted" role="status">
            Nothing waiting. A product owner&rsquo;s update for an idea appears here until a moderator approves it.
          </p>
        ) : (
          <ul className="list-none space-y-md" role="list">
            {pending.map((update) => (
              <li key={update.id} className="space-y-sm border-l-4 border-line pl-md">
                <p className="font-display text-sm font-semibold">{update.idea_title}</p>
                <p className="text-sm leading-relaxed">{update.text}</p>
                <p className="font-mono text-xs text-content-muted">
                  written by {update.approved_by_email} at {update.at} · update {update.id}
                </p>
                <IdeaUpdateApproval ideaId={update.idea_id} updateId={update.id} />
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-content-muted">
          Until you approve one, no client page renders that text. Approving it means your account stands behind the words:
          the approval is stored as your account in the update&rsquo;s approved_by column, and the idea&rsquo;s author is
          notified.
        </p>
      </section>
    </div>
  );
}

function QueueGroup({ heading, note, entries }: { heading: string; note: string; entries: QueueEntry[] }) {
  return (
    <section className="space-y-md" aria-labelledby={`queue-${heading.replace(/\s+/g, "-").toLowerCase()}`}>
      <div>
        <h2 id={`queue-${heading.replace(/\s+/g, "-").toLowerCase()}`} className="font-display text-lg font-semibold">
          {heading}
        </h2>
        <p className="mt-xs text-sm text-content-muted">{note}</p>
      </div>

      {entries.length === 0 ? (
        <p className="card border-dashed text-sm text-content-muted" role="status">
          Nothing in this group.
        </p>
      ) : (
        <ul className="card list-none divide-y divide-line" role="list">
          {entries.map((entry) => (
            <li key={entry.id} className="space-y-sm py-md">
              <div className="flex flex-wrap items-start justify-between gap-md">
                <Link href={`/moderate/${entry.id}`} className="font-display text-lg font-semibold text-accent hover:underline">
                  {entry.title}
                </Link>
                <StateBadge state={entry.state} detail={entry.unresolved_flags > 0 ? `${entry.unresolved_flags} hint(s) open` : "no open hints"} />
              </div>
              <p className="text-sm text-content-muted">
                {entry.tenant_name} · author {entry.author_name} ({entry.author_email})
              </p>
              <p className="font-mono text-xs text-content-muted">
                {entry.offering_slug} · {entry.topic} · {entry.period} · updated {entry.updated_at}
                {entry.open_reports > 0 ? ` · ${entry.open_reports} open report(s)` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
