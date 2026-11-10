"use client";

// CardLink (2026-11-10 speed fix): product, service and vendor cards are
// real links instead of boxes with a click handler.
// - A real link works as soon as it appears, even before the page's code
//   has finished loading.
// - Next.js fetches the destination page in the background while the card
//   is on screen, so the click opens it almost at once.
// - While a page is still opening, a small spinner shows on the card, so
//   the visitor knows the click registered and doesn't keep clicking.
// Buttons inside a card must call e.preventDefault() as well as
// e.stopPropagation(), or the click also opens the card's link.
import Link, { useLinkStatus } from "next/link";
import type { ReactNode } from "react";

function OpeningSpinner() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span className="card-link-opening" aria-hidden="true">
      <i className="fa-solid fa-spinner fa-spin"></i>
    </span>
  );
}

export default function CardLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={`card-link ${className ?? ""}`}>
      {children}
      <OpeningSpinner />
    </Link>
  );
}
