"use client";

// ===============================================================
// src/components/PromoBanner.tsx
//
// The fly-in promotional banner, locked 2026-08-23 per Cyril:
// - Shows on EVERY visit (no interval, no "once ever" -- every time
//   someone lands on the homepage, unless they've dismissed it).
// - "Don't show again" permanently dismisses it for THIS BROWSER
//   only (localStorage) -- naturally resets on a different browser,
//   device, or cleared data, exactly as agreed.
// - The small X just closes it for this one visit -- it'll show
//   again next time, same as Wetinuneed's own version of this.
// - Content, copy, and contact block are all word-for-word what was
//   locked -- nothing invented here.
// ===============================================================

import { useState, useEffect } from "react";
import styles from "./PromoBanner.module.css";

const DISMISS_KEY = "spotlight_promo_dismissed";

export default function PromoBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (!dismissed) setVisible(true);
  }, []);

  function handleClose() {
    setVisible(false);
  }

  function handleDontShowAgain() {
    localStorage.setItem(DISMISS_KEY, "true");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.banner} onClick={(e) => e.stopPropagation()}>
        <button type="button" className={styles.closeBtn} aria-label="Close" onClick={handleClose}>
          <i className="fa-solid fa-xmark"></i>
        </button>

        <h2 className={styles.heading}>Put Your Business on the SPOTLIGHT for Nigerians</h2>

        <ul className={styles.bullets}>
          <li><i className="fa-solid fa-arrow-right"></i> Get Discovered by thousands searching</li>
          <li><i className="fa-solid fa-arrow-right"></i> Improve Your Visibility</li>
          <li><i className="fa-solid fa-arrow-right"></i> Increase Your Credibility and Trust</li>
          <li><i className="fa-solid fa-arrow-right"></i> Let people know and see what you sell</li>
        </ul>

        <p className={styles.itsFree}>It&apos;s free.</p>

        <a href="/getlisted" className={styles.ctaBtn} onClick={handleClose}>
          List Your Business Today
        </a>

        <div className={styles.contactBlock}>
          <p className={styles.contactHeading}>Ready to be seen?</p>
          <a href="https://wa.me/2349012085744" target="_blank" rel="noopener noreferrer" className={styles.contactLine}>
            <i className="fa-brands fa-whatsapp"></i> 0901 208 5744 <span className={styles.waOnly}>(WhatsApp Only)</span>
          </a>
          <a href="mailto:support@spotlightdirectories.com" className={styles.contactLine}>
            <i className="fa-solid fa-envelope"></i> support@spotlightdirectories.com
          </a>
        </div>

        <button type="button" className={styles.dontShowBtn} onClick={handleDontShowAgain}>
          Don&apos;t show again
        </button>
      </div>
    </div>
  );
}
