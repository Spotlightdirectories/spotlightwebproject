import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Partner Resources | Spotlight Directories",
};

export default function PartnerLegalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
