import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import crypto from "node:crypto";

serve(async (req) => {
  // Allow only POST requests
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Read raw request body
  const body = await req.text();

  // Read Paystack signature
  const signature = req.headers.get("x-paystack-signature");
  const secret = Deno.env.get("PAYSTACK_SECRET_KEY");

  if (!signature || !secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Verify signature
  const computedHash = crypto
    .createHmac("sha512", secret)
    .update(body)
    .digest("hex");

  if (computedHash !== signature) {
    return new Response("Invalid signature", { status: 401 });
  }

  // Parse Paystack event
  const event = JSON.parse(body);

  // Only handle successful charges
  if (event.event !== "charge.success") {
    return new Response("Event ignored", { status: 200 });
  }

  const paymentId = event.data?.metadata?.payment_id;
  const authUserId = event.data?.metadata?.auth_user_id;

  if (!paymentId || !authUserId) {
    return new Response("Missing metadata", { status: 400 });
  }

  // Create Supabase service client
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1. Mark payment as approved
  await supabase
    .from("vendorpayments")
    .update({
      status: "approved",
      paystack_reference: event.data.reference
    })
    .eq("id", paymentId);

  // 2. Activate vendor
  await supabase
    .from("vendors")
    .update({ is_active: true })
    .eq("auth_user_id", authUserId);

  return new Response("OK", { status: 200 });
});
