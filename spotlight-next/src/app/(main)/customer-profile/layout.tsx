import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Account | Spotlight",
  description: "Manage your favorite vendors and reviews on Spotlight Directories.",
};

export default function CustomerProfileLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
