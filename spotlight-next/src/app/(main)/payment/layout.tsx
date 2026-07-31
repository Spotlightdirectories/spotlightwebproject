import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Payment | Spotlight",
  description: "Complete your Spotlight Directories vendor subscription payment.",
};

export default function PaymentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
