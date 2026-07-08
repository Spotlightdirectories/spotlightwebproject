// supabase-client.js

const SUPABASE_URL = "https://gyvzmktavyrevfxnwsay.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dnpta3RhdnlyZXZmeG53c2F5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NjIyNzUsImV4cCI6MjA3NjUzODI3NX0.a5LnkYZb6IlTd2PEwD-M-Cw-hQSC8lKSU1uOEjgwjRo";

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

