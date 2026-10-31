import { getDb, nowIso } from "./db";
import type { SharingChoice } from "./contribution-schema";
import { CONSENT_PURPOSES, CONSENT_USAGE, consentMatrix } from "./sharing-copy";
import type { ConsentPurpose } from "./sharing-copy";

// Section 11: four purposes recorded separately. `train` is always refused.
// The purposes, the copy and the consent matrix live in ./sharing-copy so the browser and the
// server cannot disagree.

export { CONSENT_PURPOSES, CONSENT_USAGE, SHARING_LABELS, SHARING_EXPLAIN, consentMatrix } from "./sharing-copy";
export type { ConsentPurpose } from "./sharing-copy";

export type ConsentRow = {
  purpose: ConsentPurpose;
  granted: number;
  policy_version: string;
  at: string;
  actor_id: string;
};

export function policyVersion(): string {
  const row = getDb()
    .prepare("SELECT value FROM config WHERE key = 'policy_version'")
    .get() as { value: string } | undefined;
  return row ? row.value : "v1";
}

/** The four consent rows are written together; re-submitting updates them rather than duplicating. */
export function recordConsents(
  contributionId: string,
  actorId: string,
  sharing: SharingChoice,
  attributionRequested: boolean,
): void {
  const db = getDb();
  const matrix = consentMatrix(sharing, attributionRequested);
  const version = policyVersion();
  const ts = nowIso();

  const upsert = db.prepare(
    `INSERT INTO consents (id, contribution_id, purpose, granted, policy_version, at, actor_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET granted = excluded.granted, policy_version = excluded.policy_version,
       at = excluded.at, actor_id = excluded.actor_id`,
  );

  const write = db.transaction(() => {
    for (const purpose of CONSENT_PURPOSES) {
      upsert.run(`consent-${contributionId}-${purpose}`, contributionId, purpose, matrix[purpose] ? 1 : 0, version, ts, actorId);
    }
  });
  write();
}

export function readConsents(contributionId: string): ConsentRow[] {
  return getDb()
    .prepare("SELECT purpose, granted, policy_version, at, actor_id FROM consents WHERE contribution_id = ? ORDER BY purpose")
    .all(contributionId) as ConsentRow[];
}

/** `train` must never be granted; the check backs up the matrix instead of trusting stored rows alone. */
export function usageSummary(consents: ConsentRow[]): string[] {
  return consents.map((row) => `${row.purpose}: ${row.granted === 1 ? CONSENT_USAGE[row.purpose] : "not granted."}`);
}
