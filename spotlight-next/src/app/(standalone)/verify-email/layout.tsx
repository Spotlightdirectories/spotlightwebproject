import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Email Verification | Spotlight",
  description: "Verify your email address for your Spotlight vendor account.",
};

export default function VerifyEmailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
