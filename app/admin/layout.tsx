import { ProtectedShell } from "@/components/protected-shell";
import { protectPage } from "@/lib/portal";

export const metadata = {
  title: "Admin console",
  description: "Azentio administration.",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const access = protectPage("read.admin", "employee", "/admin");
  return (
    <ProtectedShell
      access={access}
      title="Admin console"
      blurb="Employees reach this area; each screen inside applies its own permission check and records the decision."
    >
      {children}
    </ProtectedShell>
  );
}
