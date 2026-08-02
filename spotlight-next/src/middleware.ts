// ===============================================================
// src/middleware.ts
//
// Handles the two old production URLs that next.config.ts's static
// redirects() can't: vendor-product.html?slug=X and
// vendor-service.html?slug=X. Production's URL only carries the
// product/service's OWN slug, not its vendor's — so landing on the
// new nested route (/vendor/:vendorSlug/product/:productSlug) needs
// a database lookup to find which vendor it belongs to. That can't
// happen in next.config.ts (no DB access there), so it happens here
// instead, in middleware, which runs on every matching request
// before the page renders.
//
// If the slug can't be found (bad/old link to a deleted or
// unapproved listing), falls back to /discover rather than a bare
// 404, so the visitor still lands somewhere useful.
// ===============================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const config = {
  matcher: ["/vendor-product.html", "/vendor-service.html"],
};

export async function middleware(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  const fallback = () => NextResponse.redirect(new URL("/discover", req.url), 308);

  if (!slug) return fallback();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return fallback();

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const isProduct = req.nextUrl.pathname === "/vendor-product.html";

  const { data } = await supabase
    .from(isProduct ? "vendor_products" : "vendor_services")
    .select("slug, vendors ( slug )")
    .eq("slug", slug)
    .maybeSingle<{ slug: string; vendors: { slug: string } | null }>();

  const vendorSlug = data?.vendors?.slug;
  if (!data || !vendorSlug) return fallback();

  const destination = isProduct
    ? `/vendor/${encodeURIComponent(vendorSlug)}/product/${encodeURIComponent(data.slug)}`
    : `/vendor/${encodeURIComponent(vendorSlug)}/service/${encodeURIComponent(data.slug)}`;

  return NextResponse.redirect(new URL(destination, req.url), 308);
}
