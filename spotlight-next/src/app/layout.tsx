import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Spotlight Directories",
  description:
    "Helping Nigerian and African businesses, artisans, and professionals get found.",
};

// Runs BEFORE the page paints, so a returning dark-mode user never
// sees a flash of light mode. Ported directly from the original
// theme-toggle.js top-of-file IIFE, same "spotlight-theme" key.
const noFlashScript = `
(function () {
  try {
    var saved = localStorage.getItem("spotlight-theme");
    if (saved === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
      </head>
      <body>
        <ThemeProvider>
          <Navbar />
          {/* Push content below the fixed navbar */}
          <main style={{ paddingTop: "var(--header-height)", minHeight: "70vh" }}>
            {children}
          </main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
