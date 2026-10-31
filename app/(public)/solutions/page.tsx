import Link from "next/link";
import { SOLUTIONS } from "@/lib/site-content";

export const metadata = {
  title: "Solutions",
  description: "Azentio solutions by industry.",
};

export default function SolutionsPage() {
  return (
    <div className="container-page py-2xl">
      <h1 className="font-display text-3xl font-semibold">Solutions</h1>
      <p className="mt-sm max-w-3xl text-content-muted">
        Start from the business problem, not the model. Each solution combines decisioning, evidence and oversight for
        a specific segment.
      </p>
      <ul className="mt-xl grid list-none gap-lg md:grid-cols-2">
        {SOLUTIONS.map((solution) => (
          <li key={solution.title} className="card">
            <p className="badge">{solution.industry}</p>
            <h2 className="mt-md font-display text-xl font-semibold">{solution.title}</h2>
            <p className="mt-sm text-sm leading-relaxed text-content-muted">{solution.text}</p>
          </li>
        ))}
      </ul>
      <p className="mt-xl text-sm text-content-muted">
        Want a walkthrough for your segment?{" "}
        <Link href="/connect" className="font-semibold text-accent hover:underline">
          Request a demo
        </Link>
        .
      </p>
    </div>
  );
}
