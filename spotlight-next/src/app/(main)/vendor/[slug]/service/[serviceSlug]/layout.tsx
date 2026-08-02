import type { Metadata } from "next";
import { supabase } from "@/lib/supabase";

// Note (2026-08): this route is nested under vendor/[slug]/layout.tsx,
// which already wraps everything in <main> + <Footer/>. This layout
// used to render its own <main>+<Footer/> on top of that, producing
// the double-footer Cyril spotted on service pages. Metadata only now.
const FALLBACK_TITLE = "Service Details | Spotlight Directories";
const FALLBACK_DESCRIPTION = "View service details, pricing, and vendor information on Spotlight Directories.";

// 2026-08 addition, per Cyril's SEO audit request: real service name
// + starting price + vendor name in the title/description instead of
// the same generic text on every service page.
export async function generateMetadata({ params }: { params: Promise<{ serviceSlug: string }> }): Promise<Metadata> {
  const { serviceSlug } = await params;
  if (!serviceSlug) return { title: FALLBACK_TITLE, description: FALLBACK_DESCRIPTION };

  const { data: service } = await supabase
    .from("vendor_services")
    .select("service_name, starting_price, short_description, vendors ( name )")
    .eq("slug", serviceSlug)
    .maybeSingle<{ service_name: string; starting_price: number | null; short_description: string | null; vendors: { name: string } | null }>();

  if (!service) return { title: FALLBACK_TITLE, description: FALLBACK_DESCRIPTION };

  const vendorName = service.vendors?.name || "Spotlight Directories";
  const priceBit = service.starting_price != null ? ` — from ₦${Number(service.starting_price).toLocaleString()}` : "";
  const title = `${service.service_name}${priceBit} | ${vendorName}`;
  const description = service.short_description
    ? service.short_description.slice(0, 155)
    : `${service.service_name} from ${vendorName} on Spotlight Directories.`;

  return { title, description };
}

export default function ServiceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
