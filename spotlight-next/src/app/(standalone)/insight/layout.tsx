import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Business Insights | Spotlight",
  description: "Track your performance, leads and discover opportunities to grow your business on Spotlight Directories.",
};

export default function InsightLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
