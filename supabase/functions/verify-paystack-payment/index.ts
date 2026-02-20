import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {

  // 🔹 CORS HEADERS
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // 🔹 Handle preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  const { reference, payment_id, auth_user_id } = await req.json();

  if (!reference || !payment_id || !auth_user_id) {
    return new Response("Missing data", {
      status: 400,
      headers: corsHeaders,
    });
  }

  const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!paystackSecret) {
    return new Response("Paystack secret missing", {
      status: 500,
      headers: corsHeaders,
    });
  }

  // 🔹 Verify Paystack
  const verifyRes = await fetch(
    `https://api.paystack.co/transaction/verify/${reference}`,
    {
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
      },
    }
  );

  const verifyJson = await verifyRes.json();

  if (
    verifyJson.status !== true ||
    verifyJson.data.status !== "success"
  ) {
    return new Response("Payment not successful", {
      status: 400,
      headers: corsHeaders,
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  await supabase
    .from("vendorpayments")
    .update({
      status: "approved",
      paystack_reference: reference,
      approved_at: new Date().toISOString(),
    })
    .eq("id", payment_id);

  await supabase
    .from("vendors")
    .update({
      subscription_status: "active"
    })
    .eq("auth_user_id", auth_user_id);

  return new Response(
    JSON.stringify({ success: true }),
    {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    }
  );
});
