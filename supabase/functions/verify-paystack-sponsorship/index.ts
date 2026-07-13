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

  const { reference, sponsorship_ids, auth_user_id } = await req.json();
  console.log("DEBUG INPUT:", { reference, sponsorship_ids, auth_user_id });

  if (!reference || !sponsorship_ids || !Array.isArray(sponsorship_ids) || sponsorship_ids.length === 0 || !auth_user_id) {
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

  // Prevent duplicate processing — fetch all rows in this batch
  const { data: existingSponsorships, error: fetchError } = await supabase
    .from("vendor_sponsorships")
    .select("id, payment_status, vendor_id, billing_cycle, sponsorship_type, target_id, tier")
    .in("id", sponsorship_ids);

  if (fetchError) {
    console.error("Fetch sponsorships error:", fetchError);
  }

  if (!existingSponsorships || existingSponsorships.length === 0) {
    console.error("No sponsorships found with ids:", sponsorship_ids);
    return new Response(
      JSON.stringify({ message: "Sponsorship records not found" }),
      { headers: corsHeaders }
    );
  }

  const firstSponsorship = existingSponsorships[0];

  if (firstSponsorship.payment_status === "active") {
    return new Response(
      JSON.stringify({ message: "Already processed" }),
      { headers: corsHeaders }
    );
  }

  const now = new Date();

  const expiry =
    firstSponsorship.billing_cycle === "monthly"
      ? new Date(new Date(now).setDate(now.getDate() + 30))
      : new Date(new Date(now).setDate(now.getDate() + 365));

  const { data: updatedSponsorships, error: updateError } = await supabase
    .from("vendor_sponsorships")
    .update({
      payment_status: "active",
      starts_at: now.toISOString(),
      expires_at: expiry.toISOString(),
    })
    .in("id", sponsorship_ids)
    .select();

  if (updateError) {
    console.error("Sponsorship update error:", updateError);
  }

  if (!updatedSponsorships || updatedSponsorships.length === 0) {
    console.error("No sponsorships matched ids:", sponsorship_ids);
  }

  // Send confirmation email — same pattern as subscription activation
  const { data: vendorData } = await supabase
    .from("vendors")
    .select("email, name")
    .eq("id", firstSponsorship.vendor_id)
    .single();

  if (vendorData?.email) {
    try {
      const typeLabel =
        firstSponsorship.sponsorship_type === "business"
          ? "your business"
          : firstSponsorship.sponsorship_type === "product"
            ? (existingSponsorships.length > 1 ? `${existingSponsorships.length} products` : "your product")
            : (existingSponsorships.length > 1 ? `${existingSponsorships.length} services` : "your service");

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
            html: `<p>Your ${firstSponsorship.tier} sponsorship for ${typeLabel} is now active.</p>
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
