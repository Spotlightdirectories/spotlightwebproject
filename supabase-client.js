// supabase-client.js

const SUPABASE_URL = "https://oqymludksbjyfcneajug.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9xeW1sdWRrc2JqeWZjbmVhanVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzMjYwNjIsImV4cCI6MjA5ODkwMjA2Mn0.BbHOaZrHVx2FM2dVYl1MtL-xv_BVNZQqAugpnL_5kGY";

// Expose anon key globally so all pages can use it for Edge Function calls
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

window.supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

// 🔐 Track current logged-in user (vendor)
window.currentUser = null;

window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
  window.currentUser = session?.user || null;

  // When a vendor confirms their email change,
  // sync the new email to the vendors table automatically.
  if (event === "USER_UPDATED" && session?.user?.email) {
    const { error } = await window.supabaseClient
      .from("vendors")
      .update({ email: session.user.email })
      .eq("auth_user_id", session.user.id);
  }
});
