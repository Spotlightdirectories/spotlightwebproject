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

// ✅ Activate vendor
// 🔹 Get payment record using reference
const { data: payment } = await supabase
  .from("vendor_payments")
  .select("id, vendor_id, plan, billing_type, status")
  .eq("gateway_ref", reference)
  .maybeSingle();

if (!payment) {
  return new Response(
    JSON.stringify({ error: "Payment record not found" }),
    { status: 400, headers: corsHeaders }
  );
}

// 🔒 Retry protection (PAYMENT LEVEL)
if (payment.status === "confirmed") {
  // 🔹 Still log audit for retries
  await supabase
    .from("vendor_payments")
    .update({
      webhook_event: event,
      webhook_received_at: new Date().toISOString()
    })
    .eq("id", payment.id);

  return new Response(
    JSON.stringify({ message: "Payment already processed (audit logged)" }),
    { status: 200, headers: corsHeaders }
  );
}

if (payment.status !== "pending") {

  return new Response(
    JSON.stringify({
      message: "Payment already handled"
    }),
    {
      status: 200,
      headers: corsHeaders
    }
  );

}

const now = new Date().toISOString();

const expiry =
  payment.billing_type === "monthly"
    ? new Date(new Date(now).setMonth(new Date(now).getMonth() + 1))
    : new Date(new Date(now).setFullYear(new Date(now).getFullYear() + 1));

// 🔒 Prevent double activation
const { data: existingVendor } = await supabase
  .from("vendors")
  .select("subscription_status, paid_at")
  .eq("id", payment.vendor_id)
  .maybeSingle();

// ✅ FULL activation
await supabase
  .from("vendors")
  .update({
    subscription_status: "active",
    plan_tier: payment.plan,
    billing_cycle: payment.billing_type,
    is_premium: true,
    paystack_reference: reference,
    paid_at: now,
    expires_at: expiry
  })
  .eq("id", payment.vendor_id);

  await supabase
  .from("vendor_payments")
  .update({
    status: "confirmed",
    approved_at: now,
    reviewed_at: now,
    notification_sent: true
  })
  .eq("id", payment.id);

  // 🔹 Audit (first successful processing)
await supabase
  .from("vendor_payments")
  .update({
    webhook_event: event,
    webhook_received_at: new Date().toISOString()
  })
  .eq("id", payment.id);

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: corsHeaders }
  );
});
