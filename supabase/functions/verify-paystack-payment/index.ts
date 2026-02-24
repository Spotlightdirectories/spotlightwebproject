import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // 🔹 Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
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

  // 🔹 Verify with Paystack
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

  // 🔹 Prevent duplicate processing
  const { data: existingPayment } = await supabase
    .from("vendorpayments")
    .select("status, vendor_id, plan, billing_type")
    .eq("id", payment_id)
    .single();

  if (!existingPayment || existingPayment.status === "approved") {
    return new Response(
      JSON.stringify({ message: "Already processed" }),
      { headers: corsHeaders }
    );
  }

  const now = new Date().toISOString();

  // 🔹 Update vendorpayment
  await supabase
    .from("vendorpayments")
    .update({
      status: "approved",
      paystack_reference: reference,
      approved_at: now,
      reviewed_at: now
    })
    .eq("id", payment_id);

  // 🔹 Activate vendor
  await supabase
    .from("vendors")
    .update({
      subscription_status: "active",
      plan_tier: existingPayment.plan,
      billing_cycle: existingPayment.billing_type,
      is_premium: true,
      paid_at: now
    })
    .eq("id", existingPayment.vendor_id);

  // 🔹 Send activation email
  const { data: vendorData } = await supabase
    .from("vendors")
    .select("email")
    .eq("id", existingPayment.vendor_id)
    .single();

  if (vendorData?.email) {
    await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
        },
        body: JSON.stringify({
          to: vendorData.email,
          subject: "Payment Successful 🎉",
          html: `
            <p>Your payment has been confirmed.</p>
            <p>You can now complete onboarding and access your dashboard.</p>
          `
        })
      }
    );
  }

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