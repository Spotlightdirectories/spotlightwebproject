import type { Metadata } from "next";
import { Suspense } from "react";
import GetListedClient from "./GetListedClient";
import { SITE_URL } from "@/lib/siteUrl";

// Bug fix, 2026-08-31 per Cyril (Google Search Console flagged
// "Duplicate without user-selected canonical" — found while checking
// this page after fixing the same issue on discover-results): this
// page's entire content used to live in a "use client" file, which
// can't export metadata at all in Next.js. It had no title override
// and no canonical tag, ever. Both the default view and the
// ?context=upgrade view (used by the dashboard's "Upgrade Plan"
// button) now canonicalize to the same clean base URL, since they're
// the same underlying page, not two separate pages.
export const metadata: Metadata = {
  title: "Get Listed | Spotlight Directories",
  description: "Pick the plan that matches how your business grows — every plan starts with a 90-day free trial, no card required.",
  alternates: {
    canonical: `${SITE_URL}/getlisted`,
  },
};

// useSearchParams() requires a Suspense boundary in Next.js App Router.
export default function GetListedPage() {
  return (
    <Suspense fallback={null}>
      <GetListedClient />
    </Suspense>
  );
}
