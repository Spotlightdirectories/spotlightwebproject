"use client";

// ===============================================================
// src/components/CookieConsent.tsx
//
// Simple cookie-notice banner shown once per browser (until the
// visitor makes a choice). Spotlight itself doesn't set tracking
// cookies — theme preference and the login session both live in
// localStorage, not cookies. The two cookie sources on the site
// are third-party embeds: Tawk.to (live chat) and Paystack
// (payment checkout). Paystack's are strictly necessary to
// complete a payment the visitor themselves initiates, so they
// aren't gated here. Tawk.to is the one non-essential cookie
// source, so "Decline" tells TawkChat.tsx not to load it.
//
// Choice is stored in localStorage under "spotlight-cookie-consent"
// ("accepted" | "declined"). A "spotlight-cookie-consent-changed"
// window event is dispatched on every choice so TawkChat (already
// mounted in the root layout) can react immediately without a
// page reload.
// ===============================================================

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./CookieConsent.module.css";

export const COOKIE_CONSENT_KEY = "spotlight-cookie-consent";
export const COOKIE_CONSENT_EVENT = "spotlight-cookie-consent-changed";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(COOKIE_CONSENT_KEY);
      if (!saved) setVisible(true);
    } catch {
      // localStorage unavailable (e.g. blocked) — just skip the banner
    }
  }, []);

  const choose = (value: "accepted" | "declined") => {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, value);
    } catch {
      // ignore — worst case the banner reappears next visit
    }
    window.dispatchEvent(
      new CustomEvent(COOKIE_CONSENT_EVENT, { detail: value })
    );
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className={styles.banner} role="region" aria-label="Cookie notice">
      <p className={styles.text}>
        We use cookies to run essential features like secure checkout
        (Paystack) and live chat support (Tawk.to). We don&apos;t use
        cookies for advertising or tracking.{" "}
        <Link href="/privacy" className={styles.link}>
          Read our Privacy Policy
        </Link>
        .
      </p>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.decline}
          onClick={() => choose("declined")}
        >
          Decline
        </button>
        <button
          type="button"
          className={styles.accept}
          onClick={() => choose("accepted")}
        >
          Accept
        </button>
      </div>
    </div>
  );
}
