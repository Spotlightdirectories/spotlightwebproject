"use client";

// ===============================================================
// src/lib/useIsMobile.ts
//
// Viewport-width-based mobile detection — NOT user-agent sniffing.
// Best practice for responsive content decisions: what matters is
// how much screen space is actually available, not the device type
// reported by the browser. A resized desktop window and a real
// phone screen have the same underlying problem (not enough room
// for desktop-resolution video), so viewport width handles both
// correctly where user-agent detection would not.
//
// Breakpoint matches the site's existing responsive breakpoint
// (768px) used elsewhere across the codebase.
// ===============================================================

import { useState, useEffect } from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    function check() {
      setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return isMobile;
}
