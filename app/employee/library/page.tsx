import Link from "next/link";
import { listContentBlocks } from "@/lib/content-blocks";
import { listMediaByAudience } from "@/lib/media";

export const metadata = { title: "Library" };

export default function EmployeeLibraryPage() {
  const media = listMediaByAudience(["employee", "public"]);
  const blocks = listContentBlocks();

  return (
    <div className="space-y-xl max-w-3xl">
      <header className="space-y-sm">
        <h2 className="font-display text-xl font-semibold">Library</h2>
        <p className="text-sm text-content-muted">
          Employee and public catalogue. Private media never sits under <code>/public</code>.
        </p>
      </header>

      <section className="space-y-md" aria-labelledby="lib-media">
        <h3 id="lib-media" className="font-display text-lg font-semibold">
          Media assets
        </h3>
        <ul className="space-y-sm">
          {media.map((m) => (
            <li key={m.id} className="card flex flex-wrap items-center justify-between gap-md">
              <div>
                <p className="font-semibold">{m.title}</p>
                <p className="text-xs text-content-muted">
                  {m.audience} · {m.kind} · Placeholder recording
                </p>
              </div>
              <Link href={`/api/media/${m.id}`} className="btn-secondary text-sm">
                Open stream
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-md" aria-labelledby="lib-blocks">
        <h3 id="lib-blocks" className="font-display text-lg font-semibold">
          Content blocks
        </h3>
        <ul className="space-y-sm">
          {blocks.map((b) => (
            <li key={b.key} className="card">
              <p className="font-mono text-xs text-content-muted">
                {b.key} · {b.audience}
              </p>
              <p className="mt-sm text-sm">{b.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
