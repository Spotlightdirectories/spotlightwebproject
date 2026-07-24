import type { Metadata } from "next";
import { Suspense } from "react";
import DiscoverResults from "./DiscoverResults";

export const metadata: Metadata = {
  title: "Search Results | Spotlight Directories",
  description: "Discover products, services and vendors on Spotlight Directories.",
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
