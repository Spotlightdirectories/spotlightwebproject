import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Discover Vendors | Spotlight Directories",
  description: "Search and discover products, services, and vendors near you on Spotlight Directories.",
};

export default function DiscoverLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
