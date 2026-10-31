import { ContentPublisher } from "@/components/content-publisher";
import { authorize } from "@/lib/authorize";
import { getContentBlock } from "@/lib/content-blocks";
import { currentActor } from "@/lib/portal";

export const metadata = { title: "Publisher" };

export default function EmployeePublishPage() {
  const actor = currentActor();
  if (!actor) return null;

  const canPublish = authorize(actor, "content.update", { audience: "employee" }).allow;
  const banner = getContentBlock("home.banner");

  return (
    <div className="space-y-lg">
      <header className="max-w-2xl space-y-sm">
        <h2 className="font-display text-xl font-semibold">Content publisher</h2>
        <p className="text-sm text-content-muted">
          Updates public content blocks. Requires <code>content.publish</code>. Seeded publisher:{" "}
          <code>kavya.pub@azentio.com</code>.
        </p>
      </header>
      <ContentPublisher initialBanner={banner?.body ?? ""} canPublish={canPublish} />
    </div>
  );
}
