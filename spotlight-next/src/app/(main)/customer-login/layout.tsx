import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log In | Spotlight",
  description: "Log in to your Spotlight customer account to see your favorite vendors and reviews.",
};

export default function CustomerLoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
