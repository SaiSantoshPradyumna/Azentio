// Optional local assist via Ollama qwen2.5-coder:7b.
// Honest label: this is a local demo helper on the operator's laptop — not a production model,
// not trained on portal content, and never a credit decision. Spec forbids external APIs for
// product behaviour; playground engines stay deterministic. This call is additive explanation only.

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5-coder:7b";

export type OllamaAssistResult =
  | { ok: true; model: string; text: string; notice: string }
  | { ok: false; reason: string; notice: string };

export async function explainPlaygroundOutput(payload: {
  scenario: string;
  output: unknown;
}): Promise<OllamaAssistResult> {
  const notice =
    "Local Ollama assist only (qwen2.5-coder:7b). Not a credit decision. No training programme is enabled. Deterministic playground numbers are authoritative.";

  const prompt = [
    "You explain synthetic credit playground output for Islamic financial institution demos.",
    "Mention AAOIFI, IFSB or IIFM only as governance context, never as a product claim.",
    "Keep under 120 words. Do not invent numbers. Do not recommend approval.",
    `Scenario: ${payload.scenario}`,
    `JSON output: ${JSON.stringify(payload.output)}`,
  ].join("\n");

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        options: { temperature: 0.2, num_predict: 180 },
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      return { ok: false, reason: `ollama HTTP ${res.status}`, notice };
    }
    const data = (await res.json()) as { response?: string };
    const text = (data.response ?? "").trim();
    if (!text) return { ok: false, reason: "empty ollama response", notice };
    return { ok: true, model: OLLAMA_MODEL, text, notice };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "ollama unavailable";
    return { ok: false, reason, notice };
  }
}
