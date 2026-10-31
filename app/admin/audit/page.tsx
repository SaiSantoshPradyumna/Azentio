import { AccessDenied } from "@/components/access-denied";
import { readAudit, verifyChain } from "@/lib/audit";
import { currentActor, protectPage } from "@/lib/portal";

const DECISION_STYLES = { allow: "text-success", deny: "text-warning" } as const;

export default function AdminAuditPage() {
  const access = protectPage("audit.read", "employee", "/admin/audit");
  if (!access.ok) {
    return <AccessDenied reason={access.reason} />;
  }

  const actor = currentActor();
  if (!actor?.platformPerms.has("audit.read")) {
    return <AccessDenied reason="missing permission audit.read" />;
  }

  const rows = readAudit(50);
  const chain = verifyChain();

  return (
    <div className="space-y-xl">
      <section className="card max-w-2xl" aria-labelledby="chain-check">
        <h2 id="chain-check" className="font-display text-lg font-semibold">
          Chain check
        </h2>
        <p className="mt-sm text-sm" role="status" aria-live="polite">
          <span className={chain.ok ? "font-semibold text-success" : "font-semibold text-warning"}>
            {chain.ok ? "Chain valid" : "Chain broken"}
          </span>{" "}
          — {chain.rows} row(s) verified. Each row hashes the previous row&rsquo;s hash; the first row uses 64 zeros.
          {chain.ok ? null : ` First mismatch at row id ${chain.firstBadId}.`}
        </p>
      </section>

      <section aria-labelledby="audit-table">
        <h2 id="audit-table" className="font-display text-xl font-semibold">
          Latest {rows.length} decisions
        </h2>
        {rows.length === 0 ? (
          <p className="mt-sm text-sm text-content-muted">Nothing has been recorded yet.</p>
        ) : (
          <div className="mt-md overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">Audit log entries, newest first</caption>
              <thead>
                <tr className="border-b border-line text-left">
                  {["Time", "Actor", "Organisation", "Action", "Resource", "Decision", "Reason"].map((heading) => (
                    <th key={heading} scope="col" className="whitespace-nowrap py-sm pr-md font-semibold">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-line/60 align-top">
                    <td className="whitespace-nowrap py-sm pr-md font-mono text-xs">{row.ts}</td>
                    <td className="py-sm pr-md font-mono text-xs">{row.actor_id ?? "—"}</td>
                    <td className="py-sm pr-md font-mono text-xs">{row.active_tenant_id ?? "—"}</td>
                    <td className="py-sm pr-md">{row.action}</td>
                    <td className="py-sm pr-md font-mono text-xs">{row.resource}</td>
                    <td className={`py-sm pr-md font-semibold ${DECISION_STYLES[row.decision as "allow" | "deny"] ?? ""}`}>
                      {row.decision}
                    </td>
                    <td className="py-sm text-content-muted">{row.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
