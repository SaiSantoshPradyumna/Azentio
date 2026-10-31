import Link from "next/link";
import { getPublicContentBlock, listProducts } from "@/lib/public-db";
import { CAPABILITIES, TRUST_ITEMS } from "@/lib/site-content";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const banner = getPublicContentBlock("home.banner");
  const featured = listProducts();

  return (
    <>
      <section className="container-page py-2xl text-center">
        <p className="badge mx-auto">Synthetic demo environment</p>
        <h1 className="mt-md font-display text-4xl font-semibold leading-tight md:text-5xl">
          Build Intelligence. Create Impact.
        </h1>
        <p className="mx-auto mt-lg max-w-3xl text-lg text-content-muted">
          From ideas to intelligent products. From complexity to clarity. From AI potential to meaningful outcomes.
        </p>
        <p className="mx-auto mt-md max-w-3xl text-base text-content-muted">{banner}</p>
        <div className="mt-xl flex flex-wrap justify-center gap-md">
          <Link href="/connect" className="btn-primary">
            Request Demo
          </Link>
          <Link href="/products" className="btn-secondary">
            Explore products
          </Link>
        </div>
      </section>

      <section className="container-page py-xl" aria-labelledby="capabilities-heading">
        <h2 id="capabilities-heading" className="font-display text-2xl font-semibold">
          What Azentio does
        </h2>
        <ul className="mt-lg grid list-none gap-lg md:grid-cols-2 xl:grid-cols-3">
          {CAPABILITIES.map((capability) => (
            <li key={capability.title} className="card">
              <h3 className="font-semibold">{capability.title}</h3>
              <p className="mt-sm text-sm leading-relaxed text-content-muted">{capability.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-surface-sunken py-xl" aria-labelledby="products-heading">
        <div className="container-page">
          <div className="flex flex-wrap items-end justify-between gap-md">
            <h2 id="products-heading" className="font-display text-2xl font-semibold">
              Featured products
            </h2>
            <Link href="/products" className="text-sm font-semibold text-accent hover:underline">
              View all products
            </Link>
          </div>
          <ul className="mt-lg grid list-none gap-lg md:grid-cols-2">
            {featured.map((product) => (
              <li key={product.slug} className="card">
                <h3 className="font-semibold">{product.name}</h3>
                <p className="mt-xs text-sm text-content">{product.tagline}</p>
                <Link
                  href={`/products/${product.slug}`}
                  className="mt-md inline-block text-sm font-semibold text-accent hover:underline"
                >
                  Learn more
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container-page py-xl" aria-labelledby="trust-heading">
        <h2 id="trust-heading" className="font-display text-2xl font-semibold">
          Trust by design
        </h2>
        <ul className="mt-lg grid list-none gap-lg md:grid-cols-2 xl:grid-cols-3">
          {TRUST_ITEMS.map((item) => (
            <li key={item.title} className="rounded-card border border-line bg-surface-raised p-md">
              <h3 className="text-sm font-semibold">{item.title}</h3>
              <p className="mt-xs text-sm leading-relaxed text-content-muted">{item.text}</p>
            </li>
          ))}
        </ul>
        <p className="mt-lg text-sm text-content-muted">
          No training programme is enabled. Shared learning is de-identified and moderator-reviewed.
        </p>
      </section>
    </>
  );
}
