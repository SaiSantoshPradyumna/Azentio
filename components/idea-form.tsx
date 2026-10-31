"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IDEA_PRIORITIES, IDEA_STATUSES } from "@/lib/idea-lifecycle";

export type IdeaFormValues = {
  title: string;
  problem: string;
  outcome: string;
  owner_team: string;
  offering_slug: string;
  priority: string;
  theme_id: string;
};

export type IdeaFormOptions = {
  offerings: { slug: string; name: string }[];
  themes: { id: string; title: string }[];
};

const PRIORITY_LABEL: Record<string, string> = { low: "Low", medium: "Medium", high: "High" };

/**
 * Section 14: only a product owner opens an idea, and the idea starts life as Proposed. The status is
 * not a field here — it moves through the machine in lib/idea-lifecycle.ts, where each step needs a
 * reason. The theme link is optional, because an idea can come from a single organisation&rsquo;s post.
 */
export function IdeaForm({ basePath, options }: { basePath: string; options: IdeaFormOptions }) {
  const router = useRouter();
  const [values, setValues] = useState<IdeaFormValues>({
    title: "",
    problem: "",
    outcome: "",
    owner_team: "",
    offering_slug: options.offerings[0]?.slug ?? "",
    priority: "medium",
    theme_id: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const using = (patch: Partial<IdeaFormValues>) => setValues((current) => ({ ...current, ...patch }));

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});

    const payload = { ...values, theme_id: values.theme_id || undefined };

    try {
      const response = await fetch("/api/ideas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => null)) as
        | { error?: string; fields?: Record<string, string>; item?: { id?: string } }
        | null;

      if (!response.ok) {
        setError(data?.error ?? "The idea was not stored.");
        setFields(data?.fields ?? {});
        return;
      }

      router.push(`${basePath}/ideas/${data?.item?.id ?? ""}`);
      router.refresh();
    } catch {
      setError("The request did not complete. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card max-w-2xl space-y-md">
      <h2 className="font-display text-lg font-semibold">Open an idea</h2>
      <p className="text-sm text-content-muted">
        The problem and outcome you write here stay internal. A client sees the title, a plain-language status, the owning
        team and only the update text a moderator approves.
      </p>

      <Field label="Title" error={fields.title}>
        <input
          className="field"
          value={values.title}
          onChange={(event) => using({ title: event.target.value })}
          required
          minLength={5}
          maxLength={120}
          disabled={busy}
        />
      </Field>

      <Field label="Problem (what a client or a reviewer actually hit)" error={fields.problem}>
        <textarea
          className="field min-h-[10rem]"
          value={values.problem}
          onChange={(event) => using({ problem: event.target.value })}
          required
          minLength={20}
          maxLength={1500}
          disabled={busy}
        />
      </Field>

      <Field label="Outcome (what &ldquo;solved&rdquo; looks like)" error={fields.outcome}>
        <textarea
          className="field min-h-[10rem]"
          value={values.outcome}
          onChange={(event) => using({ outcome: event.target.value })}
          required
          minLength={20}
          maxLength={1500}
          disabled={busy}
        />
      </Field>

      <div className="grid gap-md sm:grid-cols-2">
        <Field label="Owning team" error={fields.owner_team}>
          <input
            className="field"
            value={values.owner_team}
            onChange={(event) => using({ owner_team: event.target.value })}
            required
            minLength={3}
            maxLength={120}
            disabled={busy}
          />
        </Field>

        <Field label="Offering" error={fields.offering_slug}>
          <select
            className="field"
            value={values.offering_slug}
            onChange={(event) => using({ offering_slug: event.target.value })}
            required
            disabled={busy}
          >
            {options.offerings.map((offering) => (
              <option key={offering.slug} value={offering.slug}>
                {offering.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Priority (internal, never shown to a client)" error={fields.priority}>
          <select className="field" value={values.priority} onChange={(event) => using({ priority: event.target.value })} disabled={busy}>
            {IDEA_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABEL[priority]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Related theme (optional)" error={fields.theme_id}>
          <select className="field" value={values.theme_id} onChange={(event) => using({ theme_id: event.target.value })} disabled={busy}>
            <option value="">None</option>
            {options.themes.map((theme) => (
              <option key={theme.id} value={theme.id}>
                {theme.title}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-md">
        <button type="submit" className="btn-primary" disabled={busy || options.offerings.length === 0}>
          {busy ? "Saving…" : "Open as " + IDEA_STATUSES[0]}
        </button>
        <a href={`${basePath}/ideas`} className="btn-secondary text-sm">
          Cancel
        </a>
      </div>

      <p aria-live="polite" className="text-sm">
        {error ? <span className="text-warning">{error}</span> : null}
      </p>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="label">{label}</span>
      {children}
      {error ? <span className="mt-xs block text-xs text-warning">{error}</span> : null}
    </div>
  );
}
