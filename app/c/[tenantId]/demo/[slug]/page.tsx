import { notFound } from "next/navigation";
import { PlaygroundPanel } from "@/components/playground-panel";
import { isPlaygroundScenario, type PlaygroundScenario } from "@/lib/playground";
import { currentActor } from "@/lib/portal";

export default function ClientDemoPage({ params }: { params: { tenantId: string; slug: string } }) {
  const actor = currentActor();
  if (!actor || actor.activeTenantId !== params.tenantId) return null;
  if (!isPlaygroundScenario(params.slug)) notFound();
  if (!actor.entitledProducts.has(params.slug)) notFound();

  const allowed = [params.slug] as PlaygroundScenario[];

  return (
    <div className="space-y-lg">
      <header className="max-w-3xl space-y-sm">
        <h2 className="font-display text-xl font-semibold">Entitled demo: {params.slug}</h2>
        <p className="text-sm text-content-muted">
          Synthetic playground for an offering this organisation is entitled to. Audience is{" "}
          <code>
            tenant:{params.tenantId}:product:{params.slug}
          </code>
          . Simulated output only — not a credit decision. AAOIFI / IFSB / IIFM awareness is documentary context, not a
          certification claim.
        </p>
      </header>
      <PlaygroundPanel allowed={allowed} />
    </div>
  );
}
