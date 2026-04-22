import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {

  // 🔓 CORS HEADERS
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // Handle preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

const body = await req.json();

const event = body.event;
const reference = body.data?.reference;

if (event !== "charge.success" || !reference) {
  return new Response(
    JSON.stringify({ message: "Event ignored" }),
    { status: 200, headers: corsHeaders }
  );
}

  const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");

  const verifyRes = await fetch(
    `https://api.paystack.co/transaction/verify/${reference}`,
    {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
    }
  );

  const verifyData = await verifyRes.json();

  console.log("VERIFY DATA:", JSON.stringify(verifyData));


  if (!verifyData.status || verifyData.data.status !== "success") {
    return new Response(
      JSON.stringify({ success: false }),
      { status: 400, headers: corsHeaders }
    );
  }

const authUserId =
  body.data?.metadata?.auth_user_id ||
  verifyData.data?.metadata?.auth_user_id;

if (!authUserId) {
  return new Response(
    JSON.stringify({ success: false, error: "Missing auth_user_id in metadata" }),
    { status: 400, headers: corsHeaders }
  );
}

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

// 🔒 Prevent double activation
const { data: existingVendor } = await supabase
  .from("vendors")
  .select("subscription_status")
  .eq("auth_user_id", authUserId)
  .maybeSingle();

if (existingVendor?.subscription_status === "active") {
  return new Response(
    JSON.stringify({ message: "Already activated" }),
    { status: 200, headers: corsHeaders }
  );
}

// ✅ Activate vendor
await supabase
  .from("vendors")
  .update({ subscription_status: "active" })
  .eq("auth_user_id", authUserId);

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: corsHeaders }
  );
});
