import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Pin the workspace root to THIS folder, so Next.js doesn't get confused
  // by a stray package-lock.json sitting higher up in C:\Users\Dell.
  turbopack: {
    root: path.join(__dirname),
  },

  // 2026-08 addition, per Cyril's production-cutover request: production
  // is static HTML with .html URLs (and vendor-profile.html?slug=X for
  // vendor pages), while this site uses clean Next.js routes. Without
  // these, every old bookmarked/shared/indexed link would 404 once this
  // site goes live at the real domain — these preserve them as 308
  // permanent redirects (good for SEO — passes on any existing ranking).
  //
  // NOT covered here: vendor-product.html?slug=X and
  // vendor-service.html?slug=X. Those need a database lookup (the vendor
  // slug isn't in the old URL, only the product/service slug) — handled
  // in middleware.ts instead, since redirects() here can only do static
  // path rewriting, not a Supabase query. The catch-all rule below
  // explicitly excludes both so middleware gets a chance to run instead
  // of this file rewriting them to a dead /vendor-product or
  // /vendor-service path first.
  async redirects() {
    return [
      {
        source: "/vendor-profile.html",
        has: [{ type: "query", key: "slug", value: "(?<slug>.*)" }],
        destination: "/vendor/:slug",
        permanent: true,
      },
      { source: "/getListed.html", destination: "/getlisted", permanent: true },
      { source: "/getlisted-legacy.html", destination: "/getlisted", permanent: true },
      { source: "/index.html", destination: "/", permanent: true },
      { source: "/index-legacy.html", destination: "/", permanent: true },
      { source: "/discover-results-legacy.html", destination: "/discover-results", permanent: true },
      { source: "/vendor-product-legacy.html", destination: "/discover", permanent: true },
      { source: "/vendor-service-legacy.html", destination: "/discover", permanent: true },
      { source: "/partner-program-legacy.html", destination: "/partner-program", permanent: true },
      { source: "/partner-legal-legacy.html", destination: "/partner-legal", permanent: true },
      { source: "/verify-phone-legacy.html", destination: "/", permanent: true },
      { source: "/admin/admin-payments.html", destination: "/admin", permanent: true },
      { source: "/admin/verify-payments.html", destination: "/admin", permanent: true },
      { source: "/admin/partner-dashboard.html", destination: "/admin", permanent: true },
      // Catch-all: any remaining page that kept the same name (aboutUs,
      // contact-us, FAQ, feedback, disclaimer, terms, privacy, signup,
      // login, discover, insight, etc.) just needs the .html dropped.
      // Excludes vendor-product.html / vendor-service.html so those fall
      // through to middleware.ts instead.
      { source: "/:path((?!vendor-product|vendor-service).*).html", destination: "/:path", permanent: true },
    ];
  },
};

export default nextConfig;
