// ===============================================================
// src/lib/partnerSupabase.ts
//
// A SEPARATE, isolated Supabase client for the partner-facing pages
// (partner-program, partner-create-account, partner-dashboard).
//
// WHY A SEPARATE CLIENT: production's partner pages all shared the
// exact same Supabase client/storage key as vendor and customer
// pages (confirmed by reading supabase-client.js) — meaning a person
// who is both a vendor and a partner could have one session silently
// clobber the other in the same browser. Cyril confirmed (2026-08)
// this should be isolated going forward, mirroring the same fix
// already applied for admin (see src/lib/adminSupabase.ts).
// ===============================================================

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Check .env.local for " +
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
  );
}

export const partnerSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: "spotlight-partner-session",
  },
});

// ---------------------------------------------------------------
// partner_session — same pattern as admin_session: a small cached
// object set at login/account-creation, read by the dashboard's
// auth guard so it doesn't need an extra round trip to look up the
// partner's own id/name/referral_code on every page load.
// ---------------------------------------------------------------
export type PartnerSession = {
  user_id: string;
  partner_id: string;
  name: string;
  email: string;
  referral_code: string | null;
};

const PARTNER_SESSION_KEY = "partner_session";

export function getPartnerSession(): PartnerSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PARTNER_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PartnerSession;
    if (!parsed || !parsed.partner_id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setPartnerSession(session: PartnerSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PARTNER_SESSION_KEY, JSON.stringify(session));
}

export function clearPartnerSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PARTNER_SESSION_KEY);
}
