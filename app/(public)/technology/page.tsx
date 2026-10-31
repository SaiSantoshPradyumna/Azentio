import { TECHNOLOGY_PILLARS } from "@/lib/site-content";

export const metadata = {
  title: "Technology",
  description: "How Azentio platforms are engineered.",
};

export default function TechnologyPage() {
  return (
    <div className="container-page py-2xl">
      <h1 className="font-display text-3xl font-semibold">Technology</h1>
      <p className="mt-sm max-w-3xl text-content-muted">
        Configurable platforms with evidence, access control and auditability designed in. Everything shown in this
        demo runs on synthetic data with deterministic simulations.
      </p>
      <ul className="mt-xl grid list-none gap-lg md:grid-cols-2">
        {TECHNOLOGY_PILLARS.map((pillar) => (
          <li key={pillar.title} className="card">
            <h2 className="font-semibold">{pillar.title}</h2>
            <p className="mt-sm text-sm leading-relaxed text-content-muted">{pillar.text}</p>
          </li>
        ))}
      </ul>
      <div className="mt-xl max-w-3xl rounded-card border border-line bg-surface-sunken p-lg text-sm leading-relaxed">
        <p className="font-semibold">No model training programme is enabled.</p>
        <p className="mt-xs text-content-muted">
          Shared learning exists to help client teams reason about observed problems. It is never used to train a
          model in this product, and consent for training is always recorded as not granted.
        </p>
      </div>
    </div>
  );
}
