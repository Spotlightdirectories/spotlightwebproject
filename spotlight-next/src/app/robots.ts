// ===============================================================
// src/app/robots.ts
//
// Native Next.js robots.txt (App Router convention — this file
// alone produces /robots.txt automatically). Points crawlers at the
// new sitemap.ts and keeps them out of logged-in-only areas
// (dashboards, auth flows, admin, payment pages) that have no value
// being indexed and shouldn't show up in search results anyway.
// ===============================================================

import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteUrl";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/vendordashboard",
        "/customer-profile",
        "/partner-dashboard",
        "/admin",
        "/admin-login",
        "/admin-signup",
        "/login",
        "/customer-login",
        "/customer-signup",
        "/forgot-password",
        "/reset-password",
        "/verify-email",
        "/verify-badge",
        "/payment",
        "/payment-status",
        "/payment-failed",
        "/business-type",
        "/dashboard-branches",
        "/insight",
        "/partner-create-account",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
