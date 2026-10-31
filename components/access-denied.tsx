import Link from "next/link";

// Denied pages explain the rule that blocked them, without revealing another tenant's data.
export function AccessDenied({ reason, signInHref = "/login" }: { reason: string; signInHref?: string }) {
  return (
    <div className="card max-w-xl" role="alert">
      <p className="font-display text-lg font-semibold text-content">Access denied</p>
      <p className="mt-xs text-sm text-content-muted">
        This page is protected by the policy engine. Reason recorded in the audit log:{" "}
        <span className="font-semibold">{reason}</span>.
      </p>
      <div className="mt-md flex flex-wrap gap-md">
        <Link href={signInHref} className="btn-primary text-sm">
          Sign in
        </Link>
        <Link href="/" className="btn-secondary text-sm">
          Back to the public site
        </Link>
      </div>
    </div>
  );
}
