import type { Metadata } from "next";
import "./partner-dashboard.css";

export const metadata: Metadata = {
  title: "Partner Dashboard | Spotlight Directories",
};

export default function PartnerDashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
