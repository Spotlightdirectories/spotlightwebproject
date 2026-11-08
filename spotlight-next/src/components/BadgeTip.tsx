"use client";

// ===============================================================
// src/components/BadgeTip.tsx
//
// One shared tooltip for the verified badges and the 1KF badge.
// Desktop: shows on hover. Phone/tablet: shows when tapped, closes
// when tapped elsewhere. A neat wrapped rectangle (not one long row):
//   light theme -> black box, white text
//   dark theme  -> off-white box, dark gray text
// ===============================================================

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./BadgeTip.module.css";

export const BADGE_TIPS = {
  blue: {
    title: "Verified Business",
    body: "Official business documents reviewed by Spotlight. This vendor operates a registered and credible business.",
  },
  gray: {
    title: "Verified Identity",
    body: "Business owner identity confirmed.",
  },
  founder: {
    title: "Founders 1000",
    body: "One of the first 1,000 vendors to join Spotlight Directories.",
  },
} as const;

export default function BadgeTip({
  kind, children,
}: { kind: keyof typeof BADGE_TIPS; children: ReactNode }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [pinned, setPinned] = useState(false); // opened by tap/click
  const ref = useRef<HTMLSpanElement>(null);
  const tip = BADGE_TIPS[kind];

  function place() {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const half = 110;
    const x = Math.min(Math.max(r.left + r.width / 2, half + 8), window.innerWidth - half - 8);
    setPos({ x, y: r.top });
  }

  useEffect(() => {
    if (!pinned) return;
    const close = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setPinned(false); setPos(null); }
    };
    document.addEventListener("click", close);
    document.addEventListener("touchstart", close);
    window.addEventListener("scroll", () => { setPinned(false); setPos(null); }, { once: true, passive: true });
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("touchstart", close);
    };
  }, [pinned]);

  return (
    <span
      ref={ref}
      className={styles.wrap}
      onMouseEnter={place}
      onMouseLeave={() => { if (!pinned) setPos(null); }}
      onClick={(e) => {
        e.stopPropagation();
        if (pinned) { setPinned(false); setPos(null); } else { place(); setPinned(true); }
      }}
    >
      {children}
      {pos && typeof document !== "undefined" && createPortal(
        <span
          role="tooltip"
          className={styles.tip}
          style={{ left: pos.x, top: pos.y }}
        >
          <strong>{tip.title}</strong>
          <span>{tip.body}</span>
        </span>,
        document.body
      )}
    </span>
  );
}
