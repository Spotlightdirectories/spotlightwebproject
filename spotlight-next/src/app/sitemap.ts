// ===============================================================
// src/app/sitemap.ts
//
// Native Next.js sitemap (App Router convention — this file alone
// produces /sitemap.xml automatically, no extra wiring needed).
//
// 2026-08 addition, per Cyril: neither Production nor Staging had a
// sitemap or robots.txt at all before this. Without one, Google has
// to discover every vendor/product/service page purely by crawling
// links, which is slow and incomplete for a directory site — this
// was flagged as the top-priority SEO gap in the audit and Cyril
// asked for it to be built first.
//
// Lists: the core marketing/legal pages, plus every publicly
// listed vendor, product, and service. "Publicly listed" mirrors
// the same filters already used elsewhere in the app (account_status
// = 'active' for vendors — same gate used by search_vendors and the
// Discover page; moderation_status = 'approved' for products/
// services — same gate used everywhere else products/services are
// shown to the public).
// ===============================================================

import type { MetadataRoute } from "next";
import { supabase } from "@/lib/supabase";
import { SITE_URL } from "@/lib/siteUrl";

const STATIC_ROUTES: { path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }[] = [
  { path: "/", changeFrequency: "daily", priority: 1.0 },
  { path: "/discover", changeFrequency: "daily", priority: 0.9 },
  { path: "/getlisted", changeFrequency: "weekly", priority: 0.8 },
  { path: "/getsponsored", changeFrequency: "weekly", priority: 0.6 },
  { path: "/aboutUs", changeFrequency: "monthly", priority: 0.5 },
  { path: "/contact-us", changeFrequency: "monthly", priority: 0.4 },
  { path: "/FAQ", changeFrequency: "monthly", priority: 0.5 },
  { path: "/feedback", changeFrequency: "monthly", priority: 0.3 },
  { path: "/safety", changeFrequency: "monthly", priority: 0.5 },
  { path: "/signup", changeFrequency: "monthly", priority: 0.6 },
  { path: "/partner-program", changeFrequency: "monthly", priority: 0.4 },
  { path: "/partner-legal", changeFrequency: "yearly", priority: 0.2 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.2 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.2 },
  { path: "/disclaimer", changeFrequency: "yearly", priority: 0.2 },
];

// Supabase caps a single request at 1000 rows by default — this stays
// well under that for now. If the directory grows past a few thousand
// vendors, this should be swapped for Next's generateSitemaps() to
// split the output across multiple sitemap files.
const ROW_LIMIT = 1000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map(r => ({
    url: `${SITE_URL}${r.path}`,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  const [{ data: vendors }, { data: products }, { data: services }] = await Promise.all([
    supabase
      .from("vendors")
      .select("slug, created_at")
      .eq("account_status", "active")
      .not("slug", "is", null)
      .limit(ROW_LIMIT),
    supabase
      .from("vendor_products")
      .select("slug, created_at, vendors!inner(slug, account_status)")
      .eq("moderation_status", "approved")
      .eq("vendors.account_status", "active")
      .not("slug", "is", null)
      .limit(ROW_LIMIT),
    supabase
      .from("vendor_services")
      .select("slug, created_at, vendors!inner(slug, account_status)")
      .eq("moderation_status", "approved")
      .eq("vendors.account_status", "active")
      .not("slug", "is", null)
      .limit(ROW_LIMIT),
  ]);

  const vendorEntries: MetadataRoute.Sitemap = (vendors || []).map(v => ({
    url: `${SITE_URL}/vendor/${encodeURIComponent(v.slug as string)}`,
    lastModified: v.created_at ? new Date(v.created_at as string) : undefined,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const productEntries: MetadataRoute.Sitemap = (products || [])
    .filter((p: { vendors: unknown }) => !!p.vendors)
    .map((p: { slug: string; created_at: string | null; vendors: { slug: string } | { slug: string }[] }) => {
      const vendorSlug = Array.isArray(p.vendors) ? p.vendors[0]?.slug : p.vendors.slug;
      return {
        url: `${SITE_URL}/vendor/${encodeURIComponent(vendorSlug)}/product/${encodeURIComponent(p.slug)}`,
        lastModified: p.created_at ? new Date(p.created_at) : undefined,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      };
    });

  const serviceEntries: MetadataRoute.Sitemap = (services || [])
    .filter((s: { vendors: unknown }) => !!s.vendors)
    .map((s: { slug: string; created_at: string | null; vendors: { slug: string } | { slug: string }[] }) => {
      const vendorSlug = Array.isArray(s.vendors) ? s.vendors[0]?.slug : s.vendors.slug;
      return {
        url: `${SITE_URL}/vendor/${encodeURIComponent(vendorSlug)}/service/${encodeURIComponent(s.slug)}`,
        lastModified: s.created_at ? new Date(s.created_at) : undefined,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      };
    });

  return [...staticEntries, ...vendorEntries, ...productEntries, ...serviceEntries];
}
