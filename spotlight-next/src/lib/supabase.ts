// ===============================================================
// src/lib/supabase.ts
//
// The single shared Supabase client for the whole app.
// Ported from the original supabase-client.js, but structured
// the Next.js way: one module that every page/component imports
// from, instead of a global loaded via <script> on each page.
//
// Credentials are read from environment variables (.env.local),
// NOT hardcoded — this is the standard, safer Next.js pattern and
// lets Staging vs Production use different values without editing
// code. The values themselves live in .env.local (git-ignored).
// ===============================================================

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fails loudly during development if env vars are missing,
  // rather than silently connecting to nothing.
  throw new Error(
    "Missing Supabase environment variables. Check .env.local for " +
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
