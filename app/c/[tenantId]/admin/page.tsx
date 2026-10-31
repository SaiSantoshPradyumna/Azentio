import { InviteForm } from "@/components/invite-form";
import { listInvitationsForTenant, listMembers } from "@/lib/invitations";
import { currentActor } from "@/lib/portal";
import { authorize } from "@/lib/authorize";

export default function ClientAdminPage({ params }: { params: { tenantId: string } }) {
  const actor = currentActor();
  if (!actor || actor.activeTenantId !== params.tenantId) return null;

  const canInvite = authorize(actor, "invite.create", { audience: `tenant:${params.tenantId}` }).allow;
  if (!canInvite) {
    return (
      <div className="card border-dashed max-w-xl" role="status">
        <p className="font-semibold">Organisation admin only</p>
        <p className="mt-sm text-sm text-content-muted">
          Inviting members and changing client roles needs <code>client_admin</code>. Platform permissions cannot be
          granted from this screen.
        </p>
      </div>
    );
  }

  const members = listMembers(params.tenantId);
  const invites = listInvitationsForTenant(params.tenantId);

  return (
    <div className="space-y-xl">
      <header className="space-y-sm max-w-2xl">
        <h2 className="font-display text-xl font-semibold">Organisation admin</h2>
        <p className="text-sm text-content-muted">
          Members, invitations and client roles only. A client admin can never grant platform permissions or employee
          status.
        </p>
      </header>

      <InviteForm />

      <section className="max-w-2xl space-y-md" aria-labelledby="members">
        <h3 id="members" className="font-display text-lg font-semibold">
          Members
        </h3>
        <ul className="space-y-sm">
          {members.map((m) => (
            <li key={m.membershipId} className="card flex flex-wrap justify-between gap-md text-sm">
              <span>
                {m.name} · {m.email}
              </span>
              <span className="badge">
                {m.role} · {m.status}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="max-w-2xl space-y-md" aria-labelledby="invites">
        <h3 id="invites" className="font-display text-lg font-semibold">
          Invitations
        </h3>
        <ul className="space-y-sm">
          {invites.map((i) => (
            <li key={i.id} className="card text-sm">
              {i.email} · {i.client_role} · expires {i.expires_at}
              {i.used_at ? ` · used ${i.used_at}` : " · open"}
            </li>
          ))}
          {invites.length === 0 ? <li className="text-sm text-content-muted">No invitations yet.</li> : null}
        </ul>
      </section>
    </div>
  );
}
