"use client";

import { useState } from "react";

type Kind = "demo" | "hackathon";
type Status = "idle" | "submitting" | "sent" | "error";

const COPY: Record<Kind, { title: string; blurb: string; orgLabel: string; messageLabel: string; cta: string }> = {
  demo: {
    title: "Request a demo",
    blurb: "Tell us your segment and the decision you want to improve. We use the detail to pick a relevant synthetic scenario.",
    orgLabel: "Organisation",
    messageLabel: "What would you like to see?",
    cta: "Submit demo request",
  },
  hackathon: {
    title: "Register for the hackathon",
    blurb: "Build on a synthetic credit decisioning dataset. Teams are notified through this portal.",
    orgLabel: "Team or institution",
    messageLabel: "Anything we should know about your team?",
    cta: "Register interest",
  },
};

export function EnquiryForm({ kind }: { kind: Kind }) {
  const copy = COPY[kind];
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = {
      kind,
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      org: String(form.get("org") ?? ""),
      message: String(form.get("message") ?? ""),
    };

    setStatus("submitting");
    setError(null);
    try {
      const response = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Request failed");
      }
      setStatus("sent");
      formElement.reset();
    } catch (cause) {
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "Request failed");
    }
  }

  if (status === "sent") {
    return (
      <div className="card max-w-xl" role="status" aria-live="polite">
        <p className="font-semibold text-content">Request stored</p>
        <p className="mt-xs text-sm text-content-muted">
          This demo portal stores enquiries in the demo database only. No email is sent and no reply is promised.
        </p>
        <button type="button" className="btn-secondary mt-md text-sm" onClick={() => setStatus("idle")}>
          Submit another request
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card max-w-xl space-y-md" aria-describedby={`${kind}-blurb`}>
      <div>
        <h2 className="font-display text-xl font-semibold">{copy.title}</h2>
        <p id={`${kind}-blurb`} className="mt-xs text-sm text-content-muted">
          {copy.blurb}
        </p>
      </div>

      <div>
        <label className="label" htmlFor={`${kind}-name`}>
          Full name
        </label>
        <input id={`${kind}-name`} name="name" className="field" required minLength={2} autoComplete="name" />
      </div>

      <div>
        <label className="label" htmlFor={`${kind}-email`}>
          Work email
        </label>
        <input id={`${kind}-email`} name="email" type="email" className="field" required autoComplete="email" />
      </div>

      <div>
        <label className="label" htmlFor={`${kind}-org`}>
          {copy.orgLabel} <span className="font-normal text-content-muted">(optional)</span>
        </label>
        <input id={`${kind}-org`} name="org" className="field" autoComplete="organization" />
      </div>

      <div>
        <label className="label" htmlFor={`${kind}-message`}>
          {copy.messageLabel} <span className="font-normal text-content-muted">(optional)</span>
        </label>
        <textarea id={`${kind}-message`} name="message" className="field" rows={4} maxLength={2000} />
      </div>

      <p className="text-xs leading-relaxed text-content-muted">
        We use these details only to prepare the requested demo or registration. Do not include customer data or other
        confidential information.
      </p>

      <div className="flex flex-wrap items-center gap-md">
        <button type="submit" className="btn-primary" disabled={status === "submitting"}>
          {status === "submitting" ? "Submitting…" : copy.cta}
        </button>
        <span aria-live="polite" className="text-sm text-content-muted">
          {status === "error" && error ? <span className="text-warning">{error}</span> : null}
        </span>
      </div>
    </form>
  );
}
