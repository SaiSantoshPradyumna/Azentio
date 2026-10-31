import { PlaygroundPanel } from "@/components/playground-panel";
import type { PlaygroundScenario } from "@/lib/playground";
import { PLAYGROUND_SCENARIOS } from "@/lib/playground";

export const metadata = { title: "Playground" };

export default function EmployeePlaygroundPage() {
  const allowed = PLAYGROUND_SCENARIOS.map((s) => s.slug) as PlaygroundScenario[];
  return (
    <div className="space-y-lg">
      <header className="max-w-3xl space-y-sm">
        <h2 className="font-display text-xl font-semibold">Guided Playground</h2>
        <p className="text-sm text-content-muted">
          Deterministic synthetic engines (seed 42). Badges always show <strong>Synthetic data</strong> and{" "}
          <strong>Simulated output, not a credit decision</strong>. Optional local Ollama (qwen2.5-coder:7b) explains
          the JSON — it never replaces the engine and no training programme is enabled. For Islamic FI demos, map
          outcomes to AAOIFI / IFSB / IIFM governance offline.
        </p>
      </header>
      <PlaygroundPanel allowed={allowed} />
    </div>
  );
}
