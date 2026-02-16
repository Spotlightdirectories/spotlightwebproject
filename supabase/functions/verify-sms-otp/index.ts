import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, message: "Unauthorized" }), { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ success: false, message: "Invalid token" }), { status: 401 });
    }

    const { otp } = await req.json();
    if (!otp) {
      return new Response(JSON.stringify({ success: false, message: "OTP required" }), { status: 400 });
    }

    const { data: record } = await supabaseAdmin
      .from("phone_verifications")
      .select("*")
      .eq("auth_user_id", user.id)
      .eq("verified", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!record) {
      return new Response(JSON.stringify({ success: false, message: "Invalid OTP" }), { status: 400 });
    }

    if (new Date(record.expires_at) < new Date()) {
      return new Response(JSON.stringify({ success: false, message: "OTP expired" }), { status: 400 });
    }

    if (record.attempts >= 5) {
      return new Response(JSON.stringify({ success: false, message: "Too many attempts" }), { status: 429 });
    }

    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(otp));
    const otpHash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, "0")).join("");

    if (otpHash !== record.otp_hash) {
      await supabaseAdmin
        .from("phone_verifications")
        .update({ attempts: record.attempts + 1 })
        .eq("id", record.id);

      return new Response(JSON.stringify({ success: false, message: "Incorrect OTP" }), { status: 400 });
    }

    await supabaseAdmin
      .from("phone_verifications")
      .update({ verified: true })
      .eq("id", record.id);

    return new Response(JSON.stringify({ success: true }));

  } catch {
    return new Response(JSON.stringify({ success: false, message: "Server error" }), { status: 500 });
  }
});
