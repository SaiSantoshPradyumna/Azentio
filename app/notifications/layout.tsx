import { ProtectedShell } from "@/components/protected-shell";
import { protectPage } from "@/lib/portal";

export const metadata = {
  title: "Notifications",
  description: "Notifications stored for your account.",
};

export default function NotificationsLayout({ children }: { children: React.ReactNode }) {
  // Notifications belong to a person, not an organisation, so the scope is the session itself.
  const access = protectPage("read.notifications", "session", "/notifications");
  return (
    <ProtectedShell
      access={access}
      title="Notifications"
      blurb="In-app messages stored for your account: review requests, moderation outcomes and invitations. Nothing here is sent by email in this demo."
    >
      {children}
    </ProtectedShell>
  );
}
