import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct } from "@/lib/public-db";

export const dynamic = "force-dynamic";

export default function ProductPage({ params }: { params: { slug: string } }) {
  const product = getProduct(params.slug);
  if (!product) notFound();

  return (
    <div className="container-page py-2xl">
      <Link href="/products" className="text-sm font-semibold text-accent hover:underline">
        Back to products
      </Link>
      <h1 className="mt-md font-display text-3xl font-semibold">{product.name}</h1>
      <p className="mt-sm max-w-3xl text-lg text-content">{product.tagline}</p>
      <p className="mt-md max-w-3xl leading-relaxed text-content-muted">{product.summary}</p>

      <section className="mt-xl card max-w-3xl" aria-labelledby="how-heading">
        <h2 id="how-heading" className="font-semibold">
          How it works in this demo
        </h2>
        <p className="mt-sm text-sm leading-relaxed text-content-muted">
          Every scenario in the collaboration portal runs on a seeded synthetic portfolio. Outputs are labelled
          &ldquo;Synthetic data&rdquo; and &ldquo;Simulated output, not a credit decision&rdquo;, and always end with a
          human approval step. No model training programme is enabled.
        </p>
      </section>

      <p className="mt-lg text-sm text-content-muted">Product information is indicative and subject to validation.</p>
      <div className="mt-lg">
        <Link href="/connect" className="btn-primary">
          Request demo access
        </Link>
      </div>
    </div>
  );
}
