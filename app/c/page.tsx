import { WorkspacePicker } from "@/components/workspace-picker";
import { currentActor } from "@/lib/portal";
import { membershipsForUser } from "@/lib/session";

export default function ClientWorkspacePage() {
  const actor = currentActor();
  if (!actor) return null;

  const memberships = membershipsForUser(actor.userId);

  if (memberships.length === 0) {
    return (
      <div className="card max-w-xl" role="status">
        <h1 className="font-display text-2xl font-semibold">No organisation membership</h1>
        <p className="mt-sm text-sm text-content-muted">
          Your account has no active organisation membership, so there is no client workspace to open. Employee access
          is separate and uses the employee area.
        </p>
      </div>
    );
  }

  if (actor.activeTenantId) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold">Your workspace</h1>
        <p className="mt-sm max-w-2xl text-content-muted">
          One organisation is active for this session. The active organisation is chosen by the server session, never by
          the address in the browser.
        </p>
        <div className="mt-lg">
          <WorkspacePicker memberships={memberships} activeTenantId={actor.activeTenantId} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Choose an organisation</h1>
      <p className="mt-sm max-w-2xl text-content-muted">
        Your account belongs to more than one organisation. A workspace opens only after you choose, and the choice is
        stored on the server session.
      </p>
      <div className="mt-lg">
        <WorkspacePicker memberships={memberships} activeTenantId={null} />
      </div>
    </div>
  );
}
