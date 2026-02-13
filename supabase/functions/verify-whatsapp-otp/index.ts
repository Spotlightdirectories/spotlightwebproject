import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { auth_user_id, otp } = await req.json();

  if (!auth_user_id || !otp) {
    return new Response("Missing fields", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data, error } = await supabase
    .from("phone_verifications")
    .select("*")
    .eq("auth_user_id", auth_user_id)
    .eq("otp_code", otp)
    .eq("verified", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return new Response(JSON.stringify({ success: false }), {
      status: 400
    });
  }

  if (new Date(data.expires_at) < new Date()) {
    return new Response(JSON.stringify({ success: false, message: "OTP expired" }), {
      status: 400
    });
  }

  await supabase
    .from("phone_verifications")
    .update({ verified: true })
    .eq("id", data.id);

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" }
  });
});
