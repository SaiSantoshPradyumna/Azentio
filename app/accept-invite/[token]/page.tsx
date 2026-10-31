import { AcceptInviteClient } from "@/components/accept-invite-client";
import { currentActor } from "@/lib/portal";

export default function AcceptInvitePage({ params }: { params: { token: string } }) {
  const actor = currentActor();
  return (
    <main id="main" className="container-page py-2xl">
      <h1 className="font-display text-2xl font-semibold">Accept invitation</h1>
      <p className="mt-sm max-w-xl text-sm text-content-muted">
        You must be signed in with the invited email. The membership is created on the server; the token is never a
        source of authority by itself.
      </p>
      <div className="mt-lg">
        <AcceptInviteClient token={params.token} signedIn={!!actor} email={actor?.email ?? null} />
      </div>
    </main>
  );
}
