import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leave a Recommendation | Spotlight",
  description: "Submit a verified recommendation for a Spotlight Directories vendor.",
};

export default function RecommendLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
