import Link from "next/link";
import { AdminGrantsPanel } from "@/components/admin-grants-panel";
import { AdminOrgsPanel } from "@/components/admin-orgs-panel";
import { TestRunnerPanel } from "@/components/test-runner-panel";
import { listGrantRequests, listPlatformGrants } from "@/lib/admin-grants";
import { listOrgs, listProducts } from "@/lib/admin-orgs";
import { currentActor } from "@/lib/portal";
import { latestAccessTestSummary } from "@/lib/test-runner";

export default function AdminPage() {
  const actor = currentActor();
  if (!actor) return null;

  const canOrgs = actor.platformPerms.has("org.manage");
  const canGrants = actor.platformPerms.has("platform.role.grant");
  const canAudit = actor.platformPerms.has("audit.read");
  const latest = latestAccessTestSummary();

  return (
    <div className="space-y-2xl">
      <header className="max-w-2xl space-y-sm">
        <h2 className="font-display text-xl font-semibold">Admin console</h2>
        <p className="text-sm text-content-muted">
          Organisations, entitlements, two-person platform grants, audit chain and the Access Test Runner. Client admins
          cannot reach these screens.
        </p>
        <p className="text-sm">
          <Link href="/admin/audit" className="font-semibold text-accent hover:underline">
            Audit trail and chain check
          </Link>
          {canAudit ? " — available." : " — needs audit.read."}
          {latest
            ? ` Latest runner: ${latest.passed} PASS / ${latest.failed} FAIL at ${latest.at}.`
            : " No Access Test Runner result stored yet."}
        </p>
      </header>

      {canOrgs ? (
        <section aria-labelledby="admin-orgs">
          <h3 id="admin-orgs" className="mb-md font-display text-lg font-semibold">
            Organisations and entitlements
          </h3>
          <AdminOrgsPanel initialOrgs={listOrgs()} products={listProducts()} />
        </section>
      ) : (
        <p className="text-sm text-content-muted">Organisations panel needs org.manage.</p>
      )}

      {canGrants ? (
        <section aria-labelledby="admin-grants">
          <h3 id="admin-grants" className="mb-md font-display text-lg font-semibold">
            Platform grant requests (two-person approval)
          </h3>
          <AdminGrantsPanel initialRequests={listGrantRequests()} initialGrants={listPlatformGrants()} />
        </section>
      ) : (
        <p className="text-sm text-content-muted">Grant panel needs platform.role.grant.</p>
      )}

      {canAudit ? (
        <section aria-labelledby="admin-runner">
          <h3 id="admin-runner" className="mb-md font-display text-lg font-semibold">
            Access Test Runner
          </h3>
          <TestRunnerPanel />
        </section>
      ) : (
        <p className="text-sm text-content-muted">Access Test Runner needs audit.read.</p>
      )}
    </div>
  );
}
