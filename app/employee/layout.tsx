import { ProtectedShell } from "@/components/protected-shell";
import { protectPage } from "@/lib/portal";

export const metadata = {
  title: "Employee area",
  description: "Azentio employee workspace.",
};

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const access = protectPage("read.employee.dashboard", "employee", "/employee");
  return (
    <ProtectedShell
      access={access}
      title="Employee area"
      blurb="Employees are identified by an @azentio.com address that is also active in provisioning. The domain alone grants nothing."
    >
      {children}
    </ProtectedShell>
  );
}
