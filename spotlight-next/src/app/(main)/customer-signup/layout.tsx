import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Customer Account | Spotlight",
  description: "Save your favorite vendors and manage your reviews in one place on Spotlight Directories.",
};

export default function CustomerSignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
