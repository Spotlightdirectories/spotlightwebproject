// admin-signup-supabase-client.js
// A SEPARATE, isolated Supabase client just for the signup page.
//
// WHY THIS EXISTS: admin-signup.html used to load the same
// admin-supabase-client.js as every other admin page. That client
// uses one shared browser storage key for "whoever is logged in."
// The problem: creating a new account via supabase.auth.signUp()
// automatically logs the browser into that brand-new account —
// in that same shared storage. If a super_admin was already logged
// in on another admin page in the same browser, that silently
// replaced their real session with the new, roleless account's
// session, with no visible warning.
//
// Fix: this page gets its own storage key, completely separate from
// "spotlight-admin-session". Creating an account here can never
// touch or replace a session that's active anywhere else in /admin/.
const SIGNUP_SUPABASE_URL = "https://gyvzmktavyrevfxnwsay.supabase.co";
const SIGNUP_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dnpta3RhdnlyZXZmeG53c2F5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NjIyNzUsImV4cCI6MjA3NjUzODI3NX0.a5LnkYZb6IlTd2PEwD-M-Cw-hQSC8lKSU1uOEjgwjRo";

window.supabaseClient = window.supabase.createClient(
  SIGNUP_SUPABASE_URL,
  SIGNUP_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: "spotlight-admin-signup-session"
    }
  }
);

window.SUPABASE_ANON_KEY = SIGNUP_SUPABASE_ANON_KEY;
