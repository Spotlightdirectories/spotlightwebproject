// ===============================================================
// src/lib/getViewingCustomerId.ts
//
// Shared helper: returns the customer_id of the currently logged-in
// user, or null if they're not logged in, or logged in but have no
// customer profile (e.g. a vendor-only account browsing the site).
//
// Used to tie analytics_events rows (product/service views and
// WhatsApp/Call clicks) back to the viewing customer, so their
// customer-profile page can show "Recently Viewed" and "My
// Inquiries" — added per Cyril's request (2026-07-31). This is a
// genuine new feature, not a porting gap: production never linked
// any of this activity to a customer account at all.
// ===============================================================

import { supabase } from "@/lib/supabase";

export async function getViewingCustomerId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("auth_user_id", session.user.id)
    .maybeSingle();

  return customer?.id || null;
}
