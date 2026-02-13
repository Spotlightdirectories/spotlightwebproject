import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { reference, payment_id, auth_user_id } = await req.json();

  if (!reference || !payment_id || !auth_user_id) {
    return new Response("Missing data", { status: 400 });
  }

  const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!paystackSecret) {
    return new Response("Paystack secret missing", { status: 500 });
  }

  // 1. Verify transaction with Paystack
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
    return new Response("Payment not successful", { status: 400 });
  }

  // 2. Update database
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

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { "Content-Type": "application/json" } }
  );
});
