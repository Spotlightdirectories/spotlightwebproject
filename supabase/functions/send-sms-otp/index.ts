import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, message: "Unauthorized" }),
        { status: 401, headers: corsHeaders });
    }

    const token = authHeader.replace("Bearer ", "");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user } } = await supabaseAdmin.auth.getUser(token);

    if (!user) {
      return new Response(JSON.stringify({ success: false, message: "Invalid token" }),
        { status: 401, headers: corsHeaders });
    }

    const { phone } = await req.json();
    if (!phone) {
      return new Response(JSON.stringify({ success: false, message: "Phone required" }),
        { status: 400, headers: corsHeaders });
    }

    // Format Nigerian number
    let formattedPhone = phone.trim();
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "234" + formattedPhone.slice(1);
    }
    if (!formattedPhone.startsWith("234")) {
      return new Response(JSON.stringify({ success: false, message: "Invalid phone format" }),
        { status: 400, headers: corsHeaders });
    }

    // Prevent spam: block if OTP sent within last 60 seconds
    const { data: lastOtp } = await supabaseAdmin
      .from("phone_verifications")
      .select("created_at")
      .eq("auth_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastOtp) {
      const diff = Date.now() - new Date(lastOtp.created_at).getTime();
      if (diff < 60000) {
        return new Response(JSON.stringify({ success: false, message: "Please wait before requesting another OTP" }),
          { status: 429, headers: corsHeaders });
      }
    }

    // Delete old unverified OTPs
    await supabaseAdmin
      .from("phone_verifications")
      .delete()
      .eq("auth_user_id", user.id)
      .eq("verified", false);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 5 * 60 * 1000);

    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(otp));
    const otpHash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, "0")).join("");

    const { error: insertError } = await supabaseAdmin
      .from("phone_verifications")
      .insert({
        auth_user_id: user.id,
        phone: formattedPhone,
        otp_hash: otpHash,
        expires_at: expires.toISOString(),
        verified: false,
        attempts: 0
      });

    if (insertError) {
      return new Response(JSON.stringify({ success: false, message: insertError.message }),
        { status: 500, headers: corsHeaders });
    }

    const termiiResponse = await fetch("https://v3.api.termii.com/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: Deno.env.get("TERMII_API_KEY"),
        to: formattedPhone,
        from: Deno.env.get("TERMII_SENDER_ID"),
        sms: `Your Spotlight verification code is ${otp}. It expires in 5 minutes.`,
        type: "plain",
        channel: "dnd"
      })
    });

    const termiiData = await termiiResponse.json();

    if (!termiiResponse.ok || termiiData.code !== "ok") {
      return new Response(JSON.stringify({ success: false, message: "SMS sending failed" }),
        { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, message: "Server error" }),
      { status: 500, headers: corsHeaders });
  }
});
