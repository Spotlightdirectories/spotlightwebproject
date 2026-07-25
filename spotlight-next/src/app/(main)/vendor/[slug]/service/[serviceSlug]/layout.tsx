import type { Metadata } from "next";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Service Details | Spotlight Directories",
  description: "View service details, pricing, and vendor information on Spotlight Directories.",
};

export default function ServiceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main style={{ minHeight: "70vh" }}>{children}</main>
      <Footer />
    </>
  );
}
