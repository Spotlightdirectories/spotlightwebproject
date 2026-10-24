import type { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import { SITE_URL } from "@/lib/siteUrl";

// Note (2026-08): this route is nested under vendor/[slug]/layout.tsx,
// which already wraps everything in <main> + <Footer/>. This layout
// used to render its own <main>+<Footer/> on top of that, producing
// the double-footer Cyril spotted on product pages. Metadata only now.
const FALLBACK_TITLE = "Product Details | Spotlight Directories";
const FALLBACK_DESCRIPTION = "View product details, pricing, and vendor information on Spotlight Directories.";

// 2026-08 addition, per Cyril's SEO audit request: real product name
// + price + vendor name in the title/description instead of the same
// generic text on every product page.
export async function generateMetadata({ params }: { params: Promise<{ slug: string; productSlug: string }> }): Promise<Metadata> {
  const { slug, productSlug } = await params;
  // One real address per page, so ?slug=... links are not counted as duplicates.
  const alternates = { canonical: `${SITE_URL}/vendor/${slug}/product/${productSlug}` };
  if (!productSlug) return { title: FALLBACK_TITLE, description: FALLBACK_DESCRIPTION, alternates };

  const { data: product } = await supabase
    .from("vendor_products")
    .select("product_name, price, short_description, vendors ( name )")
    .eq("slug", productSlug)
    .maybeSingle<{ product_name: string; price: number | null; short_description: string | null; vendors: { name: string } | null }>();

  if (!product) return { title: FALLBACK_TITLE, description: FALLBACK_DESCRIPTION, alternates };

  const vendorName = product.vendors?.name || "Spotlight Directories";
  const priceBit = product.price != null ? ` — ₦${Number(product.price).toLocaleString()}` : "";
  const title = `${product.product_name}${priceBit} | ${vendorName}`;
  const description = product.short_description
    ? product.short_description.slice(0, 155)
    : `${product.product_name} from ${vendorName} on Spotlight Directories.`;

  return { title, description, alternates };
}

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
