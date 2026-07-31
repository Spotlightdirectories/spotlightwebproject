import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Verify Your Badge | Spotlight",
  description: "Verify your business to unlock a trust badge on your Spotlight Directories profile.",
};

export default function VerifyBadgeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
