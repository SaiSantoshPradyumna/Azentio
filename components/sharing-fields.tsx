"use client";

import { SHARING_CHOICES, type SharingChoice } from "@/lib/contribution-schema";
import { CONSENT_PURPOSES, CONSENT_USAGE, NO_TRAINING_NOTE, SHARING_EXPLAIN, SHARING_LABELS, consentMatrix } from "@/lib/sharing-copy";

export type SharingValue = { sharing: SharingChoice; attribution: boolean };

/**
 * Section 11: the three sharing choices as radio buttons with a plain-language explanation, the
 * attribution checkbox, and the consent table previewed from the same matrix the server records.
 */
export function SharingFields({
  value,
  onChange,
  idPrefix,
  disabled,
}: {
  value: SharingValue;
  onChange: (next: SharingValue) => void;
  idPrefix: string;
  disabled?: boolean;
}) {
  const matrix = consentMatrix(value.sharing, value.attribution);

  return (
    <fieldset className="space-y-md" disabled={disabled}>
      <legend className="font-display text-lg font-semibold">Who can see this</legend>

      <div className="space-y-sm">
        {SHARING_CHOICES.map((choice) => {
          const inputId = `${idPrefix}-sharing-${choice}`;
          return (
            <div key={choice} className="rounded-card border border-line bg-surface-raised p-md">
              <div className="flex items-start gap-sm">
                <input
                  id={inputId}
                  name={`${idPrefix}-sharing`}
                  type="radio"
                  value={choice}
                  className="mt-xs"
                  checked={value.sharing === choice}
                  onChange={() => onChange({ sharing: choice, attribution: choice === "community" ? value.attribution : false })}
                />
                <div>
                  <label htmlFor={inputId} className="block font-semibold">
                    {SHARING_LABELS[choice]}
                  </label>
                  <p className="mt-xs text-sm text-content-muted">{SHARING_EXPLAIN[choice]}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {value.sharing === "community" ? (
        <div className="flex items-start gap-sm">
          <input
            id={`${idPrefix}-attribution`}
            type="checkbox"
            className="mt-xs"
            checked={value.attribution}
            onChange={(event) => onChange({ sharing: value.sharing, attribution: event.target.checked })}
          />
          <label htmlFor={`${idPrefix}-attribution`} className="text-sm">
            Ask for credit on the shared summary. A moderator still decides whether the credit appears.
          </label>
        </div>
      ) : null}

      <div className="rounded-card border border-dashed border-line bg-surface-sunken p-md">
        <h4 className="text-sm font-semibold">What this choice records</h4>
        <ul className="mt-sm list-none space-y-xs text-sm text-content-muted">
          {CONSENT_PURPOSES.map((purpose) => (
            <li key={purpose}>
              <span className="font-mono">{purpose}</span> — {matrix[purpose] ? CONSENT_USAGE[purpose] : "not granted."}
            </li>
          ))}
        </ul>
        <p className="mt-sm text-sm">{NO_TRAINING_NOTE}</p>
      </div>
    </fieldset>
  );
}
