// ===============================================================
// request-email-change
//
// Single-verification email change: generates one 6-digit code and
// sends it ONLY to the requested new email address. Entering it
// correctly is sufficient proof — no second code, no old-email step.
// ===============================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function codeEmailHtml(code: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Spotlight Directories</title>
</head>
<body style="margin:0;padding:0;background-color:#fafaf8;font-family:Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background-color:#fafaf8;padding:40px 16px;">
    <tr>
      <td align="center">

        <table width="600" cellpadding="0" cellspacing="0" border="0"
          style="max-width:600px;width:100%;background:#ffffff;
                 border-radius:16px;overflow:hidden;
                 box-shadow:0 4px 16px rgba(0,0,0,0.08);">

          <tr>
            <td style="background:#000000;padding:28px 40px;text-align:left;">
              <span style="font-size:24px;font-weight:700;color:#e6c200;letter-spacing:-0.5px;">Spotlight</span>
              <span style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Directories</span>
            </td>
          </tr>

          <tr>
            <td style="padding:40px 40px 32px;">

              <h1 style="margin:0 0 16px;font-size:26px;font-weight:700;color:#0f172a;line-height:1.2;">Verify Your New Email Address</h1>

              <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155;">Enter this code on your Spotlight dashboard to confirm this is your new email address.</p>

              <table cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;width:100%;">
                <tr>
                  <td style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;padding:24px;text-align:center;">
                    <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#0f172a;font-family:monospace;">${code}</span>
                  </td>
                </tr>
              </table>

              <div style="background:#dbeafe;border:1px solid #93c5fd;border-radius:10px;padding:14px 18px;margin:20px 0;">
                <p style="margin:0;font-size:14px;line-height:1.6;color:#1e40af;">This code expires in 15 minutes.</p>
              </div>

              <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#64748b;">If you did not request this, you can safely ignore this email.</p>

            </td>
          </tr>

          <tr>
            <td style="padding:0 40px;"><div style="height:1px;background:#e5e7eb;"></div></td>
          </tr>

          <tr>
            <td style="padding:24px 40px;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;">Spotlight Directories &mdash; Helping Nigerian businesses get found.</p>
              <p style="margin:0;font-size:12px;color:#94a3b8;">&copy; ${new Date().getFullYear()} Spotlight Digital Services Ltd. All rights reserved.</p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
}

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
    const { newEmail } = body;

    if (!newEmail || typeof newEmail !== "string") {
      return new Response(
        JSON.stringify({ error: "A valid new email is required." }),
        { status: 400, headers: corsHeaders }
      );
    }

    const cleanNewEmail = newEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(cleanNewEmail)) {
      return new Response(
        JSON.stringify({ error: "Please enter a valid email address." }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (cleanNewEmail === (vendor.email || "").toLowerCase()) {
      return new Response(
        JSON.stringify({ error: "This is already your current email address." }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Was vendors-only. A vendor's new email can just as easily
    // already belong to a customer (or partner) account on Spotlight
    // — same person, different role, same auth.users table underneath.
    // That case used to sail past this check, only to fail at the
    // final confirm step with a raw, unhelpful Admin API error
    // ("Failed to update login email: {}") — Cyril hit this exact
    // scenario 2026-08 with an email already used for a customer
    // profile. Checking all three identity tables here catches it
    // immediately and tells the vendor specifically why.
    const [{ data: existingVendor }, { data: existingCustomer }, { data: existingPartner }] = await Promise.all([
      supabase.from("vendors").select("id").eq("email", cleanNewEmail).maybeSingle(),
      supabase.from("customers").select("id").eq("email", cleanNewEmail).maybeSingle(),
      supabase.from("partners").select("id").eq("email", cleanNewEmail).maybeSingle(),
    ]);

    if (existingVendor) {
      return new Response(
        JSON.stringify({ error: "This email is already registered to another vendor account." }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (existingCustomer) {
      return new Response(
        JSON.stringify({ error: "This email is already registered to a customer account. Use a different email, or contact support if you'd like to link the two." }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (existingPartner) {
      return new Response(
        JSON.stringify({ error: "This email is already registered to a partner account." }),
        { status: 400, headers: corsHeaders }
      );
    }

    const otpCode = generateOtp();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { error: insertError } = await supabase
      .from("email_change_requests")
      .insert({
        vendor_id: vendor.id,
        old_email: vendor.email,
        new_email: cleanNewEmail,
        otp_code: otpCode,
        expires_at: expiresAt,
        used: false,
      });

    if (insertError) {
      return new Response(
        JSON.stringify({ error: "Failed to start email change: " + insertError.message }),
        { status: 500, headers: corsHeaders }
      );
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
      },
      body: JSON.stringify({
        from: "Spotlight <onboarding@mail.spotlightdirectories.com>",
        to: cleanNewEmail,
        subject: "Verify Your New Email Address",
        html: codeEmailHtml(otpCode),
      }),
    });

    if (!resendResponse.ok) {
      const errBody = await resendResponse.json().catch(() => ({}));
      console.error("Resend send failed:", errBody);
      return new Response(
        JSON.stringify({ error: "Failed to send verification code. Please try again." }),
        { status: 500, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: corsHeaders }
    );
  }
});