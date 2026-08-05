import type { Metadata } from "next";
import { Suspense } from "react";
import Footer from "@/components/Footer";
import { supabase } from "@/lib/supabase";

const FALLBACK_TITLE = "Vendor Profile | Spotlight Directories";
const FALLBACK_DESCRIPTION = "View this vendor's profile, products, services, and reviews on Spotlight Directories.";

// 2026-08 addition, per Cyril's SEO audit request: this used to be a
// single static title/description for every vendor on the platform.
// Pulls the real vendor's name/category/description so each vendor's
// page gets its own title in search results and when shared — the
// old vanilla-JS production site could never do this since it was
// static HTML with no server-side data fetch.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (!slug) return { title: FALLBACK_TITLE, description: FALLBACK_DESCRIPTION };

  const { data: vendor } = await supabase
    .from("vendors")
    .select("name, category, subcategory, state, description")
    .eq("slug", slug)
    .maybeSingle();

  if (!vendor) return { title: FALLBACK_TITLE, description: FALLBACK_DESCRIPTION };

  const locationBit = vendor.state ? ` in ${vendor.state}` : "";
  const categoryBit = vendor.subcategory || vendor.category || "business";
  const title = `${vendor.name} | ${categoryBit} on Spotlight Directories`;
  const description = vendor.description
    ? vendor.description.slice(0, 155)
    : `${vendor.name} — ${categoryBit}${locationBit}. Find contact details, products, services, and reviews on Spotlight Directories.`;

  return { title, description };
}

export default function VendorProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div style={{ padding: 48, textAlign: "center", color: "var(--color-text-muted)" }}>
        Loading...
      </div>
    }>
      {/*
        2026-08 fix, per Cyril: the footer used to sit at a fixed
        70vh down the page. On the brief "Loading..." placeholder
        (and on any page shorter than the viewport), that left a gap
        between the footer and the true bottom of the screen — the
        footer looked like it was floating, then "dropped" down once
        the real content loaded and pushed it further. Flex column +
        `flex: 1` on <main> makes the footer always sit flush against
        the bottom of the viewport (short content) or the bottom of
        the content (tall content), with no visible jump either way.
      */}
      <div style={{ display: "flex", flexDirection: "column", minHeight: "calc(100vh - var(--header-height))" }}>
        <main style={{ flex: 1 }}>
          {children}
        </main>
        <Footer />
      </div>
    </Suspense>
  );
}
