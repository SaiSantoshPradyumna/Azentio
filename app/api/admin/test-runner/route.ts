import { NextResponse } from "next/server";
import { runAccessTests } from "@/lib/test-runner";
import { withAuth } from "@/lib/withAuth";

export const POST = withAuth(
  async (req, { actor }) => {
    const origin = req.nextUrl.origin;
    const result = await runAccessTests(origin, actor!);
    return NextResponse.json({
      ...result,
      notice: `Access Test Runner finished: ${result.passed} PASS, ${result.failed} FAIL.`,
    });
  },
  { audience: "employee", action: "audit.read" },
);

export const GET = withAuth(
  async () => {
    const { latestAccessTestSummary } = await import("@/lib/test-runner");
    const latest = latestAccessTestSummary();
    return NextResponse.json({
      latest,
      notice: latest
        ? `Latest run ${latest.at}: ${latest.passed} PASS, ${latest.failed} FAIL.`
        : "No Access Test Runner result stored yet.",
    });
  },
  { audience: "employee", action: "audit.read" },
);
