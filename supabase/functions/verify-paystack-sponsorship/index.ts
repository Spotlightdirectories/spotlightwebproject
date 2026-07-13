import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {

  console.log("SPONSORSHIP VERIFY EDGE FUNCTION HIT");

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

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

  const { reference, sponsorship_id, auth_user_id } = await req.json();
  console.log("DEBUG INPUT:", { reference, sponsorship_id, auth_user_id });

  if (!reference || !sponsorship_id || !auth_user_id) {
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

  // Verify with Paystack — same check as the subscription flow
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

  // Prevent duplicate processing
  const { data: existingSponsorship, error: fetchError } = await supabase
    .from("vendor_sponsorships")
    .select("id, payment_status, vendor_id, billing_cycle, sponsorship_type, target_id, tier")
    .eq("id", sponsorship_id)
    .single();

  if (fetchError) {
    console.error("Fetch sponsorship error:", fetchError);
  }

  if (!existingSponsorship) {
    console.error("No sponsorship found with id:", sponsorship_id);
    return new Response(
      JSON.stringify({ message: "Sponsorship record not found" }),
      { headers: corsHeaders }
    );
  }

  if (existingSponsorship.payment_status === "active") {
    return new Response(
      JSON.stringify({ message: "Already processed" }),
      { headers: corsHeaders }
    );
  }

  const now = new Date();

  const expiry =
    existingSponsorship.billing_cycle === "monthly"
      ? new Date(new Date(now).setDate(now.getDate() + 30))
      : new Date(new Date(now).setDate(now.getDate() + 365));

  const { data: updatedSponsorship, error: updateError } = await supabase
    .from("vendor_sponsorships")
    .update({
      payment_status: "active",
      starts_at: now.toISOString(),
      expires_at: expiry.toISOString(),
    })
    .eq("id", sponsorship_id)
    .select();

  if (updateError) {
    console.error("Sponsorship update error:", updateError);
  }

  if (!updatedSponsorship || updatedSponsorship.length === 0) {
    console.error("No sponsorship matched id:", sponsorship_id);
  }

  // Send confirmation email — same pattern as subscription activation
  const { data: vendorData } = await supabase
    .from("vendors")
    .select("email, name")
    .eq("id", existingSponsorship.vendor_id)
    .single();

  if (vendorData?.email) {
    try {
      const typeLabel =
        existingSponsorship.sponsorship_type === "business"
          ? "your business"
          : existingSponsorship.sponsorship_type === "product"
            ? "your product"
            : "your service";

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
            subject: "Sponsorship Activated 🎉",
            html: `<p>Your ${existingSponsorship.tier} sponsorship for ${typeLabel} is now active.</p>
                   <p>It will run until ${expiry.toDateString()}.</p>`
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
