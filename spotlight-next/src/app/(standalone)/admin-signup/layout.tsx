import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Staff Signup | Spotlight Directories",
};

export default function AdminSignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
