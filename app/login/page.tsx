import Link from "next/link";
import { LoginForm } from "@/components/login-form";
import { SessionBar } from "@/components/session-bar";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ensureSchema, getDb } from "@/lib/db";
import { currentActor, hasAnyAdminGrant } from "@/lib/portal";

export const metadata = {
  title: "Sign in",
  description: "Sign in to the Azentio collaboration portal with a one-time code.",
};

type AccountRow = { email: string; name: string; access: string };

function demoAccounts(): AccountRow[] {
  ensureSchema();
  const db = getDb();

  const employees = db
    .prepare(
      `SELECT u.email AS email, u.name AS name, p.active AS active,
        (SELECT group_concat(g.permission, ', ') FROM platform_grants g WHERE g.user_id = u.id) AS grants
       FROM users u JOIN employee_provisioning p ON p.email = u.email
       ORDER BY u.email`,
    )
    .all() as { email: string; name: string; active: number; grants: string | null }[];

  const clients = db
    .prepare(
      `SELECT u.email AS email, u.name AS name, t.name AS tenant, m.client_role AS role, m.status AS status
       FROM users u JOIN memberships m ON m.user_id = u.id JOIN tenants t ON t.id = m.tenant_id
       ORDER BY u.email`,
    )
    .all() as { email: string; name: string; tenant: string; role: string; status: string }[];

  const rows: AccountRow[] = employees.map((e) => ({
    email: e.email,
    name: e.name,
    access: `Employee (provisioning ${e.active === 1 ? "active" : "disabled"}): ${e.grants ?? "no platform grants"}`,
  }));

  for (const c of clients) {
    rows.push({ email: c.email, name: c.name, access: `${c.tenant}: ${c.role} (${c.status})` });
  }
  return rows;
}

export default function LoginPage() {
  const actor = currentActor();
  const demoMode = process.env.DEMO_MODE === "true";
  const accounts = demoMode ? demoAccounts() : [];

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      {actor ? <SessionBar actor={actor} /> : null}
      <main id="main" className="flex-1">
        <div className="container-page py-2xl">
          <h1 className="font-display text-3xl font-semibold">Sign in</h1>
          <p className="mt-sm max-w-xl text-content-muted">
            A one-time code is created on the server and stored in the demo outbox. Sessions are httpOnly cookies; no
            role, permission or organisation identifier is kept in the browser.
          </p>

          <div className="mt-lg">
            {actor ? (
              <div className="card max-w-md space-y-md" role="status">
                <p className="font-semibold text-content">You already have an active session.</p>
                <ul className="space-y-xs text-sm text-content-muted">
                  {actor.activeTenantId ? (
                    <li>
                      <Link href={`/c/${actor.activeTenantId}`} className="font-semibold text-accent hover:underline">
                        Client workspace
                      </Link>{" "}
                      — active organisation only.
                    </li>
                  ) : null}
                  {actor.isEmployee ? (
                    <li>
                      <Link href="/employee" className="font-semibold text-accent hover:underline">
                        Employee area
                      </Link>
                      {hasAnyAdminGrant(actor) ? (
                        <>
                          {" · "}
                          <Link href="/admin" className="font-semibold text-accent hover:underline">
                            Admin
                          </Link>
                        </>
                      ) : null}
                      {actor.platformPerms.has("learning.moderate") ? (
                        <>
                          {" · "}
                          <Link href="/moderate" className="font-semibold text-accent hover:underline">
                            Moderation
                          </Link>
                        </>
                      ) : null}
                    </li>
                  ) : null}
                </ul>
                <p className="text-xs text-content-muted">Signing out here revokes the server-side session.</p>
              </div>
            ) : (
              <LoginForm showOutboxHint={demoMode} />
            )}
          </div>

          {demoMode ? (
            <section className="mt-2xl" aria-labelledby="demo-accounts">
              <h2 id="demo-accounts" className="font-display text-xl font-semibold">
                Seeded demo accounts (synthetic)
              </h2>
              <p className="mt-xs max-w-2xl text-sm text-content-muted">
                Every address below is synthetic. Codes appear in{" "}
                <Link href="/dev/outbox" className="font-semibold text-accent hover:underline">
                  the dev outbox
                </Link>{" "}
                — never in an email. <span className="font-semibold">ex.member@aurora.example</span> has a revoked
                membership, so it can sign in but receives no organisation session; a sign-in attempt against a protected
                page is denied and audited.
              </p>
              <div className="mt-md overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <caption className="sr-only">Seeded demo accounts and the access each one has</caption>
                  <thead>
                    <tr className="border-b border-line text-left">
                      <th scope="col" className="py-sm pr-md font-semibold">
                        Email
                      </th>
                      <th scope="col" className="py-sm pr-md font-semibold">
                        Name
                      </th>
                      <th scope="col" className="py-sm font-semibold">
                        Access
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((account) => (
                      <tr key={`${account.email}::${account.access}`} className="border-b border-line/60 align-top">
                        <th scope="row" className="py-sm pr-md font-mono text-xs font-normal">
                          {account.email}
                        </th>
                        <td className="py-sm pr-md">{account.name}</td>
                        <td className="py-sm text-content-muted">{account.access}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {!actor && !demoMode ? (
            <div className="mt-lg max-w-xl rounded-card border border-dashed border-line bg-surface-sunken p-lg text-sm leading-relaxed">
              <p className="font-semibold text-content">Demo outbox is disabled.</p>
              <p className="mt-xs text-content-muted">
                Codes are still created on the server, but this build has no email provider configured, so no code is
                delivered. This state is only useful for testing the deny paths.
              </p>
            </div>
          ) : null}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
