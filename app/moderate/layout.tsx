import { ProtectedShell } from "@/components/protected-shell";
import { protectPage } from "@/lib/portal";

export const metadata = {
  title: "Moderation console",
  description: "Review submitted observations before anything is shared.",
};

export default function ModerateLayout({ children }: { children: React.ReactNode }) {
  // Employee audience plus the moderation.review action, which requires learning.moderate.
  const access = protectPage("moderation.review", "employee", "/moderate");
  return (
    <ProtectedShell
      access={access}
      title="Moderation console"
      blurb="Only accounts holding the learning.moderate platform grant reach this area. Every visit is audited, allowed or denied."
    >
      {children}
    </ProtectedShell>
  );
}
