import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Service Details | Spotlight Directories",
  description: "View service details, pricing, and vendor information on Spotlight Directories.",
};

export default function ServiceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
