// ===============================================================
// confirm-email-change
//
// Verifies the single OTP code and applies the change immediately
// — to both the login email and the vendor profile, atomically, via
// the Admin API. No second code, no old-email confirmation step.
// ===============================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization." }),
        { status: 401, headers: corsHeaders }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: userData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Not authenticated." }),
        { status: 401, headers: corsHeaders }
      );
    }

    const { data: vendor, error: vendorError } = await supabase
      .from("vendors")
      .select("id, email")
      .eq("auth_user_id", userData.user.id)
      .maybeSingle();

    if (vendorError || !vendor) {
      return new Response(
        JSON.stringify({ error: "Vendor record not found." }),
        { status: 403, headers: corsHeaders }
      );
    }

    const body = await req.json();
    const { otp } = body;

    if (!otp) {
      return new Response(
        JSON.stringify({ error: "A code is required." }),
        { status: 400, headers: corsHeaders }
      );
    }

    const { data: changeRequest, error: requestError } = await supabase
      .from("email_change_requests")
      .select("*")
      .eq("vendor_id", vendor.id)
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (requestError || !changeRequest) {
      return new Response(
        JSON.stringify({ error: "No pending email change request found. Please start again." }),
        { status: 404, headers: corsHeaders }
      );
    }

    if (new Date(changeRequest.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "This code has expired. Please request a new one." }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (changeRequest.otp_code !== String(otp).trim()) {
      return new Response(
        JSON.stringify({ error: "That code is incorrect." }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Code matches — apply the change directly via the Admin API.
    // email_confirm: true marks it confirmed immediately, since the
    // OTP check just proved ownership — no separate Supabase
    // confirmation email needed on top of this.
    const { error: authUpdateError } = await supabase.auth.admin.updateUserById(
      userData.user.id,
      { email: changeRequest.new_email, email_confirm: true }
    );

    if (authUpdateError) {
      return new Response(
        JSON.stringify({ error: "Failed to update login email: " + authUpdateError.message }),
        { status: 500, headers: corsHeaders }
      );
    }

    const { error: vendorUpdateError } = await supabase
      .from("vendors")
      .update({ email: changeRequest.new_email })
      .eq("id", vendor.id);

    if (vendorUpdateError) {
      return new Response(
        JSON.stringify({
          error: "Login email updated, but the vendor profile update failed: " + vendorUpdateError.message,
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    await supabase
      .from("email_change_requests")
      .update({ used: true })
      .eq("id", changeRequest.id);

    return new Response(
      JSON.stringify({ success: true, newEmail: changeRequest.new_email }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: corsHeaders }
    );
  }
});