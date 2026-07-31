import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Payment Not Confirmed | Spotlight",
};

export default function PaymentFailedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
