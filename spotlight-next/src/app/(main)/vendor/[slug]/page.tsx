// ===============================================================
// src/app/(main)/vendor/[slug]/page.tsx
//
// 2026-11 speed fix: this is now a thin server page. It gathers the
// vendor's public information on the server (close to the database)
// and hands it to the existing interactive profile
// (VendorProfileClient.tsx), so visitors get a filled-in page in one
// trip instead of an empty page followed by about 8 database calls.
// The owner's editing tools, reviews, favourites etc. all still work
// in the browser exactly as before.
//
// Public pages are kept for 60 seconds, so a vendor's edit may take
// up to a minute to show to visitors. The owner always sees fresh data.
// ===============================================================

import VendorProfileClient from "./VendorProfileClient";
import { loadVendorProfileData } from "@/lib/vendorProfileData";

export const revalidate = 60;

export default async function VendorProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const initial = await loadVendorProfileData(slug);
  return <VendorProfileClient initial={initial} />;
}
