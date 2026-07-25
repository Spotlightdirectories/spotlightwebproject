import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vendor Login | Spotlight Directories",
  description: "Log in to manage your vendor profile, uploads, and subscriptions on Spotlight.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
