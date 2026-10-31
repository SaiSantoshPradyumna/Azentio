import Link from "next/link";
import { INSIGHTS } from "@/lib/site-content";

export const metadata = {
  title: "Insights",
  description: "Notes on credit operations, AI governance and product design.",
};

export default function InsightsPage() {
  return (
    <div className="container-page py-2xl">
      <h1 className="font-display text-3xl font-semibold">Insights</h1>
      <p className="mt-sm max-w-3xl text-content-muted">
        Short reads from the Azentio team. Community-shared observations from client organisations appear here once
        they are de-identified and moderator-approved.
      </p>
      <ul className="mt-xl divide-y divide-line rounded-card border border-line bg-surface-raised">
        {INSIGHTS.map((insight) => (
          <li key={insight.title} className="p-lg">
            <p className="badge">{insight.tag}</p>
            <h2 className="mt-md font-display text-lg font-semibold">{insight.title}</h2>
            <p className="mt-sm text-sm leading-relaxed text-content-muted">{insight.teaser}</p>
          </li>
        ))}
      </ul>
      <p className="mt-xl text-sm text-content-muted">
        How shared learning is governed: see the{" "}
        <Link href="/trust" className="font-semibold text-accent hover:underline">
          trust page
        </Link>
        .
      </p>
    </div>
  );
}
