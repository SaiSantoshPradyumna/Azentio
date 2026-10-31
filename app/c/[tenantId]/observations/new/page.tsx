import Link from "next/link";
import { ObservationForm } from "@/components/observation-form";
import { effectivePermissions } from "@/lib/authorize";
import { entitledOfferings } from "@/lib/contributions";
import { currentActor, tenantNameById } from "@/lib/portal";

export const metadata = { title: "New observation", description: "File a private observation in your organisation." };

export default function NewObservationPage({ params }: { params: { tenantId: string } }) {
  const actor = currentActor();
  if (!actor || actor.activeTenantId !== params.tenantId) return null;

  const tenantId = actor.activeTenantId;
  const basePath = `/c/${tenantId}`;
  const offerings = entitledOfferings(tenantId);

  if (!effectivePermissions(actor).includes("contribution.create")) {
    return (
      <div className="card max-w-2xl" role="alert">
        <h1 className="font-display text-xl font-semibold">Your role cannot file observations</h1>
        <p className="mt-sm text-sm text-content-muted">
          You are {actor.clientRole} in {tenantNameById(tenantId)}. A viewer can read what the organisation allows but
          cannot create. A client admin can invite you as a contributor.
        </p>
        <p className="mt-md">
          <Link href={`${basePath}/observations`} className="btn-secondary">
            Back to observations
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-xl">
      <div>
        <h1 className="font-display text-2xl font-semibold">New observation</h1>
        <p className="mt-xs text-sm text-content-muted">
          Saved as a draft in {tenantNameById(tenantId)} and visible only to you unless you choose organisation
          sharing. Industry and region come from your organisation record, not from this form.
        </p>
      </div>

      <ObservationForm
        mode="create"
        basePath={basePath}
        offerings={offerings}
        initial={{
          title: "",
          body: "",
          type: "market_observation",
          topic: "",
          offering_slug: offerings[0]?.slug ?? "",
          period: new Date().toISOString().slice(0, 7),
          evidence_type: "anecdotal",
          confidence: "medium",
          sharing_choice: "private",
          attribution_requested: false,
        }}
      />
    </div>
  );
}
