// ===============================================================
// src/app/(standalone)/layout.tsx
//
// Layout for STANDALONE pages — focused, app-like screens that
// bring their own header/navigation and must NOT show the shared
// site Navbar/Footer (discover, discover-results, login, etc.).
// This layout deliberately adds nothing around the page.
// The "(standalone)" folder name (in parentheses) groups these
// pages WITHOUT adding "/standalone" to their URLs.
// ===============================================================

export default function StandaloneLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
