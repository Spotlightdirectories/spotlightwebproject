import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reset Password | Spotlight",
  description: "Choose a new password for your Spotlight account.",
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
