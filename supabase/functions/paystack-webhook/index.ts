import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// -----------------------------------------------------------------
// PRICING TABLE — must exactly mirror getAmountInKobo() in
// payment.js (same table used in verify-paystack-payment). Lets this
// webhook — the actual PRIMARY activation path — independently
// verify what a payment should have cost, instead of trusting
// whatever amount was charged.
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

// -----------------------------------------------------------------
// SPONSORSHIP PRICING TABLES — must exactly mirror getsponsored.js
// (same tables used in verify-paystack-sponsorship). Added so this
// webhook can activate sponsorships too, not just subscriptions.
// Previously this webhook only ever looked in vendor_payments, so a
// sponsorship payment had zero automatic safety net if the browser's
// own post-checkout call never fired.
// -----------------------------------------------------------------
// TEMPORARY LIVE-KEY TEST PRICE — see getsponsored/page.tsx for
// details. MUST be reverted to 2000/2000 right after the test.
const SPONSOR_PRODUCT_SERVICE_TIERS: Record<string, { monthly: number; singleMonthly: number }> = {
  standard: { monthly: 200,  singleMonthly: 200 },
  silver:   { monthly: 5000,  singleMonthly: 2500 },
  gold:     { monthly: 8000,  singleMonthly: 4000 },
  platinum: { monthly: 12000, singleMonthly: 6000 },
  diamond:  { monthly: 16000, singleMonthly: 8000 },
};

const SPONSOR_BUSINESS_TIERS: Record<string, number> = {
  standard: 3000, silver: 6000, gold: 10000, platinum: 15000, diamond: 20000,
};

const SPONSOR_PLAN_MULTIPLIER: Record<string, number> = { standard: 1, enterprise: 1.5, elite: 2 };

function getExpectedSponsorshipKobo(
  sponsorshipType: string,
  tier: string,
  itemCount: number,
  vendorPlanTier: string,
  billingCycle: string
): number {
  let expectedMonthly = 0;
  if (sponsorshipType === "business") {
    const base = SPONSOR_BUSINESS_TIERS[tier] ?? 0;
    const multiplier = SPONSOR_PLAN_MULTIPLIER[vendorPlanTier] ?? 1;
    expectedMonthly = base * multiplier;
  } else {
    const tierConfig = SPONSOR_PRODUCT_SERVICE_TIERS[tier];
    if (!tierConfig) return 0;
    expectedMonthly = itemCount === 1 ? tierConfig.singleMonthly : tierConfig.monthly;
  }
  const expectedNaira = billingCycle === "yearly" ? expectedMonthly * 9 : expectedMonthly;
  return expectedNaira * 100;
}

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

// -----------------------------------------------------------------
// SIGNATURE VERIFICATION — now that Supabase's own JWT check is
// disabled for this endpoint (required, since Paystack has no way to
// supply one), this function must authenticate the caller itself.
// Paystack signs every webhook request with HMAC-SHA512 of the exact
// raw body, using your Paystack secret key, in the
// x-paystack-signature header. Verifying this confirms the request
// genuinely came from Paystack — without it, disabling the JWT check
// would leave this endpoint open to anyone who knows the URL.
// -----------------------------------------------------------------
const rawBody = await req.text();
const paystackSignature = req.headers.get("x-paystack-signature");
const paystackSecretForSig = Deno.env.get("PAYSTACK_SECRET_KEY");

if (!paystackSecretForSig) {
  console.error("PAYSTACK_SECRET_KEY missing — cannot verify webhook signature.");
  return new Response("Server misconfigured", { status: 500, headers: corsHeaders });
}

const signatureKey = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(paystackSecretForSig),
  { name: "HMAC", hash: "SHA-512" },
  false,
  ["sign"]
);
const signatureBuffer = await crypto.subtle.sign("HMAC", signatureKey, new TextEncoder().encode(rawBody));
const computedSignature = Array.from(new Uint8Array(signatureBuffer))
  .map(b => b.toString(16).padStart(2, "0"))
  .join("");

if (!paystackSignature || computedSignature !== paystackSignature) {
  console.error("Webhook signature mismatch — rejecting request that does not genuinely come from Paystack.");
  return new Response("Invalid signature", { status: 401, headers: corsHeaders });
}

// -----------------------------------------------------------------
// IP CHECK — second layer of defense, on top of the signature check
// above. Paystack publishes the fixed set of IPs their webhooks are
// sent from and states any request from outside these can safely be
// treated as counterfeit. The signature check is the definitive
// authentication (a forged request can't produce a valid signature
// without the secret key, regardless of its source IP), so this is
// logged and enforced as an additional check, not a replacement.
// -----------------------------------------------------------------
const PAYSTACK_WEBHOOK_IPS = ["52.31.139.75", "52.49.173.169", "52.214.14.220"];
const forwardedFor = req.headers.get("x-forwarded-for") || "";
const callerIp = forwardedFor.split(",")[0].trim();

