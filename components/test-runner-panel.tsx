"use client";

import { useState } from "react";

type Check = {
  id: string;
  check: string;
  expected: string;
  pass: boolean;
  detail: string;
  ms: number;
};

export function TestRunnerPanel() {
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Check[] | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setSummary(null);
    const res = await fetch("/api/admin/test-runner", { method: "POST" });
    const body = await res.json();
    if (!res.ok) {
      setSummary(body.error ?? `HTTP ${res.status}`);
      setResults(null);
    } else {
      setResults(body.results);
      setSummary(body.notice);
    }
    setBusy(false);
  }

  return (
    <div className="space-y-lg">
      <div className="card max-w-2xl space-y-md">
        <h3 className="font-display font-semibold">Access Test Runner</h3>
        <p className="text-sm text-content-muted">
          Creates server-side sessions for seeded users and calls the real API over HTTP (AT-01 … AT-12). Needs{" "}
          <code>audit.read</code>.
        </p>
        <button type="button" className="btn-primary" onClick={run} disabled={busy}>
          {busy ? "Running checks…" : "Run Access Test Runner"}
        </button>
        {summary ? (
          <p className="text-sm font-semibold" role="status">
            {summary}
          </p>
        ) : null}
      </div>

      {results ? (
        <table className="w-full text-sm" data-testid="access-test-results">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="py-sm">ID</th>
              <th>Result</th>
              <th>Check</th>
              <th>Detail</th>
              <th>ms</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.id} className="border-b border-line align-top">
                <td className="py-sm font-mono">{r.id}</td>
                <td className={r.pass ? "text-success font-semibold" : "text-warning font-semibold"}>
                  {r.pass ? "PASS" : "FAIL"}
                </td>
                <td>{r.check}</td>
                <td className="text-content-muted">{r.detail}</td>
                <td>{r.ms}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
