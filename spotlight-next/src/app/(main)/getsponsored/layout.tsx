import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sponsor Your Business | Spotlight",
  description: "Boost your business, products, or services to the top of search results on Spotlight Directories.",
};

export default function GetSponsoredLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
