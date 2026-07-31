// Route-scoped layout for the admin dashboard.
// Imports the admin stylesheet here so its global "adm-" class names
// only load while this route is active — same pattern as
// vendordashboard/layout.tsx. No shared navbar/footer: the dashboard
// brings its own header + sidebar.

import type { Metadata } from "next";
import "./admin.css";

export const metadata: Metadata = {
  title: "Admin Dashboard | Spotlight Directories",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
