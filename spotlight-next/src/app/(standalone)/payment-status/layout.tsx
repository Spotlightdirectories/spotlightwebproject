import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Payment Under Review | Spotlight",
};

export default function PaymentStatusLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
