import Link from "next/link";
import { listProducts } from "@/lib/public-db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Products",
  description: "Azentio product portfolio for financial services intelligence.",
};

export default function ProductsPage() {
  const products = listProducts();
  return (
    <div className="container-page py-2xl">
      <h1 className="font-display text-3xl font-semibold">Products</h1>
      <p className="mt-sm max-w-3xl text-content-muted">
        Four products covering credit decisioning, portfolio comparison and reporting intelligence. Product
        information is indicative and subject to validation.
      </p>
      <ul className="mt-xl grid list-none gap-lg md:grid-cols-2">
        {products.map((product) => (
          <li key={product.slug} className="card">
            <h2 className="font-display text-xl font-semibold">{product.name}</h2>
            <p className="mt-sm text-sm text-content">{product.tagline}</p>
            <p className="mt-sm text-sm leading-relaxed text-content-muted">{product.summary}</p>
            <div className="mt-md">
              <Link href={`/products/${product.slug}`} className="text-sm font-semibold text-accent hover:underline">
                Product details
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
