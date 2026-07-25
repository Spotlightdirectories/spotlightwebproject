// ===============================================================
// src/app/(main)/layout.tsx
//
// Layout for main site pages — shared Navbar only.
// Each page controls its own <main> wrapper and footer.
// The homepage has its own full branded footer.
// Other pages (vendor profile, product, service) use the shared
// Footer component imported directly in their own layout files.
// ===============================================================

import Navbar from "@/components/Navbar";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <div style={{ paddingTop: "var(--header-height)" }}>
        {children}
      </div>
    </>
  );
}
