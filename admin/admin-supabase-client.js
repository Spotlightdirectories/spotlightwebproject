// admin-supabase-client.js
// Dedicated Supabase client for admin pages.
// Uses a separate storage key so admin and vendor
// sessions never conflict with each other.

const ADMIN_SUPABASE_URL = "https://gyvzmktavyrevfxnwsay.supabase.co";
const ADMIN_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dnpta3RhdnlyZXZmeG53c2F5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NjIyNzUsImV4cCI6MjA3NjUzODI3NX0.a5LnkYZb6IlTd2PEwD-M-Cw-hQSC8lKSU1uOEjgwjRo";

// Use a separate storage key so admin session is
// completely isolated from vendor session
window.supabaseClient = window.supabase.createClient(
  ADMIN_SUPABASE_URL,
  ADMIN_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: "spotlight-admin-session"
    }
  }
);

window.SUPABASE_ANON_KEY = ADMIN_SUPABASE_ANON_KEY;
