import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { effectivePermissions } from "@/lib/authorize";
import { membershipsForUser } from "@/lib/session";
import { withAuth } from "@/lib/withAuth";

export const GET = withAuth(
  (req, { actor }) => {
    const active = actor!.activeTenantId
      ? (getDb()
          .prepare("SELECT id, name, industry, region FROM tenants WHERE id = ?")
          .get(actor!.activeTenantId) as { id: string; name: string; industry: string; region: string } | undefined)
      : undefined;

    return NextResponse.json({
      user: { id: actor!.userId, email: actor!.email, isEmployee: actor!.isEmployee },
      memberships: membershipsForUser(actor!.userId),
      activeTenant: active ?? null,
      clientRole: actor!.clientRole,
      entitledProducts: [...actor!.entitledProducts].sort(),
      permissions: effectivePermissions(actor!),
      needsWorkspaceChoice: actor!.activeTenantId === null && membershipsForUser(actor!.userId).length > 0,
    });
  },
  { audience: "session", action: "read.me" },
);
