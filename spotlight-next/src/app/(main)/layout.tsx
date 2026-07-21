// ===============================================================
// src/app/(main)/layout.tsx
//
// Layout for the MAIN site pages — everything that should show the
// shared site Navbar and Footer (homepage, getlisted, vendor
// dashboard, etc.). The route-group folder name "(main)" is in
// parentheses, so it groups these pages WITHOUT adding "/main" to
// their URLs.
// ===============================================================

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <main style={{ paddingTop: "var(--header-height)", minHeight: "70vh" }}>
        {children}
      </main>
      <Footer />
    </>
  );
}
