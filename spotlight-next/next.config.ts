import type { NextConfig } from "next";
import path from "path";

// Content Security Policy, REPORT-ONLY (2026-10-22): the browser only logs what it
// WOULD block (see the console's "Content Security Policy" messages) and blocks
// nothing. Once every page browses clean, rename the header below to
// "Content-Security-Policy" to enforce it.
const isDev = process.env.NODE_ENV !== "production";
const cspReportOnly = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://js.paystack.co https://*.paystack.com https://embed.tawk.to https://*.tawk.to https://cdn.jsdelivr.net/emojione/`,
  "style-src 'self' 'unsafe-inline' https://paystack.com https://*.paystack.com https://cdnjs.cloudflare.com https://fonts.googleapis.com https://*.tawk.to",
  "font-src 'self' data: https://paystack.com https://*.paystack.com https://cdnjs.cloudflare.com https://fonts.gstatic.com https://*.tawk.to",
  "img-src 'self' data: blob: https://*.supabase.co https://ui-avatars.com https://i.ytimg.com https://*.tawk.to https://*.paystack.co https://paystack.com https://*.paystack.com https://www.google.com",
  "media-src 'self' blob: https://*.supabase.co",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.paystack.co https://*.paystack.com https://*.tawk.to wss://*.tawk.to",
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://*.paystack.com https://*.paystack.co https://*.tawk.to",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://*.paystack.com",
  "frame-ancestors 'self'",
].join("; ");

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
  // 2026-10-21 security audit: standard browser protections on every page.
  // Deliberately NO Content-Security-Policy yet: it needs a careful test
  // against maps, videos, fonts and Supabase so it cannot break the site.
  async headers() {
    return [
      {
        // Category pictures: let browsers keep them for a week (changed files get a new name).
        source: "/category-icons/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
        ],
      },
    ];
  },

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
