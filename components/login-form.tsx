"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Step = "email" | "code";
type Status = "idle" | "working" | "error";

export function LoginForm({ showOutboxHint }: { showOutboxHint: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  async function onRequestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("working");
    setError(null);
    try {
      const response = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) throw new Error("Request failed");
      setStep("code");
      setStatus("idle");
    } catch (cause) {
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "Request failed");
    }
  }

  async function onVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("working");
    setError(null);
    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = (await response.json().catch(() => null)) as
        | { error?: string; activeTenantId?: string | null; needsWorkspaceChoice?: boolean }
        | null;
      if (!response.ok) throw new Error(data?.error ?? "Sign-in failed");

      const destination = data?.activeTenantId
        ? `/c/${data.activeTenantId}`
        : data?.needsWorkspaceChoice
          ? "/c"
          : "/employee";
      router.push(destination);
      router.refresh();
      return;
    } catch (cause) {
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "Sign-in failed");
    }
  }

  if (step === "code") {
    return (
      <form onSubmit={onVerify} className="card max-w-md space-y-md">
        <div>
          <h2 className="font-display text-xl font-semibold">Enter your code</h2>
          <p className="mt-xs text-sm text-content-muted">
            A six-digit code was created for <span className="font-semibold">{email}</span>. In this demo it is not sent
            by email — it is written to the dev outbox, where its status is "queued (demo)".
          </p>
        </div>

        {showOutboxHint ? (
          <p className="text-sm">
            <a href="/dev/outbox" className="font-semibold text-accent hover:underline">
              Open the dev outbox
            </a>{" "}
            to read the code.
          </p>
        ) : null}

        <div>
          <label className="label" htmlFor="login-code">
            Six-digit code
          </label>
          <input
            id="login-code"
            name="code"
            className="field"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-md">
          <button type="submit" className="btn-primary" disabled={status === "working"}>
            {status === "working" ? "Verifying…" : "Verify and sign in"}
          </button>
          <button type="button" className="btn-secondary text-sm" onClick={() => setStep("email")} disabled={status === "working"}>
            Use another address
          </button>
        </div>

        <p aria-live="polite" className="text-sm">
          {status === "error" && error ? <span className="text-warning">{error}</span> : null}
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={onRequestCode} className="card max-w-md space-y-md">
      <div>
        <h2 className="font-display text-xl font-semibold">Sign in with a one-time code</h2>
        <p className="mt-xs text-sm text-content-muted">
          Enter a seeded demo address. A code is created on the server and stored in the dev outbox; the response is the
          same for unknown addresses so accounts cannot be listed.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="login-email">
          Email address
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          className="field"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-md">
        <button type="submit" className="btn-primary" disabled={status === "working"}>
          {status === "working" ? "Requesting code…" : "Request code"}
        </button>
      </div>

      <p aria-live="polite" className="text-sm">
        {status === "error" && error ? <span className="text-warning">{error}</span> : null}
      </p>
    </form>
  );
}
