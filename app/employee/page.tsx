import Link from "next/link";
import { authorize, effectivePermissions } from "@/lib/authorize";
import { getContentBlock } from "@/lib/content-blocks";
import { listMediaByAudience } from "@/lib/media";
import { currentActor } from "@/lib/portal";
import { tr } from "@/lib/locale-server";

export default function EmployeePage() {
  const actor = currentActor();
  if (!actor) return null;

  const permissions = effectivePermissions(actor);
  const canReview = authorize(actor, "moderation.review", { audience: "employee" }).allow;
  const canOwnIdeas = authorize(actor, "idea.write", { audience: "employee" }).allow;
  const canPublish = authorize(actor, "content.update", { audience: "public" }).allow;
  const notice = getContentBlock("employee.notice");
  const live = listMediaByAudience(["employee"]);

  return (
    <div className="space-y-xl">
      <section className="card max-w-3xl" aria-labelledby="employee-welcome">
        <h2 id="employee-welcome" className="font-display text-lg font-semibold">
          Employee dashboard
        </h2>
        <p className="mt-xs text-sm text-content-muted">
          Guided Playground (synthetic), internal live sessions, library and publisher.{" "}
          {tr("islamic.short")} — {tr("islamic.standards")}
        </p>
        {notice ? (
          <p className="mt-md rounded-card bg-surface-sunken p-md text-sm" role="status">
            {notice.body}
          </p>
        ) : null}
        <p className="mt-md text-sm">
          <span className="font-semibold">Permissions:</span>{" "}
          {permissions.length ? permissions.join(", ") : "none beyond employee access"}
        </p>
      </section>

      <section className="grid gap-md sm:grid-cols-2 lg:grid-cols-3" aria-label="Quick links">
        <Link href="/employee/playground" className="card hover:border-accent">
          <h3 className="font-display font-semibold">Playground</h3>
          <p className="mt-xs text-sm text-content-muted">Three synthetic scenarios. Optional local Ollama assist.</p>
        </Link>
        <Link href="/employee/live" className="card hover:border-accent">
          <h3 className="font-display font-semibold">Live</h3>
          <p className="mt-xs text-sm text-content-muted">
            {live.length} protected recording{live.length === 1 ? "" : "s"} with Range streaming.
          </p>
        </Link>
        <Link href="/employee/library" className="card hover:border-accent">
          <h3 className="font-display font-semibold">Library</h3>
          <p className="mt-xs text-sm text-content-muted">Employee media and content blocks.</p>
        </Link>
        <Link href="/employee/publish" className="card hover:border-accent">
          <h3 className="font-display font-semibold">Publisher</h3>
          <p className="mt-xs text-sm text-content-muted">
            {canPublish ? "Edit public banners (content.publish)." : "Needs content.publish — denied without the grant."}
          </p>
        </Link>
        <Link href="/employee/ideas" className="card hover:border-accent">
          <h3 className="font-display font-semibold">Product owner</h3>
          <p className="mt-xs text-sm text-content-muted">
            {canOwnIdeas ? "Ideas, evidence and client updates." : "Needs product.owner."}
          </p>
        </Link>
        <Link href="/moderate" className="card hover:border-accent">
          <h3 className="font-display font-semibold">Moderation</h3>
          <p className="mt-xs text-sm text-content-muted">
            {canReview ? "Queue and reports." : "Needs learning.moderate."}
          </p>
        </Link>
      </section>
    </div>
  );
}
