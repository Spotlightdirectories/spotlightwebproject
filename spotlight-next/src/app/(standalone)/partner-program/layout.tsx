import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Partner Programme | Spotlight Directories",
};

export default function PartnerProgramLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
