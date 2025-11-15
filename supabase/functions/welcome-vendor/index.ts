// welcome-vendor/index.ts

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import CryptoJS from "npm:crypto-js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    // Read raw body
    const rawBody = await req.text();

    // Paystack signature verification
    const hash = CryptoJS.HmacSHA512(
      rawBody,
      Deno.env.get("PAYSTACK_SECRET_KEY")!
    ).toString();

    const signature = req.headers.get("x-paystack-signature");

    if (!signature || hash !== signature) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Parse JSON body
    const data = JSON.parse(rawBody);

    if (data.event !== "charge.success") {
      return new Response("Ignored", { status: 200 });
    }

    const vendorId = data.data.metadata.vendor_id;
    const amountPaid = data.data.amount / 100;

    // Init Supabase Admin client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! // very important
    );

    // Update vendorpayments
    await supabase
      .from("vendorpayments")
      .update({
        status: "paid",
        amount: amountPaid,
        gateway_reference: data.data.reference,
      })
      .eq("vendor_id", vendorId);

    // Activate vendor account
    await supabase
      .from("vendors")
      .update({
        payment_status: "paid",
        account_status: "active",
      })
      .eq("id", vendorId);

    // Generate login credentials (simple example)
    const username = "vendor" + vendorId;
    const password = crypto.randomUUID().slice(0, 8);

    // Save login credentials
    await supabase
      .from("vendors")
      .update({ username, password })
      .eq("id", vendorId);

    return new Response("Success", { status: 200 });
  } catch (err) {
    console.error("Error in webhook:", err);
    return new Response("Server error", { status: 500 });
  }
});