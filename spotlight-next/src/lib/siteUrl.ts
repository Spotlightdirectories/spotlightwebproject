// ===============================================================
// src/lib/siteUrl.ts
//
// Single source of truth for the site's public base URL, used by
// sitemap.ts, robots.ts, and any page that needs to build an
// absolute canonical/OG URL.
//
// Reads NEXT_PUBLIC_SITE_URL from the environment so Staging and
// Production can each point at their own real domain without code
// changes — falls back to the production domain if it's not set,
// since that's the eventual real address either way.
//
// 2026-08 fix: fallback was "www.spotlightdirectories.com", but the
// live domain 301-redirects www -> non-www. Every URL in sitemap.xml
// was therefore sending Googlebot through an unnecessary redirect hop
// on every single crawl, instead of pointing straight at the final
// canonical page (Cyril asked why product/service pages weren't
// showing up in Google search results — this and the missing Search
// Console verification are the two real gaps found investigating it).
//
// 2026-08-20 follow-up: the code fallback above was already correct,
// but Netlify's NEXT_PUBLIC_SITE_URL environment variable was still
// set to the old www version (set 2026-08-02, before this fix landed
// in code), so the live site kept generating www URLs anyway. Fixed
// the Netlify env var directly to the non-www domain — this comment
// update is here specifically to trigger a rebuild that picks it up.
// ===============================================================

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://spotlightdirectories.com").replace(/\/+$/, "");
