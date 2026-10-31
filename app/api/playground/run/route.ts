import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/authorize";
import {
  isPlaygroundScenario,
  runPlayground,
  type PlaygroundInput,
  type PlaygroundScenario,
} from "@/lib/playground";
import { storePlaygroundRun } from "@/lib/playground-store";
import { explainPlaygroundOutput } from "@/lib/ollama";
import { badRequest, forbidden, withAuth } from "@/lib/withAuth";

const schema = z.object({
  scenario: z.string(),
  input: z.record(z.unknown()).optional(),
  assist: z.boolean().optional(),
});

function audienceFor(actorEmailEmployee: boolean, tenantId: string | null, scenario: PlaygroundScenario): string {
  if (actorEmailEmployee && !tenantId) return "employee";
  if (tenantId) return `tenant:${tenantId}:product:${scenario}`;
  return "employee";
}

export const POST = withAuth(
  async (req, { actor }) => {
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return badRequest("scenario and input are required");
    if (!isPlaygroundScenario(parsed.data.scenario)) {
      return badRequest("unknown playground scenario");
    }

    const scenario = parsed.data.scenario;
    const a = actor!;
    const audience = audienceFor(a.isEmployee, a.activeTenantId, scenario);
    const decision = authorize(a, "read.playground", { audience });
    if (!decision.allow) return forbidden();

    let payload: PlaygroundInput;
    const input = parsed.data.input ?? {};

    if (scenario === "credit-strategy-simulator") {
      payload = {
        scenario,
        input: {
          minScore: Number(input.minScore ?? 620),
          minDscr: Number(input.minDscr ?? 1.2),
        },
      };
    } else if (scenario === "sme-credit-decisioning") {
      payload = {
        scenario,
        input: {
          revenue: Number(input.revenue ?? 0),
          ebitda: Number(input.ebitda ?? 0),
          existingDebtService: Number(input.existingDebtService ?? 0),
          requestedAmount: Number(input.requestedAmount ?? 0),
          seasonal: Boolean(input.seasonal),
        },
      };
    } else {
      payload = {
        scenario,
        input: { profileId: String(input.profileId ?? "p1") },
      };
    }

    const output = runPlayground(payload);
    const run = storePlaygroundRun(a, scenario, payload.input, output);

    let assist = null;
    if (parsed.data.assist) {
      assist = await explainPlaygroundOutput({ scenario, output });
    }

    return NextResponse.json({
      run_id: run.id,
      output,
      assist,
      notice: "Synthetic data. Simulated output, not a credit decision. No training programme is enabled.",
    });
  },
  {
    // Audience recomputed inside after parsing the scenario; wrapper uses a permissive employee
    // gate then the handler re-checks tenant:product entitlement for clients.
    audience: (req, { actor }) => {
      if (!actor) return "employee";
      if (actor.isEmployee) return "employee";
      if (actor.activeTenantId) return `tenant:${actor.activeTenantId}`;
      return "employee";
    },
    action: "read.playground",
  },
);
