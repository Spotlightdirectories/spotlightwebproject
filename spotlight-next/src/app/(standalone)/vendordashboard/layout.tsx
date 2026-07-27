// Route-scoped layout for the vendor dashboard.
// Imports the dashboard stylesheet here so its global class names
// only load while this route is active. No shared navbar/footer —
// the dashboard brings its own sidebar and header.

import type { Metadata } from "next";
import "./vendordashboard.css";

export const metadata: Metadata = {
  title: "Vendor Dashboard | Spotlight Directories",
};

export default function VendorDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
