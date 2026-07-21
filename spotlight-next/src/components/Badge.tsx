// ===============================================================
// src/components/Badge.tsx
//
// Ported from the original badge-utils.js. Renders a vendor's
// verification badge — blue (Verified Business) or gray (Verified
// Identity) — with the same tooltip text and badge images as the
// original site. Any page can drop in <Badge status={...} />.
//
// Requires bluebadge.png and graybadge.png in public/images/.
// ===============================================================

import styles from "./Badge.module.css";

const BADGE_TOOLTIPS = {
  blue: "Verified Business — official business documents reviewed by Spotlight. This vendor operates a registered and credible business.",
  gray: "Verified Identity — business owner identity confirmed",
} as const;

type BadgeStatus = "blue" | "gray" | "none" | string | null | undefined;

export default function Badge({ status }: { status: BadgeStatus }) {
  if (!status) return null;

  const normalized = String(status).toLowerCase();

  if (normalized === "blue") {
    return (
      <span className={styles.badgeWrap} data-tooltip={BADGE_TOOLTIPS.blue}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/bluebadge.png"
          alt="Verified Business"
          className={styles.verificationBadge}
        />
      </span>
    );
  }

  if (normalized === "gray") {
    return (
      <span className={styles.badgeWrap} data-tooltip={BADGE_TOOLTIPS.gray}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/graybadge.png"
          alt="Verified Identity"
          className={styles.verificationBadge}
        />
      </span>
    );
  }

  return null;
}
