import { CONSENT_USAGE, NO_TRAINING_NOTE, SHARING_LABELS } from "@/lib/sharing-copy";
import type { ConsentRow } from "@/lib/consents";
import { tenantNameById } from "@/lib/portal";
import type { ContributionRow } from "@/lib/contributions";
import { STATE_PLAIN } from "@/lib/lifecycle";

/** Section 11: the Visibility Inspector panel shown on every contribution. */

function audienceNow(row: ContributionRow): { audience: string; who: string[] } {
  const org = tenantNameById(row.tenant_id);
  const label = `tenant:${row.tenant_id}`;

  if (row.state === "Draft") {
    if (row.sharing_choice === "organisation") {
      return { audience: label, who: [`You`, `Colleagues in ${org} with organisation access`] };
    }
    return {
      audience: `author:${row.author_id}`,
      who: ["You only. A moderator opens the text once you submit it for review."],
    };
  }
  if (row.state === "Withdrawn") {
    return { audience: "none", who: ["You can still open the record. Colleagues cannot, and no read path or search returns it."] };
  }
  if (row.state === "Rejected") {
    return { audience: label, who: [`You, and ${org} members with organisation access`, "Reviewers, with the moderator's reason"] };
  }
  if (row.state === "Published" || row.state === "Unpublished") {
    const feed =
      row.state === "Published"
        ? "The approved de-identified summary is available to other organisations through the shared learning feed."
        : "The summary is pulled from the shared feed while a review or report is open.";
    return {
      audience: `${label} + community`,
      who: [`You, and ${org} members with organisation access — metadata only, the private text stays with its author`, feed],
    };
  }
  return {
    audience: label,
    who: [`You, and ${org} members with organisation access — metadata only, the private text stays with its author`, "Reviewers in the moderation queue"],
  };
}

export function VisibilityInspector({ row, consents }: { row: ContributionRow; consents: ConsentRow[] }) {
  const seen = audienceNow(row);

  return (
    <section className="card space-y-lg" aria-labelledby="visibility-inspector">
      <h2 id="visibility-inspector" className="font-display text-lg font-semibold">
        Visibility Inspector
      </h2>
      <p className="text-sm text-content-muted">{STATE_PLAIN[row.state]}</p>

      <div>
        <h3 className="text-sm font-semibold">Version {row.version}</h3>
        <dl className="mt-sm grid gap-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-content-muted">Sharing decision</dt>
            <dd className="text-sm">{SHARING_LABELS[row.sharing_choice]}</dd>
          </div>
          <div>
            <dt className="text-xs text-content-muted">Audience label</dt>
            <dd className="font-mono text-sm">{seen.audience}</dd>
          </div>
          <div>
            <dt className="text-xs text-content-muted">State</dt>
            <dd className="text-sm">{row.state}</dd>
          </div>
          <div>
            <dt className="text-xs text-content-muted">Last updated</dt>
            <dd className="text-sm">{row.updated_at}</dd>
          </div>
        </dl>
        <ul className="mt-md list-disc space-y-xs pl-lg text-sm">
          {seen.who.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-sm font-semibold">Consents</h3>
        {consents.length === 0 ? (
          <p className="mt-sm text-sm text-content-muted">
            No consent has been recorded yet. Consents are written when you submit, never when you save a draft, so a
            draft grants nothing beyond processing.
          </p>
        ) : (
          <div className="mt-sm overflow-x-auto">
            <table className="table text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="py-xs pr-md">Purpose</th>
                  <th className="py-xs pr-md">Granted</th>
                  <th className="py-xs pr-md">Policy</th>
                  <th className="py-xs pr-md">Recorded at</th>
                  <th className="py-xs">How it may be used</th>
                </tr>
              </thead>
              <tbody>
                {consents.map((consent) => (
                  <tr key={consent.purpose} className="border-b border-line/60">
                    <td className="py-sm pr-md font-mono">{consent.purpose}</td>
                    <td className="py-sm pr-md">{consent.granted === 1 ? "yes" : "no"}</td>
                    <td className="py-sm pr-md font-mono">{consent.policy_version}</td>
                    <td className="py-sm pr-md">{consent.at}</td>
                    <td className="py-sm">{consent.granted === 1 ? CONSENT_USAGE[consent.purpose] : "not granted."}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="border-t border-line pt-md text-xs text-content-muted">
        {NO_TRAINING_NOTE} The de-identified summary and the sensitive-content scan are built in the moderation phase, and
        the withdrawal purge runs in one transaction when an author withdraws a published item. Until an item is published
        it exists only inside this organisation, and no shared copy of it can be read anywhere.
      </p>
    </section>
  );
}
