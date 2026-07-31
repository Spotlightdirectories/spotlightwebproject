import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Forgot Password | Spotlight",
  description: "Reset your Spotlight account password.",
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
