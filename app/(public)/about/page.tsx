import { ABOUT_POINTS } from "@/lib/site-content";

export const metadata = {
  title: "About",
  description: "Who Azentio is and how this demo portal works.",
};

export default function AboutPage() {
  return (
    <div className="container-page py-2xl">
      <h1 className="font-display text-3xl font-semibold">About Azentio</h1>
      <div className="mt-xl max-w-3xl space-y-lg">
        {ABOUT_POINTS.map((point) => (
          <section key={point.title} className="card">
            <h2 className="font-semibold">{point.title}</h2>
            <p className="mt-sm text-sm leading-relaxed text-content-muted">{point.text}</p>
          </section>
        ))}
      </div>
      <section className="mt-xl card max-w-3xl">
        <h2 className="font-semibold">Islamic financial institutions</h2>
        <p className="mt-sm text-sm leading-relaxed text-content-muted">
          This collaboration portal is shaped for banks, windows and DFIs that work under Shariah governance. Demo
          copy references <strong>AAOIFI</strong> (accounting and Shariah standards), <strong>IFSB</strong>{" "}
          (prudential and risk principles) and <strong>IIFM</strong> (market documentation practices) as awareness
          context for product owners — never as a certification claim. Product information is indicative and subject
          to validation by your Shariah board and compliance function.
        </p>
      </section>
      <p className="mt-xl text-sm text-content-muted">
        All data in this demo environment is synthetic. Product information is indicative and subject to validation.
      </p>
    </div>
  );
}
