import type { Metadata } from "next";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Product Details | Spotlight Directories",
  description: "View product details, pricing, and vendor information on Spotlight Directories.",
};

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main style={{ minHeight: "70vh" }}>{children}</main>
      <Footer />
    </>
  );
}
