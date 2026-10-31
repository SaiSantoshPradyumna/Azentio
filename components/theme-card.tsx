import Link from "next/link";
import type { ThemeVisibility } from "@/lib/cohort";
import { CONFIDENCE_LABELS, EVIDENCE_LABELS } from "@/lib/contribution-schema";

// Section 13 in the UI. A visible theme always shows its limitation text and, while the sample is thin,
// a warning that says so. A suppressed theme shows the reason and no numbers at all.
export function ThemeCard({ actorBasePath, theme }: { actorBasePath: string; theme: ThemeVisibility }) {
  return (
    <li
      className="space-y-md rounded-card border border-accent/50 bg-accent/5 p-lg"
      data-testid={theme.suppressed ? "theme-suppressed" : "theme-visible"}
    >
      <div className="flex flex-wrap items-start justify-between gap-md">
        <h3 className="font-display text-lg font-semibold">
          <Link href={`${actorBasePath}/themes/${theme.slug}`} className="hover:underline">
            {theme.title}
          </Link>
        </h3>
        <p className="badge">
          <span aria-hidden="true">{theme.suppressed ? "🔒" : "🌐"}</span>
          {theme.suppressed ? "Not shown yet" : "Shared learning theme"}
        </p>
      </div>

      {theme.suppressed ? (
        <p className="text-sm text-content-muted" role="status">
          {theme.reason}. Its evidence and its organisation count stay hidden until enough independent organisations
          contribute, so this card cannot be read as a statistic.
        </p>
      ) : (
        <>
          <p className="text-sm leading-relaxed">{theme.description}</p>
          <p className="text-sm">
            <span className="font-semibold">{theme.orgBucket}</span> contributed the evidence behind this theme.
            {theme.quarters ? ` Observations span ${theme.quarters.from} to ${theme.quarters.to}.` : ""}
          </p>
          {theme.smallSample ? (
            <p className="text-sm text-content-muted" role="note">
              Small sample: this rests on a handful of self-reported observations. It is not evidence of market
              prevalence or of cause.
            </p>
          ) : null}
          <p className="rounded-card border border-line bg-surface p-sm text-sm text-content-muted">
            <span className="font-semibold">Limitation:</span> {theme.limitation}
          </p>
          <ul className="list-none space-y-xs" role="list">
            {theme.evidence.map((row) => (
              <li key={row.id} className="text-sm">
                <span className="font-medium">{row.title}</span>
                <span className="block font-mono text-xs text-content-muted">
                  {row.offering_slug} · {row.topic} · {row.region_coarse} · {row.period_quarter}
                </span>
                <span className="block text-xs text-content-muted">
                  {row.summary} · Evidence:{" "}
                  {EVIDENCE_LABELS[row.evidence_type as keyof typeof EVIDENCE_LABELS] ?? row.evidence_type} · Confidence:{" "}
                  {CONFIDENCE_LABELS[row.confidence as keyof typeof CONFIDENCE_LABELS] ?? row.confidence}
                  {row.attribution ? ` · Credited to ${row.attribution}` : " · No credit shown"}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </li>
  );
}
