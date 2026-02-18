import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    // 1️⃣ Validate Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, message: "Unauthorized" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const {
      data: { user },
    } = await supabaseAdmin.auth.getUser(token);

    if (!user) {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid token" }),
        { status: 401, headers: corsHeaders }
      );
    }

    // 2️⃣ Read OTP from body
    const { otp } = await req.json();

    if (!otp) {
      return new Response(
        JSON.stringify({ success: false, message: "OTP required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 3️⃣ Get latest unverified OTP record
    const { data: record, error } = await supabaseAdmin
      .from("phone_verifications")
      .select("*")
      .eq("auth_user_id", user.id)
      .eq("verified", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !record) {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid OTP" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 4️⃣ Expiry check
    if (new Date(record.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, message: "OTP expired" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 5️⃣ Attempt limit check
    if (record.attempts >= 5) {
      return new Response(
        JSON.stringify({ success: false, message: "Too many attempts" }),
        { status: 429, headers: corsHeaders }
      );
    }

    // 6️⃣ Hash incoming OTP
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest(
      "SHA-256",
      encoder.encode(otp)
    );

    const otpHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // 7️⃣ Compare hash
    if (otpHash !== record.otp_hash) {
      await supabaseAdmin
        .from("phone_verifications")
        .update({ attempts: record.attempts + 1 })
        .eq("id", record.id);

      return new Response(
        JSON.stringify({ success: false, message: "Incorrect OTP" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 8️⃣ Mark verified
    await supabaseAdmin
      .from("phone_verifications")
      .update({ verified: true })
      .eq("id", record.id);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: corsHeaders }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, message: "Server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
