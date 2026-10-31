"use client";

import {
  CONFIDENCE_LEVELS,
  CONFIDENCE_LABELS,
  CONTRIBUTION_TYPES,
  EVIDENCE_LABELS,
  EVIDENCE_TYPES,
  TYPE_LABELS,
} from "@/lib/contribution-schema";
import type { ConfidenceLevel, ContributionType, EvidenceType, SharingChoice } from "@/lib/contribution-schema";

export type OfferingOption = { slug: string; name: string };

export type ObservationFormValues = {
  title: string;
  body: string;
  type: ContributionType;
  topic: string;
  offering_slug: string;
  period: string;
  evidence_type: EvidenceType;
  confidence: ConfidenceLevel;
  sharing_choice: SharingChoice;
  attribution_requested: boolean;
};

/** The eight fields an author owns. The sharing decision is a separate block, not part of this form section. */
export function ObservationFields({
  values,
  using,
  offerings,
  fieldErrors,
}: {
  values: ObservationFormValues;
  using: (patch: Partial<ObservationFormValues>) => void;
  offerings: OfferingOption[];
  fieldErrors: Record<string, string>;
}) {
  const errorFor = (key: keyof ObservationFormValues) => fieldErrors[key];

  return (
    <section className="card space-y-md">
      <h2 className="font-display text-lg font-semibold">The observation</h2>

      <div>
        <label className="label" htmlFor="observation-title">
          Title
        </label>
        <input
          id="observation-title"
          className="field"
          value={values.title}
          onChange={(event) => using({ title: event.target.value })}
          required
        />
        <FieldError text={errorFor("title")} />
      </div>

      <div>
        <label className="label" htmlFor="observation-body">
          What did you see, and when?
        </label>
        <textarea
          id="observation-body"
          className="field min-h-[10rem]"
          rows={7}
          value={values.body}
          onChange={(event) => using({ body: event.target.value })}
          required
        />
        <p className="mt-xs text-xs text-content-muted">
          Write plainly. A moderator reviews this text before anything is shared, and names, amounts and contact
          details are flagged for redaction.
        </p>
        <FieldError text={errorFor("body")} />
      </div>

      <div className="grid gap-md sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="observation-type">
            Type
          </label>
          <select
            id="observation-type"
            className="field"
            value={values.type}
            onChange={(event) => using({ type: event.target.value as ContributionType })}
          >
            {CONTRIBUTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {TYPE_LABELS[type]}
              </option>
            ))}
          </select>
          <FieldError text={errorFor("type")} />
        </div>

        <div>
          <label className="label" htmlFor="observation-topic">
            Topic slug
          </label>
          <input
            id="observation-topic"
            className="field font-mono text-sm"
            value={values.topic}
            placeholder="sme-seasonality"
            onChange={(event) => using({ topic: event.target.value })}
            required
          />
          <FieldError text={errorFor("topic")} />
        </div>

        <div>
          <label className="label" htmlFor="observation-offering">
            Offering
          </label>
          {offerings.length === 0 ? (
            <p className="text-sm text-warning" role="alert">
              This organisation has no entitled offering, so an observation cannot be filed against one.
            </p>
          ) : (
            <select
              id="observation-offering"
              className="field"
              value={values.offering_slug}
              onChange={(event) => using({ offering_slug: event.target.value })}
            >
              {offerings.map((offering) => (
                <option key={offering.slug} value={offering.slug}>
                  {offering.name}
                </option>
              ))}
            </select>
          )}
          <FieldError text={errorFor("offering_slug")} />
        </div>

        <div>
          <label className="label" htmlFor="observation-period">
            Period observed (YYYY-MM)
          </label>
          <input
            id="observation-period"
            className="field"
            value={values.period}
            placeholder="2026-08"
            onChange={(event) => using({ period: event.target.value })}
            required
          />
          <FieldError text={errorFor("period")} />
        </div>

        <div>
          <label className="label" htmlFor="observation-evidence">
            Evidence
          </label>
          <select
            id="observation-evidence"
            className="field"
            value={values.evidence_type}
            onChange={(event) => using({ evidence_type: event.target.value as EvidenceType })}
          >
            {EVIDENCE_TYPES.map((evidence) => (
              <option key={evidence} value={evidence}>
                {EVIDENCE_LABELS[evidence]}
              </option>
            ))}
          </select>
          <FieldError text={errorFor("evidence_type")} />
        </div>

        <div>
          <label className="label" htmlFor="observation-confidence">
            Confidence
          </label>
          <select
            id="observation-confidence"
            className="field"
            value={values.confidence}
            onChange={(event) => using({ confidence: event.target.value as ConfidenceLevel })}
          >
            {CONFIDENCE_LEVELS.map((level) => (
              <option key={level} value={level}>
                {CONFIDENCE_LABELS[level]}
              </option>
            ))}
          </select>
          <FieldError text={errorFor("confidence")} />
        </div>
      </div>
    </section>
  );
}

function FieldError({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <p className="mt-xs text-sm text-warning" role="alert">
      {text}
    </p>
  );
}
