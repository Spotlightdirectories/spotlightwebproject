"use client";

import { useEffect, useState } from "react";
import styles from "./LaunchOfferCompact.module.css";

// Compact launch-offer card for the vendor dashboard. 3 free months on any
// yearly plan (new or renewal) paid up to the end of 31 Dec 2026, Lagos time.
// Must match compute_plan_expiry() in the database. Hides itself after the end.
const OFFER_END_MS = new Date("2027-01-01T00:00:00+01:00").getTime();

export default function LaunchOfferCompact({ onUpgrade }: { onUpgrade: () => void }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  const left = now === null ? null : OFFER_END_MS - now;
  if (left !== null && left <= 0) return null;
  const days = left === null ? null : Math.ceil(left / 86400000);

  return (
    <div className={styles.box}>
      <span className={styles.icon}><i className="fa-solid fa-gift"></i></span>
      <div className={styles.text}>
        <p className={styles.kicker}>Launch offer · ends 31 Dec 2026</p>
        <p className={styles.main}>Pay for 12 months, get <b>15</b> — <b>3 months FREE</b> on any yearly plan</p>
        <p className={styles.small}>
          Works for upgrades and renewals · about 40% cheaper per month than paying monthly
          {days !== null ? ` · only ${days} day${days === 1 ? "" : "s"} left` : ""}
        </p>
      </div>
      <button type="button" className={styles.btn} onClick={onUpgrade}>Claim my 3 months</button>
    </div>
  );
}
