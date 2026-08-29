"use client";

// ===============================================================
// src/components/TawkChat.tsx
//
// Ports production's Tawk.to support-chat widget into Next.js.
// Same widget ID as production (index.html, discover.html,
// vendor-profile.html, vendor-product.html, vendor-service.html,
// discover-results.html, getListed.html all embed the exact same
// script) — one shared Tawk.to inbox, not a per-vendor chat tool.
//
// Production loads/unloads the <script> tag per static HTML page,
// which naturally scopes it to certain pages. Next.js is a single
// long-lived app shell, so instead this loads the script ONCE in
// the root layout and uses Tawk's own documented
// hideWidget()/showWidget() API to match production's page scope
// as the user navigates client-side — homepage, Discover (+
// results), every vendor/product/service page, and Get Listed.
// Hidden everywhere else (dashboards, auth, admin, payment flows),
// matching what production actually does.
//
// COOKIE CONSENT (added 2026-08): Tawk.to is the one non-essential
// cookie source on the site (Paystack's checkout cookies are
// strictly necessary and aren't gated). If the visitor has already
// declined via the CookieConsent banner, the script never loads at
// all. If they decline mid-session, we hide the widget immediately.
// If they accept (either up front or after having declined), the
// script loads/the widget reappears — no page reload needed.
// ===============================================================

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { COOKIE_CONSENT_KEY, COOKIE_CONSENT_EVENT } from "./CookieConsent";

declare global {
  interface Window {
    Tawk_API?: {
      hideWidget?: () => void;
      showWidget?: () => void;
      minimize?: () => void;
      onLoad?: () => void;
    };
  }
}

function isTawkPage(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname.startsWith("/discover")) return true; // covers /discover and /discover-results
  if (pathname.startsWith("/vendor/")) return true; // covers profile, product, and service pages
  if (pathname.startsWith("/getlisted")) return true;
  return false;
}

export default function TawkChat() {
  const pathname = usePathname();
  // null = still checking localStorage; avoids a flash where the
  // script briefly loads for a visitor who already declined.
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setAllowed(localStorage.getItem(COOKIE_CONSENT_KEY) !== "declined");
    } catch {
      setAllowed(true);
    }

    const handleConsentChange = (e: Event) => {
      const value = (e as CustomEvent<string>).detail;
      if (value === "declined") {
        window.Tawk_API?.hideWidget?.();
        setAllowed(false);
      } else if (value === "accepted") {
        setAllowed(true);
      }
    };
    window.addEventListener(COOKIE_CONSENT_EVENT, handleConsentChange);
    return () =>
      window.removeEventListener(COOKIE_CONSENT_EVENT, handleConsentChange);
  }, []);

  useEffect(() => {
    if (!allowed) return;

    const applyVisibility = () => {
      const api = window.Tawk_API;
      if (!api) return;
      if (isTawkPage(pathname)) {
        api.showWidget?.();
      } else {
        api.hideWidget?.();
      }
    };

    // If Tawk has already finished loading (e.g. navigating between
    // pages after the first load), just re-check visibility now.
    // Otherwise wait for its onLoad callback so we don't call methods
    // on a widget that isn't ready yet.
    if (window.Tawk_API?.hideWidget) {
      applyVisibility();
    } else {
      window.Tawk_API = window.Tawk_API || {};
      window.Tawk_API.onLoad = () => {
        applyVisibility();
        // Bug fix, 2026-08-23 per Cyril: the widget was popping open
        // to a full chat window covering much of the page on its own,
        // unprompted -- most likely a proactive/auto-chat trigger set
        // in Tawk.to's own dashboard (Administration > Chat Widget >
        // Behavior), which lives outside this codebase entirely. This
        // forces it back to just the small icon the instant it loads
        // on every page, regardless of any such dashboard trigger --
        // it never stops someone from clicking the icon to open it
        // themselves afterward.
        window.Tawk_API?.minimize?.();
      };
    }
  }, [pathname, allowed]);

  if (!allowed) return null;

  return (
    <Script id="tawk-to-widget" strategy="afterInteractive">
      {`
        var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();
        (function(){
        var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
        s1.async=true;
        s1.src='https://embed.tawk.to/6a5b6743f97a4e1d45887656/1jtqgmomk';
        s1.charset='UTF-8';
        s1.setAttribute('crossorigin','*');
        s0.parentNode.insertBefore(s1,s0);
        })();
      `}
    </Script>
  );
}
