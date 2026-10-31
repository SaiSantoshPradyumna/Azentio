import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ensureSchema, getDb } from "@/lib/db";
import { readDevOutbox } from "@/lib/notify";

export const metadata = {
  title: "Dev outbox",
  description: "Demo-only view of queued one-time codes and invitation links.",
};

// Read per request: the DEMO_MODE gate and the queued entries must never be frozen into a prerender.
export const dynamic = "force-dynamic";

export default function DevOutboxPage() {
  if (process.env.DEMO_MODE !== "true") notFound();

  ensureSchema();
  const entries = readDevOutbox();

  // Invitation tokens are stored as hashes only, so the page lists what the running process queued.
  const pendingInvitations = (
    getDb()
      .prepare("SELECT COUNT(*) AS n FROM invitations WHERE used_at IS NULL")
      .get() as { n: number }
  ).n;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main id="main" className="flex-1">
        <div className="container-page py-2xl">
          <div className="rounded-card border border-warning/60 bg-warning/10 p-md text-sm">
            <p className="font-semibold text-content">Demo only. In production this is replaced by an email provider.</p>
            <p className="mt-xs text-content-muted">
              Nothing here was delivered by email. Entries are labelled "queued (demo)" and are the newest 50 rows of the
              demo database, so a server restart keeps them and <span className="font-mono text-xs">npm run seed</span>{" "}
              clears them. A code stays usable until its expiry or until it is verified once.
            </p>
          </div>

          <h1 className="mt-xl font-display text-3xl font-semibold">Dev outbox</h1>

          <section className="mt-lg" aria-labelledby="queued-codes">
            <h2 id="queued-codes" className="font-display text-xl font-semibold">
              Queued sign-in codes
            </h2>
            {entries.length === 0 ? (
              <p className="mt-sm text-sm text-content-muted">
                No code has been queued in this demo database yet. Request one on the{" "}
                <Link href="/login" className="font-semibold text-accent hover:underline">
                  sign-in page
                </Link>
                .
              </p>
            ) : (
              <ol className="mt-md space-y-md">
                {entries.map((entry) => (
                  <li key={entry.id} className="card">
                    <p className="font-mono text-sm">{entry.detail}</p>
                    <p className="mt-xs text-xs text-content-muted">
                      {entry.email} · {entry.kind} · queued {entry.at} · status "queued (demo)"
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="mt-2xl" aria-labelledby="queued-invites">
            <h2 id="queued-invites" className="font-display text-xl font-semibold">
              Invitation links
            </h2>
            <p className="mt-sm max-w-2xl text-sm text-content-muted">
              {pendingInvitations === 0
                ? "No invitations exist yet."
                : `${pendingInvitations} invitation token(s) are stored, but tokens are kept as SHA-256 hashes, so the link text cannot be shown from the database.`}{" "}
              Invitation creation is part of the client-admin console in a later build phase; until then no link is
              written here.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
