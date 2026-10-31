import { EnquiryForm } from "@/components/enquiry-form";

export const metadata = {
  title: "Connect",
  description: "Request a product demo or register for the Azentio hackathon.",
};

export default function ConnectPage() {
  return (
    <div className="container-page py-2xl">
      <h1 className="font-display text-3xl font-semibold">Connect</h1>
      <p className="mt-sm max-w-3xl text-content-muted">
        Request a demo of the decisioning products, or register your interest in the hackathon. Both forms submit to
        the demo portal and store the enquiry in the local database.
      </p>

      <div className="mt-xl grid gap-lg lg:grid-cols-2">
        <EnquiryForm kind="demo" />
        <EnquiryForm kind="hackathon" />
      </div>

      <aside className="mt-xl max-w-3xl rounded-card border border-line bg-surface-sunken p-lg text-sm leading-relaxed text-content-muted">
        <p className="font-semibold text-content">This is a demo environment</p>
        <p className="mt-xs">
          All data is synthetic and no email is sent. Nothing on this page constitutes a commercial offer, and product
          information is indicative and subject to validation.
        </p>
      </aside>
    </div>
  );
}
