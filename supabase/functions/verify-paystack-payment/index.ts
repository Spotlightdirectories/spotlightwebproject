import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// -----------------------------------------------------------------
// PRICING TABLE — must exactly mirror getAmountInKobo() in
// payment.js. Exists here so the server can independently verify
// what a payment SHOULD have cost, rather than trusting whatever
// amount the browser sent to Paystack. Already expressed in kobo,
// matching payment.js's own values directly (no naira conversion
// needed here, unlike the sponsorship pricing table).
// -----------------------------------------------------------------
// TEMPORARY LIVE-KEY TEST PRICE — see payment/page.tsx for details.
// MUST be reverted to 299800 right after the test.
const PLAN_PRICES_KOBO: Record<string, Record<string, number>> = {
  standard: { monthly: 20000, yearly: 2698200 },
  enterprise: { monthly: 1260000, yearly: 11340000 },
  elite: { monthly: 2240000, yearly: 20160000 },
};

function getExpectedKobo(plan: string, billingType: string): number {
  const normalizedPlan = (plan || "").toLowerCase();
  const planPrices = PLAN_PRICES_KOBO[normalizedPlan];
  if (!planPrices) return 0;
  return planPrices[billingType] ?? planPrices.monthly ?? 0;
}

serve(async (req) => {

  console.log("EDGE FUNCTION HIT");

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
  console.log("DEBUG INPUT:", { reference, payment_id, auth_user_id });

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

    const { data: debugAllPayments } = await supabase
  .from("vendor_payments")
  .select("id, gateway_ref, status")
  .order("created_at", { ascending: false })
  .limit(5);

console.log("LATEST PAYMENTS:", debugAllPayments);

  // 🔹 Prevent duplicate processing
    const { data: existingPayment, error: fetchError } = await supabase
     .from("vendor_payments")
     .select("id, status, vendor_id, plan, billing_type")
     .eq("id", payment_id)
     .single();

  console.log("FETCHED PAYMENT:", existingPayment);

if (fetchError) {
  console.error("Fetch payment error:", fetchError);
}

if (!existingPayment) {
  console.error("No payment found with id:", payment_id);
  return new Response(
    JSON.stringify({ message: "Payment record not found" }),
    { headers: corsHeaders }
  );
}

if (existingPayment.status === "confirmed") {
  return new Response(
    JSON.stringify({ message: "Already processed" }),
    { headers: corsHeaders }
  );
}

// -----------------------------------------------------------------
// SERVER-SIDE PRICE CHECK — the actual security fix.
// Independently recompute what this payment SHOULD have cost, using
// the same pricing rules as payment.js, and compare it to what
// Paystack actually confirms was charged. The browser's number is
// never trusted on its own.
// -----------------------------------------------------------------
const expectedKobo = getExpectedKobo(existingPayment.plan, existingPayment.billing_type);
const actualKobo = verifyJson.data.amount;

if (expectedKobo > 0 && actualKobo !== expectedKobo) {
  console.error(
    "PRICE MISMATCH — refusing to activate.",
    {
      payment_id,
      plan: existingPayment.plan,
      billing_type: existingPayment.billing_type,
      expectedKobo,
      actualKobo,
      reference,
    }
  );
  // Left as-is deliberately — not auto-confirmed — so an admin can
  // review a genuine mismatch. The vendor was already charged
  // whatever they were charged; a human should look at this specific
  // case before anything else happens to it.
  return new Response(
    JSON.stringify({
      message: "Payment amount does not match the expected price for this plan. This has been flagged for manual review."
    }),
    { status: 400, headers: corsHeaders }
  );
}

  const now = new Date().toISOString();

  console.log("PAYMENT ID:", payment_id);

  // 🔹 Update vendorpayment
  const { data: updatedPayment, error: paymentUpdateError } = await supabase
  .from("vendor_payments")
  .update({
    status: "confirmed",
    approved_at: now,
    reviewed_at: now,
    notification_sent: true
  })
  .eq("id", payment_id)
  .select();

if (paymentUpdateError) {
  console.error("Payment update error:", paymentUpdateError);
}

if (!updatedPayment || updatedPayment.length === 0) {
  console.error("No payment matched reference:", reference);
}

  // 🔹 Activate vendor (fallback if webhook has not fired yet)
  // The webhook is SUPPOSED to be the primary activation path, but
  // in practice this function ends up doing the real work (the
  // webhook_event/webhook_received_at fields stay null on payments
  // processed here, meaning the webhook isn't reliably firing).
  //
  // Previous guard here was `.neq("subscription_status", "active")`
  // — intended to avoid double-processing if the webhook got there
  // first, but it broke every UPGRADE: an upgrading vendor is, by
  // definition, already active on their current plan, so that guard
  // was always false and the plan/billing_cycle/expiry never
  // actually got written, even though the payment itself succeeded.
  //
  // Fixed: fetch the vendor's current state first, and only skip the
  // write if they're already on this EXACT plan+billing_cycle+active
  // (a true duplicate/already-processed case) — not just "active on
  // something". This lets upgrades apply while still avoiding a
  // redundant duplicate write if the webhook did get there first.
  const expiry =
    existingPayment.billing_type === "monthly"
      ? new Date(new Date(now).setMonth(new Date(now).getMonth() + 1))
      : new Date(new Date(now).setFullYear(new Date(now).getFullYear() + 1));

  const { data: currentVendor } = await supabase
    .from("vendors")
    .select("plan_tier, billing_cycle, subscription_status")
    .eq("id", existingPayment.vendor_id)
    .single();

  const alreadyAppliedExactly =
    currentVendor &&
    currentVendor.plan_tier === existingPayment.plan &&
    currentVendor.billing_cycle === existingPayment.billing_type &&
    currentVendor.subscription_status === "active";

  if (!alreadyAppliedExactly) {
    await supabase
      .from("vendors")
      .update({
        subscription_status: "active",
        plan_tier: existingPayment.plan,
        billing_cycle: existingPayment.billing_type,
        is_premium: true,
        paystack_reference: reference,
        paid_at: now,
        expires_at: expiry.toISOString()
      })
      .eq("id", existingPayment.vendor_id);
  }

  // 🔹 Send activation email
  const { data: vendorData } = await supabase
    .from("vendors")
    .select("email")
    .eq("id", existingPayment.vendor_id)
    .single();

  if (vendorData?.email) {
  try {
    await fetch(
  `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`
    },
    body: JSON.stringify({
      to: vendorData.email,
      subject: "Payment Successful 🎉",
      html: `<p>Your payment has been confirmed.</p>
             <p>You can now access your dashboard to complete onboarding. Make sure you get to 100% to optimize your business page.</p>`
    })
  }
);
  } catch (err) {
    console.error("Email failed:", err);
  }
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