import { getDb, nowIso, uuid } from "./db";
import type { Actor } from "./authorize";
import type { PlaygroundOutput, PlaygroundScenario } from "./playground";
import { audit } from "./audit";

export type PlaygroundRunRow = {
  id: string;
  tenant_id: string | null;
  user_id: string;
  scenario: string;
  input_json: string;
  output_json: string;
  feedback_json: string | null;
  created_at: string;
};

export function storePlaygroundRun(
  actor: NonNullable<Actor>,
  scenario: PlaygroundScenario,
  input: unknown,
  output: PlaygroundOutput,
): PlaygroundRunRow {
  const id = uuid();
  const createdAt = nowIso();
  getDb()
    .prepare(
      `INSERT INTO playground_runs (id, tenant_id, user_id, scenario, input_json, output_json, feedback_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
    )
    .run(
      id,
      actor.activeTenantId,
      actor.userId,
      scenario,
      JSON.stringify(input),
      JSON.stringify(output),
      createdAt,
    );
  audit(
    actor,
    "playground.run",
    actor.isEmployee && !actor.activeTenantId
      ? "employee"
      : `tenant:${actor.activeTenantId}:product:${scenario}`,
    "allow",
    `stored run ${id}`,
  );
  return getRun(id)!;
}

export function getRun(id: string): PlaygroundRunRow | null {
  const row = getDb().prepare("SELECT * FROM playground_runs WHERE id = ?").get(id) as PlaygroundRunRow | undefined;
  return row ?? null;
}

export function listRunsForActor(actor: NonNullable<Actor>, limit = 20): PlaygroundRunRow[] {
  if (actor.isEmployee && !actor.activeTenantId) {
    return getDb()
      .prepare(
        `SELECT * FROM playground_runs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
      )
      .all(actor.userId, limit) as PlaygroundRunRow[];
  }
  if (!actor.activeTenantId) return [];
  return getDb()
    .prepare(
      `SELECT * FROM playground_runs WHERE user_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT ?`,
    )
    .all(actor.userId, actor.activeTenantId, limit) as PlaygroundRunRow[];
}

export type FeedbackPayload = {
  usefulness: number;
  unclear: boolean;
  comment: string;
};

export function storeFeedback(
  actor: NonNullable<Actor>,
  runId: string,
  feedback: FeedbackPayload,
): { ok: true; run: PlaygroundRunRow } | { ok: false; status: 404 | 403; reason: string } {
  const run = getRun(runId);
  if (!run) return { ok: false, status: 404, reason: "run not found" };
  if (run.user_id !== actor.userId) return { ok: false, status: 404, reason: "run not found" };
  if (actor.activeTenantId && run.tenant_id && run.tenant_id !== actor.activeTenantId) {
    return { ok: false, status: 404, reason: "run not found" };
  }

  getDb()
    .prepare("UPDATE playground_runs SET feedback_json = ? WHERE id = ?")
    .run(JSON.stringify(feedback), runId);
  audit(actor, "playground.feedback", "session", "allow", `feedback on ${runId}`);
  return { ok: true, run: getRun(runId)! };
}
