import Link from "next/link";
import { TRUST_ITEMS } from "@/lib/site-content";
import { latestAccessTestSummary } from "@/lib/test-runner";
import { tr, currentLocale } from "@/lib/locale-server";

export const metadata = {
  title: "Trust",
  description: "Access controls, sharing rules and verification.",
};

export default function TrustPage() {
  const latest = latestAccessTestSummary();
  const locale = currentLocale();

  return (
    <div className="container-page py-2xl">
      <h1 className="font-display text-3xl font-semibold">{tr("nav.trust", locale)}</h1>
      <p className="mt-sm max-w-3xl text-content-muted">
        How access is decided, what is shared, and how you can verify it. Every rule below is enforced server-side from
        the session; no role, permission or organisation identifier is ever taken from the browser, the URL or a
        request body.
      </p>
      <p className="mt-md max-w-3xl text-sm text-content-muted">{tr("islamic.standards", locale)}</p>

      <section className="mt-xl" aria-labelledby="controls-heading">
        <h2 id="controls-heading" className="font-display text-xl font-semibold">
          Controls
        </h2>
        <ul className="mt-lg grid list-none gap-lg md:grid-cols-2 xl:grid-cols-3">
          {TRUST_ITEMS.map((item) => (
            <li key={item.title} className="card">
              <h3 className="text-sm font-semibold">{item.title}</h3>
              <p className="mt-xs text-sm leading-relaxed text-content-muted">{item.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-xl card max-w-3xl" aria-labelledby="sharing-heading">
        <h2 id="sharing-heading" className="font-display text-lg font-semibold">
          Sharing rules
        </h2>
        <ul className="mt-sm list-disc space-y-xs pl-lg text-sm leading-relaxed text-content-muted">
          <li>Client observations stay inside the organisation unless the author explicitly chooses to share with the community.</li>
          <li>Community content is de-identified and moderator-reviewed; it is never anonymous.</li>
          <li>Region and time are coarsened (for example South India, 2026-Q2) before publishing.</li>
          <li>A theme is shown only when at least three distinct organisations contribute evidence.</li>
          <li>Withdrawal removes an item from search, feed, themes and idea evidence in a single transaction.</li>
          <li>No model training programme is enabled.</li>
        </ul>
      </section>

      <section className="mt-xl card max-w-3xl" aria-labelledby="verification-heading">
        <h2 id="verification-heading" className="font-display text-lg font-semibold">
          Verification
        </h2>
        <p className="mt-sm text-sm leading-relaxed text-content-muted">
          This portal ships with an Access Test Runner that exercises the real API as each seeded user and reports
          PASS or FAIL for twelve access and privacy checks (AT-01 … AT-12).
        </p>
        {latest ? (
          <p className="mt-md inline-flex items-center gap-xs rounded-chip border border-line bg-surface-sunken px-sm py-xs text-xs font-semibold">
            Latest Access Test Runner: {latest.passed} PASS / {latest.failed} FAIL · {latest.at}
          </p>
        ) : (
          <p className="mt-md inline-flex items-center gap-xs rounded-chip border border-dashed border-line bg-surface-sunken px-sm py-xs text-xs font-semibold text-content-muted">
            Latest Access Test Runner result: not run yet — open Admin as an audit.read holder and run it.
          </p>
        )}
        <p className="mt-md text-sm">
          <Link href="/connect" className="font-semibold text-accent hover:underline">
            Request access to the portal
          </Link>{" "}
          to review these controls in action.
        </p>
      </section>

      <p className="mt-xl text-sm text-content-muted">Product information is indicative and subject to validation.</p>
    </div>
  );
}
