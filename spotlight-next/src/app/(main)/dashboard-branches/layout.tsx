import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Manage Branches | Spotlight",
  description: "Add and manage your business locations on Spotlight Directories.",
};

export default function DashboardBranchesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
