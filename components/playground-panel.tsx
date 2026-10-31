"use client";

import { useState } from "react";
import {
  PLAYGROUND_SCENARIOS,
  SIMILAR_PROFILES,
  type PlaygroundScenario,
} from "@/lib/playground";

type Props = {
  allowed: PlaygroundScenario[];
  /** When true, request optional local Ollama explanation. */
  assistDefault?: boolean;
};

type RunResult = {
  run_id: string;
  output: Record<string, unknown>;
  assist: { ok: boolean; text?: string; reason?: string; notice: string; model?: string } | null;
  notice: string;
};

export function PlaygroundPanel({ allowed, assistDefault = true }: Props) {
  const scenarios = PLAYGROUND_SCENARIOS.filter((s) => allowed.includes(s.slug));
  const [scenario, setScenario] = useState<PlaygroundScenario>(scenarios[0]?.slug ?? "credit-strategy-simulator");
  const [assist, setAssist] = useState(assistDefault);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [feedback, setFeedback] = useState({ usefulness: 4, unclear: false, comment: "" });
  const [feedbackNote, setFeedbackNote] = useState<string | null>(null);

  // Inputs
  const [minScore, setMinScore] = useState(620);
  const [minDscr, setMinDscr] = useState(1.2);
  const [revenue, setRevenue] = useState(12_000_000);
  const [ebitda, setEbitda] = useState(2_400_000);
  const [existingDebtService, setExisting] = useState(800_000);
  const [requestedAmount, setRequested] = useState(1_500_000);
  const [seasonal, setSeasonal] = useState(true);
  const [profileId, setProfileId] = useState("p1");

  async function run() {
    setBusy(true);
    setError(null);
    setFeedbackNote(null);
    let input: Record<string, unknown> = {};
    if (scenario === "credit-strategy-simulator") input = { minScore, minDscr };
    else if (scenario === "sme-credit-decisioning") {
      input = { revenue, ebitda, existingDebtService, requestedAmount, seasonal };
    } else input = { profileId };

    try {
      const res = await fetch("/api/playground/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario, input, assist }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? `HTTP ${res.status}`);
        setResult(null);
      } else {
        setResult(body as RunResult);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "run failed");
    } finally {
      setBusy(false);
    }
  }

  async function sendFeedback() {
    if (!result) return;
    const res = await fetch("/api/playground/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ run_id: result.run_id, ...feedback }),
    });
    const body = await res.json();
    setFeedbackNote(res.ok ? body.notice : body.error ?? "feedback failed");
  }

  if (scenarios.length === 0) {
    return (
      <div className="card border-dashed" role="status">
        <p className="font-semibold">No entitled playground scenario</p>
        <p className="mt-sm text-sm text-content-muted">
          This organisation holds no product entitlement that maps to a guided scenario.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-lg">
      <div className="card space-y-md">
        <label className="label" htmlFor="scenario">
          Scenario
        </label>
        <select
          id="scenario"
          className="field"
          value={scenario}
          onChange={(e) => setScenario(e.target.value as PlaygroundScenario)}
        >
          {scenarios.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>

        {scenario === "credit-strategy-simulator" ? (
          <div className="grid gap-md sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="minScore">
                Minimum score (300–800)
              </label>
              <input
                id="minScore"
                className="field"
                type="number"
                min={300}
                max={800}
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="label" htmlFor="minDscr">
                Minimum DSCR (0.8–2.0)
              </label>
              <input
                id="minDscr"
                className="field"
                type="number"
                step={0.05}
                min={0.8}
                max={2}
                value={minDscr}
                onChange={(e) => setMinDscr(Number(e.target.value))}
              />
            </div>
          </div>
        ) : null}

        {scenario === "sme-credit-decisioning" ? (
          <div className="grid gap-md sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="revenue">
                Revenue
              </label>
              <input id="revenue" className="field" type="number" value={revenue} onChange={(e) => setRevenue(Number(e.target.value))} />
            </div>
            <div>
              <label className="label" htmlFor="ebitda">
                EBITDA
              </label>
              <input id="ebitda" className="field" type="number" value={ebitda} onChange={(e) => setEbitda(Number(e.target.value))} />
            </div>
            <div>
              <label className="label" htmlFor="existing">
                Existing debt service
              </label>
              <input
                id="existing"
                className="field"
                type="number"
                value={existingDebtService}
                onChange={(e) => setExisting(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="label" htmlFor="requested">
                Requested amount
              </label>
              <input
                id="requested"
                className="field"
                type="number"
                value={requestedAmount}
                onChange={(e) => setRequested(Number(e.target.value))}
              />
            </div>
            <label className="flex items-center gap-sm text-sm">
              <input type="checkbox" checked={seasonal} onChange={(e) => setSeasonal(e.target.checked)} />
              Seasonal business
            </label>
          </div>
        ) : null}

        {scenario === "similar-portfolio-intelligence" ? (
          <div>
            <label className="label" htmlFor="profile">
              Synthetic applicant profile
            </label>
            <select id="profile" className="field" value={profileId} onChange={(e) => setProfileId(e.target.value)}>
              {SIMILAR_PROFILES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <label className="flex items-center gap-sm text-sm">
          <input type="checkbox" checked={assist} onChange={(e) => setAssist(e.target.checked)} />
          Local Ollama assist (qwen2.5-coder:7b) — explanation only, not a decision
        </label>

        <button type="button" className="btn-primary" onClick={run} disabled={busy}>
          {busy ? "Running…" : "Run simulation"}
        </button>
        {error ? (
          <p className="text-sm text-warning" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      {result ? (
        <div className="card space-y-md" aria-live="polite">
          <div className="flex flex-wrap gap-sm">
            <span className="badge">Synthetic data</span>
            <span className="badge">Simulated output, not a credit decision</span>
          </div>
          <pre className="overflow-x-auto rounded-card bg-surface-sunken p-md text-xs" dir="ltr">
            {JSON.stringify(result.output, null, 2)}
          </pre>
          {result.assist ? (
            <div className="rounded-card border border-line bg-surface-sunken p-md text-sm">
              <p className="font-semibold">Local Ollama assist</p>
              <p className="mt-xs text-content-muted">{result.assist.notice}</p>
              {result.assist.ok ? (
                <p className="mt-sm whitespace-pre-wrap">{result.assist.text}</p>
              ) : (
                <p className="mt-sm text-warning">Unavailable: {result.assist.reason}</p>
              )}
            </div>
          ) : null}

          <div className="space-y-sm border-t border-line pt-md">
            <p className="font-semibold">Structured feedback</p>
            <label className="label" htmlFor="usefulness">
              Usefulness (1–5)
            </label>
            <input
              id="usefulness"
              className="field max-w-[8rem]"
              type="number"
              min={1}
              max={5}
              value={feedback.usefulness}
              onChange={(e) => setFeedback((f) => ({ ...f, usefulness: Number(e.target.value) }))}
            />
            <label className="flex items-center gap-sm text-sm">
              <input
                type="checkbox"
                checked={feedback.unclear}
                onChange={(e) => setFeedback((f) => ({ ...f, unclear: e.target.checked }))}
              />
              Unclear output
            </label>
            <label className="label" htmlFor="comment">
              Comment
            </label>
            <textarea
              id="comment"
              className="field"
              rows={3}
              value={feedback.comment}
              onChange={(e) => setFeedback((f) => ({ ...f, comment: e.target.value }))}
            />
            <button type="button" className="btn-secondary" onClick={sendFeedback}>
              Store feedback
            </button>
            {feedbackNote ? <p className="text-sm text-content-muted">{feedbackNote}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