if (callerIp && !PAYSTACK_WEBHOOK_IPS.includes(callerIp)) {
  console.error("Webhook request from unrecognized IP — rejecting.", { callerIp });
  return new Response("Unrecognized source", { status: 401, headers: corsHeaders });
}

const body = JSON.parse(rawBody);

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

if (payment) {

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

// -----------------------------------------------------------------
// SERVER-SIDE PRICE CHECK — same fix as verify-paystack-payment,
// applied here too since this webhook is the actual primary
// activation path (per the comment in verify-paystack-payment) —
// fixing only that function would leave this one still trusting
// whatever amount Paystack reports.
// -----------------------------------------------------------------
const expectedKobo = getExpectedKobo(payment.plan, payment.billing_type);
const actualKobo = verifyData.data.amount;

if (expectedKobo > 0 && actualKobo !== expectedKobo) {
  console.error(
    "PRICE MISMATCH (webhook) — refusing to activate.",
    {
      payment_id: payment.id,
      plan: payment.plan,
      billing_type: payment.billing_type,
      expectedKobo,
      actualKobo,
      reference,
    }
  );
  // Left as "pending" deliberately — not auto-confirmed — so an
  // admin can review a genuine mismatch rather than it silently
  // activating. Still logs the webhook receipt for the audit trail.
  await supabase
    .from("vendor_payments")
    .update({
      webhook_event: event,
      webhook_received_at: new Date().toISOString()
    })
    .eq("id", payment.id);

  return new Response(
    JSON.stringify({ success: false, error: "Amount mismatch — flagged for manual review" }),
    { status: 400, headers: corsHeaders }
  );
}

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

} // end subscription branch (payment found in vendor_payments)

// -----------------------------------------------------------------
// Not a subscription payment — check whether this reference belongs
// to a SPONSORSHIP batch instead. Sponsorships live in a separate
// table with their own pricing and activation rules.
// -----------------------------------------------------------------
const { data: sponsorships } = await supabase
  .from("vendor_sponsorships")
  .select("id, payment_status, vendor_id, billing_cycle, sponsorship_type, target_id, tier")
  .eq("gateway_ref", reference);

if (sponsorships && sponsorships.length > 0) {
  const first = sponsorships[0];

  // 🔒 Retry protection — mirrors verify-paystack-sponsorship
  if (first.payment_status === "active") {
    return new Response(
      JSON.stringify({ message: "Sponsorship already processed" }),
      { status: 200, headers: corsHeaders }
    );
  }

  const { data: sponsorVendor } = await supabase
    .from("vendors")
    .select("email, plan_tier")
    .eq("id", first.vendor_id)
    .maybeSingle();

  // Same server-side price check as the subscription path above —
  // independently recompute what this batch SHOULD have cost and
  // compare it to what Paystack actually confirms was charged.
  const itemCount = first.sponsorship_type === "business" ? 1 : sponsorships.length;
  const expectedSponsorKobo = getExpectedSponsorshipKobo(
    first.sponsorship_type,
    first.tier,
    itemCount,
    sponsorVendor?.plan_tier || "standard",
    first.billing_cycle
  );
  const actualSponsorKobo = verifyData.data.amount;

  if (expectedSponsorKobo > 0 && actualSponsorKobo !== expectedSponsorKobo) {
    console.error(
      "SPONSORSHIP PRICE MISMATCH (webhook) — refusing to activate.",
      { reference, expectedSponsorKobo, actualSponsorKobo, sponsorshipIds: sponsorships.map((s) => s.id) }
    );
    // Left as "pending" deliberately, same reasoning as the
    // subscription path — a human should review a genuine mismatch.
    return new Response(
      JSON.stringify({ success: false, error: "Amount mismatch — flagged for manual review" }),
      { status: 400, headers: corsHeaders }
    );
  }

  const sponsorNowIso = new Date().toISOString();
  const sponsorExpiry =
    first.billing_cycle === "monthly"
      ? new Date(new Date().setDate(new Date().getDate() + 30))
      : new Date(new Date().setDate(new Date().getDate() + 365));

  const sponsorshipIds = sponsorships.map((s) => s.id);

  await supabase
    .from("vendor_sponsorships")
    .update({
      payment_status: "active",
      starts_at: sponsorNowIso,
      expires_at: sponsorExpiry.toISOString(),
    })
    .in("id", sponsorshipIds);

  if (sponsorVendor?.email) {
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
            to: sponsorVendor.email,
            subject: "Sponsorship Activated 🎉",
            html: `<p>Your ${first.tier} sponsorship is now active.</p>
                   <p>It will run until ${sponsorExpiry.toDateString()}.</p>`
          })
        }
      );
    } catch (err) {
      console.error("Email failed:", err);
    }
  }

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: corsHeaders }
  );
}

// Neither a subscription payment nor a sponsorship batch matched
// this reference.
return new Response(
  JSON.stringify({ error: "Payment record not found" }),
  { status: 400, headers: corsHeaders }
);
});
