import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import TawkChat from "@/components/TawkChat";
import CookieConsent from "@/components/CookieConsent";
import { SITE_URL } from "@/lib/siteUrl";

export const metadata: Metadata = {
  // Was missing entirely. Without it, Next.js can't resolve relative
  // Open Graph/canonical URLs to absolute ones reliably, which is
  // exactly the kind of thing that makes Google less confident about
  // which URL is the "real" one for a page (Cyril, 2026-08 — asked
  // why product/service pages weren't turning up in Google search).
  metadataBase: new URL(SITE_URL),
  title: "Spotlight Directories",
  description:
    "Helping Nigerian and African businesses, artisans, and professionals get found.",
  icons: {
    icon: [
      { url: "/images/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/images/favicon-64.png", sizes: "64x64", type: "image/png" },
    ],
    apple: "/images/favicon-180.png",
  },
};

// Runs BEFORE the page paints, so a returning dark-mode user never
// sees a flash of light mode. Ported from the original theme-toggle.js.
//
// UPDATED 2026-08-01: on a visitor's FIRST visit (nothing saved yet in
// localStorage), this now follows the device/browser's own dark-mode
// setting (prefers-color-scheme) instead of always defaulting to
// light. Once someone uses the sun/moon toggle in the navbar, their
// manual choice is saved and always wins from then on, regardless of
// what their device is set to.
const noFlashScript = `
(function () {
  try {
    var saved = localStorage.getItem("spotlight-theme");
    var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (saved === "dark" || (!saved && prefersDark)) {
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
        {/* FontAwesome — used by ported pages (discover, etc.) for icons */}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
        />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
        <TawkChat />
        <CookieConsent />
      </body>
    </html>
  );
}
