import { getDb } from "./db";

// The only place a shared copy changes between live and suspended without being rewritten. Section 8
// lets publish.ts, withdraw.ts and cohort.ts read shared_views; this module never SELECTs and never
// returns a row to a caller — it moves one state flag, which is what makes a suspension invisible in
// every read path at once, because visible.ts filters on state = 'live'.

/** Every live copy of a contribution goes out of the reads. Returns how many moved. */
export function suspendLiveViews(contributionId: string): number {
  return getDb()
    .prepare("UPDATE shared_views SET state = 'suspended' WHERE contribution_id = ? AND state = 'live'")
    .run(contributionId).changes;
}

/** One named copy, taken out of the reads by a report. False when it was not live. */
export function suspendSharedView(sharedViewId: string): boolean {
  return (
    getDb()
      .prepare("UPDATE shared_views SET state = 'suspended' WHERE id = ? AND state = 'live'")
      .run(sharedViewId).changes > 0
  );
}

/**
 * One named copy back. Only a suspended row moves, so a withdrawn (deleted) copy cannot be revived and
 * a live one is not re-published with a fresh timestamp.
 */
export function restoreSharedView(sharedViewId: string): boolean {
  return (
    getDb()
      .prepare("UPDATE shared_views SET state = 'live' WHERE id = ? AND state = 'suspended'")
      .run(sharedViewId).changes > 0
  );
}
