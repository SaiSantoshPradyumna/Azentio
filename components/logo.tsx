import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="inline-flex items-center gap-xs font-display text-lg font-semibold text-content">
      <span aria-hidden="true" className="inline-grid h-8 w-8 place-items-center rounded-chip bg-accent-strong text-accent-content">
        A
      </span>
      <span>
        azentio<span className="text-accent">.ai</span>
      </span>
    </Link>
  );
}
