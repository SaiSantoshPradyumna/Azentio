import { listPublicMedia } from "@/lib/public-db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Media",
  description: "Public showcases and product banners.",
};

export default function MediaPage() {
  const assets = listPublicMedia();
  return (
    <div className="container-page py-2xl">
      <h1 className="font-display text-3xl font-semibold">Media</h1>
      <p className="mt-sm max-w-3xl text-content-muted">
        Public showcases only. Internal session recordings are streamed to authorised employees through a protected
        endpoint and never appear here.
      </p>
      {assets.length === 0 ? (
        <p className="mt-xl text-content-muted">
          No public media is available in this demo yet. Run the seed command to load placeholder assets.
        </p>
      ) : (
        <ul className="mt-xl grid list-none gap-lg md:grid-cols-2">
          {assets.map((asset) => (
            <li key={asset.id} className="card">
              <div
                className="grid aspect-video place-items-center rounded-card border border-dashed border-line bg-surface-sunken text-sm text-content-muted"
                role="img"
                aria-label={`Placeholder for ${asset.title}`}
              >
                Placeholder recording
              </div>
              <h2 className="mt-md font-semibold">{asset.title}</h2>
              <p className="mt-xs text-sm text-content-muted">
                Public showcase · streaming available in a later build phase
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
