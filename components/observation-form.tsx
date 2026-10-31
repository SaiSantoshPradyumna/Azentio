"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ObservationFields, type ObservationFormValues, type OfferingOption } from "@/components/observation-fields";
import { SharingFields, type SharingValue } from "@/components/sharing-fields";

export type { ObservationFormValues, OfferingOption } from "@/components/observation-fields";

type Status = "idle" | "working" | "error";

/**
 * Create and edit share one form. `edit` sends only the fields the server allows an author to
 * change, and never sends a sharing decision — saving a draft must not widen who can see it.
 */
export function ObservationForm({
  mode,
  contributionId,
  basePath,
  offerings,
  initial,
}: {
  mode: "create" | "edit";
  contributionId?: string;
  basePath: string;
  offerings: OfferingOption[];
  initial: ObservationFormValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ObservationFormValues>(initial);
  const [status, setStatus] = useState<Status>("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const using = (patch: Partial<ObservationFormValues>) => setValues((current) => ({ ...current, ...patch }));

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("working");
    setFormError(null);
    setFieldErrors({});

    const payload =
      mode === "create"
        ? { ...values }
        : {
            title: values.title,
            body: values.body,
            type: values.type,
            topic: values.topic,
            offering_slug: values.offering_slug,
            period: values.period,
            evidence_type: values.evidence_type,
            confidence: values.confidence,
          };
    const url = mode === "create" ? "/api/contributions" : `/api/contributions/${contributionId}`;

    try {
      const response = await fetch(url, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => null)) as { error?: string; fields?: Record<string, string>; id?: string } | null;

      if (!response.ok) {
        setStatus("error");
        setFormError(data?.error === "invalid contribution" ? "Some fields need attention." : (data?.error ?? "Save failed."));
        setFieldErrors(data?.fields ?? {});
        return;
      }

      const destination = mode === "create" ? `${basePath}/observations/${data?.id ?? ""}` : `${basePath}/observations/${contributionId}`;
      router.push(destination);
      router.refresh();
    } catch {
      setStatus("error");
      setFormError("The request did not complete. Try again.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-xl">
      <ObservationFields values={values} using={using} offerings={offerings} fieldErrors={fieldErrors} />

      {mode === "create" ? (
        <section className="card">
          <SharingFields
            idPrefix="observation-create"
            value={{ sharing: values.sharing_choice, attribution: values.attribution_requested }}
            onChange={(next: SharingValue) => using({ sharing_choice: next.sharing, attribution_requested: next.attribution })}
            disabled={status === "working"}
          />
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-md">
        <button type="submit" className="btn-primary" disabled={status === "working" || offerings.length === 0}>
          {status === "working" ? "Saving…" : mode === "create" ? "Save draft" : "Save changes"}
        </button>
        <a href={`${basePath}/observations`} className="btn-secondary text-sm">
          Cancel
        </a>
      </div>

      <p aria-live="polite" className="text-sm">
        {formError ? <span className="text-warning">{formError}</span> : null}
      </p>
    </form>
  );
}
