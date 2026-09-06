import type { Metadata } from "next";
import { Suspense } from "react";
import DiscoverResults from "./DiscoverResults";
import { SITE_URL } from "@/lib/siteUrl";

// Bug fix, 2026-08-31 per Cyril (Google Search Console flagged
// "Duplicate without user-selected canonical"): this single page
// renders every possible combination of query params we built this
// session (category, subcategory, audience, subgroup, keyword, state,
// lga, verified, page, etc.) -- meaning Google was crawling
// potentially thousands of near-identical URLs with no signal for
// which one is the "real" page. All of them are just different views
// of the same search tool, not separate pages, so they all now
// canonicalize back to the same clean, unparameterized URL.
export const metadata: Metadata = {
  title: "Search Results | Spotlight Directories",
  description: "Discover products, services and vendors on Spotlight Directories.",
  alternates: {
    canonical: `${SITE_URL}/discover-results`,
  },
};

// useSearchParams() requires a Suspense boundary in Next.js App Router.
// This wrapper provides it so the discover-results page can safely
// read URL params without a build error.
export default function DiscoverResultsPage() {
  return (
    <Suspense fallback={
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        fontFamily: "Arial, sans-serif",
      }}>
        <p style={{ color: "#64748b" }}>Loading results...</p>
      </div>
    }>
      <DiscoverResults />
    </Suspense>
  );
}
