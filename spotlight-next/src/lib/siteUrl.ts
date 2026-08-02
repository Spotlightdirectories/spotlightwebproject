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
// ===============================================================

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.spotlightdirectories.com").replace(/\/+$/, "");
