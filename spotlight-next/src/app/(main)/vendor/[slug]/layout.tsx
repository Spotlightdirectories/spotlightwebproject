import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Vendor Profile | Spotlight Directories",
  description: "View this vendor's profile, products, services, and reviews on Spotlight Directories.",
};

export default function VendorProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div style={{ padding: 48, textAlign: "center", color: "var(--color-text-muted)" }}>
        Loading...
      </div>
    }>
      {children}
    </Suspense>
  );
}
