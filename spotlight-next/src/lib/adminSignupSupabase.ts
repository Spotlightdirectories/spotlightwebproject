// ===============================================================
// src/lib/adminSignupSupabase.ts
//
// A THIRD, separately-isolated Supabase client used only by the
// admin signup page. Ported from admin-signup-supabase-client.js.
//
// WHY THIS EXISTS (kept from the production comment): creating a
// new account via supabase.auth.signUp() automatically logs the
// browser into that brand-new account, in whatever storage that
// client uses. If this page shared adminSupabase.ts's storage key,
// a super_admin already logged in on another tab would have their
// real session silently replaced by the new, roleless signup
// session. Giving signup its own storageKey means creating an
// account here can never touch or replace a session active
// anywhere else in /admin.
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

export const adminSignupSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: "spotlight-admin-signup-session",
  },
});
