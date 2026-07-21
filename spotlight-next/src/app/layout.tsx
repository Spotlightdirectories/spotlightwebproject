import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
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
        {/* FontAwesome — used by ported pages (discover, etc.) for icons */}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
        />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
