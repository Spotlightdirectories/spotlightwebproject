// ===============================================================
// src/lib/createVendorRecord.ts
//
// The vendor-row creation steps, shared by the two places that
// create a business: the vendor signup page (brand-new email) and the
// vendor login page's "setup" mode (email that already belongs to a
// customer account, added after the person proves it is theirs by
// logging in with that account's password).
// ===============================================================

import { supabase } from "@/lib/supabase";
import { EmailTemplates } from "@/lib/emailTemplates";

export type VendorFormDetails = {
  businessName: string;
  email: string;
  telephone: string;
  whatsapp: string;
  heardAboutUs: string;
  heardAboutDetail: string;
};

// Where the signup page parks what the person typed while they go and log in.
export const PENDING_VENDOR_KEY = "spotlight_pending_vendor_setup";

export async function createVendorRow(authUserId: string, f: VendorFormDetails, selectedPlan: string, billingType: string): Promise<string | null> {
  // Referral code -> partner id (narrow id-only lookup)
  let partnerId: string | null = null;
  const storedReferral = localStorage.getItem("referral_code")?.trim().toUpperCase();
  if (storedReferral) {
    const { data: resolvedId } = await supabase
      .rpc("get_partner_id_by_referral_code", { p_code: storedReferral })
      .maybeSingle();
    if (resolvedId) partnerId = resolvedId as unknown as string;
  }

  // Vendor-to-vendor referral. A partner commission always takes priority,
  // so a sign-up is never both. The database also blocks self-referral.
  let referrerVendorId: string | null = null;
  if (!partnerId) {
    const vref = localStorage.getItem("vendor_referral_code")?.trim().toUpperCase();
    if (vref) {
      const { data: vid } = await supabase.rpc("get_vendor_id_by_referral_code", { p_code: vref }).maybeSingle();
      if (vid) referrerVendorId = vid as unknown as string;
    }
  }

  // Where the vendor first came from (saved by SourceCapture). Missing is fine.
  let source: { utm_source?: string | null; utm_medium?: string | null; utm_campaign?: string | null; first_visit_at?: string | null } = {};
  try {
    source = JSON.parse(localStorage.getItem("spotlight_source") || "{}") || {};
  } catch { /* ignore */ }

  const { error } = await supabase.from("vendors").insert([{
    auth_user_id: authUserId,
    name: f.businessName,
    email: f.email,
    telephone: f.telephone,
    whatsapp: f.whatsapp,
    referred_by_partner_id: partnerId,
    referred_by_vendor_id: referrerVendorId,
    heard_about_us: f.heardAboutUs,
    heard_about_detail: (f.heardAboutDetail || "").trim().slice(0, 100) || null,
    utm_source: source.utm_source ?? null,
    utm_medium: source.utm_medium ?? null,
    utm_campaign: source.utm_campaign ?? null,
    first_visit_at: source.first_visit_at ?? null,
    plan_tier: selectedPlan,
    billing_cycle: billingType,
    subscription_status: selectedPlan === "free" ? "free" : "pending",
    trial_started_at: null, // No new-signup trial: free vendors start on the On the Map plan
    is_premium: selectedPlan !== "free",
    terms_accepted: true,
    terms_accepted_at: new Date().toISOString(),
  }]);

  return error ? error.message : null;
}

export async function sendVendorWelcomeEmail(f: VendorFormDetails, selectedPlan: string) {
  try {
    await fetch("https://gyvzmktavyrevfxnwsay.supabase.co/functions/v1/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: f.email,
        subject: "Welcome to Spotlight Directories",
        html: EmailTemplates.welcomeVendor({
          vendorName: f.businessName,
          plan: selectedPlan,
          loginUrl: `${window.location.origin}/login`,
        }),
      }),
    });
  } catch { /* non-fatal */ }
}

export function clearSignupStorage() {
  localStorage.removeItem("selectedPlan");
  localStorage.removeItem("billingType");
  localStorage.removeItem("referral_code");
  localStorage.removeItem("vendor_referral_code");
  localStorage.removeItem("spotlight_source");
  localStorage.removeItem(PENDING_VENDOR_KEY);
}
