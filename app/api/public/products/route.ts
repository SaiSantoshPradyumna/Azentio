import { NextResponse } from "next/server";
import { listProducts } from "@/lib/public-db";

// Public endpoint (see BUILD_SPEC.md Section 7.4 public list): product catalogue only.
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const products = listProducts().map(({ id, slug, name, tagline, summary }) => ({ id, slug, name, tagline, summary }));
  return NextResponse.json({ products });
}
