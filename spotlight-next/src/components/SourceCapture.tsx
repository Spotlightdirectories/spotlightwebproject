"use client";

// ===============================================================
// SourceCapture — remembers where a visitor first came from.
//
// Saves the FIRST visit's source in the browser (localStorage, same
// place the site already keeps its referral code) for 90 days, so the
// vendor signup page can record it on the vendor's account.
//
// Reads only these from the web address: utm_source, utm_medium,
// utm_campaign. If there are none, it falls back to the website the
// visitor came from (for example facebook.com). It never reads or
// stores personal information. First visit wins; later visits do not
// overwrite it.
// ===============================================================

import { useEffect } from "react";

const KEY = "spotlight_source";
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

function clean(v: string | null): string | null {
  if (!v) return null;
  const s = v.trim().slice(0, 100);
  return /^[A-Za-z0-9._\- ]+$/.test(s) ? s : null;
}

export default function SourceCapture() {
  useEffect(() => {
    try {
      const existing = localStorage.getItem(KEY);
      if (existing) {
        const saved = JSON.parse(existing);
        if (saved?.first_visit_at && Date.now() - new Date(saved.first_visit_at).getTime() < MAX_AGE_MS) {
          return; // first visit already recorded and still fresh
        }
      }

      const params = new URLSearchParams(window.location.search);
      let utm_source = clean(params.get("utm_source"));
      const utm_medium = clean(params.get("utm_medium"));
      const utm_campaign = clean(params.get("utm_campaign"));

      if (!utm_source && document.referrer) {
        try {
          const host = new URL(document.referrer).hostname.replace(/^www\./, "");
          if (host && host !== window.location.hostname.replace(/^www\./, "")) {
            utm_source = clean(host);
          }
        } catch {
          /* ignore bad referrer */
        }
      }

      localStorage.setItem(
        KEY,
        JSON.stringify({
          utm_source,
          utm_medium,
          utm_campaign,
          first_visit_at: new Date().toISOString(),
        })
      );
    } catch {
      /* storage blocked: tracking is simply skipped */
    }
  }, []);

  return null;
}
