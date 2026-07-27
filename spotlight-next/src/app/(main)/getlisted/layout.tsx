import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Get Listed | Vendor Pricing & Plans | Spotlight Directories",
  description: "Choose the right vendor listing plan on Spotlight Directories. Compare pricing tiers and get your business listed to reach more customers.",
};

export default function GetListedLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div style={{ padding: 48, textAlign: "center", color: "var(--color-text-muted)" }}>
        Loading plans...
      </div>
    }>
      {children}
    </Suspense>
  );
}
