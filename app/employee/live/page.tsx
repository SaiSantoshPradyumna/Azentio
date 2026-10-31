import { listMediaByAudience } from "@/lib/media";

export const metadata = { title: "Internal Live" };

export default function EmployeeLivePage() {
  const items = listMediaByAudience(["employee"]);

  return (
    <div className="space-y-lg max-w-3xl">
      <header className="space-y-sm">
        <h2 className="font-display text-xl font-semibold">Internal live sessions</h2>
        <p className="text-sm text-content-muted">
          Media is streamed from <code>data/private-media/</code> through <code>/api/media/[id]</code> with{" "}
          <code>Range</code> support (HTTP 206). Audience changes apply on the next request. Seeded files are
          placeholders labelled &ldquo;Placeholder recording&rdquo;.
        </p>
      </header>

      <ul className="space-y-md">
        {items.map((item) => (
          <li key={item.id} className="card space-y-sm">
            <h3 className="font-display font-semibold">{item.title}</h3>
            <p className="text-xs text-content-muted">
              {item.kind} · audience {item.audience} · {item.mime} · Placeholder recording
            </p>
            <video controls preload="metadata" className="w-full rounded-card bg-surface-sunken" src={`/api/media/${item.id}`}>
              <track kind="captions" />
            </video>
            <p className="text-xs text-content-muted">
              Stream URL: <code>/api/media/{item.id}</code> — clients without employee access receive 404.
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
