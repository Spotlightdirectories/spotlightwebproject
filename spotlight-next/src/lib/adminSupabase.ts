// ===============================================================
// src/lib/adminSupabase.ts
//
// A SEPARATE, isolated Supabase client for the admin dashboard.
// Ported from admin-supabase-client.js.
//
// WHY A SEPARATE CLIENT: this app also has vendor and customer
// sessions living in the browser (via src/lib/supabase.ts, the
// default storageKey). If an admin staff member is also a vendor,
// or just has another tab open, we don't want one login to silently
// clobber the other's session. Using a distinct storageKey keeps
// the admin session completely isolated from every other session
// in the same browser.
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

export const adminSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: "spotlight-admin-session",
  },
});

// ---------------------------------------------------------------
// admin_session — mirrors production's localStorage.admin_session.
// Set at login, read by the dashboard shell's auth guard, cleared
// on logout. Kept separate from the Supabase auth session itself
// (which lives inside the client above) because the dashboard needs
// the *role* on every page load without an extra round trip.
// ---------------------------------------------------------------
export type AdminRole =
  | "super_admin"
  | "admin"
  | "finance_admin"
  | "verification_admin";

export const ADMIN_ROLES: AdminRole[] = [
  "super_admin",
  "admin",
  "finance_admin",
  "verification_admin",
];

export type AdminSession = {
  user_id: string;
  email: string;
  role: AdminRole;
};

const ADMIN_SESSION_KEY = "admin_session";

export function getAdminSession(): AdminSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdminSession;
    if (!parsed || !ADMIN_ROLES.includes(parsed.role)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setAdminSession(session: AdminSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
}

export function clearAdminSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ADMIN_SESSION_KEY);
}
