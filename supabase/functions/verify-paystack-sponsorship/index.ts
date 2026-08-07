import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// -----------------------------------------------------------------
// PRICING TABLES — must exactly mirror getsponsored.js. These exist
// here so the server can independently verify what a payment SHOULD
// have cost, rather than trusting the amount the browser sent to
// Paystack. Without this, someone could alter the client-side price
// before checkout and get a cheaper tier activated at full strength.
// If Cyril ever changes approved pricing, both places must be
// updated together.
// -----------------------------------------------------------------
const PRODUCT_SERVICE_TIERS: Record<string, { monthly: number; singleMonthly: number }> = {
  standard: { monthly: 2000,  singleMonthly: 2000 },
  silver:   { monthly: 5000,  singleMonthly: 2500 },
  gold:     { monthly: 8000,  singleMonthly: 4000 },
  platinum: { monthly: 12000, singleMonthly: 6000 },
  diamond:  { monthly: 16000, singleMonthly: 8000 },
};

const BUSINESS_TIERS: Record<string, number> = {
  standard: 3000, silver: 6000, gold: 10000, platinum: 15000, diamond: 20000,
};

const PLAN_MULTIPLIER: Record<string, number> = { standard: 1, enterprise: 1.5, elite: 2 };

// -----------------------------------------------------------------
// BRANDED EMAIL — mirrors spotlight-next/src/lib/emailTemplates.ts
// (same shell, colours, and heading/paragraph/infoTable/alertBox
// building blocks used by EmailTemplates.sponsorshipApproved).
// Duplicated here because edge functions run on Deno and can't
// import the Next.js app's src/lib modules directly. Previously this
// email was a bare <p> string with no branding at all — fixed here to
// match every other transactional email on the platform.
// -----------------------------------------------------------------
function sponsorshipActivatedEmail(vendorName: string, tier: string, typeLabel: string, expiresAt: string): string {
  const tierDisplay = tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : "—";
  const expiryDisplay = new Date(expiresAt).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Spotlight Directories</title></head>
<body style="margin:0;padding:0;background-color:#fafaf8;font-family:Arial,sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">Your ${tierDisplay} sponsorship is now active on Spotlight.</span>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fafaf8;padding:40px 16px;"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">
      <tr><td style="background:#000000;padding:28px 40px;text-align:left;">
        <span style="font-size:24px;font-weight:700;color:#e6c200;letter-spacing:-0.5px;">Spotlight</span>
        <span style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Directories</span>
      </td></tr>
      <tr><td style="padding:40px 40px 32px;">
        <h1 style="margin:0 0 16px;font-size:26px;font-weight:700;color:#0f172a;line-height:1.2;">Sponsorship Activated 🎉</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155;">Hello${vendorName ? " " + vendorName : " there"},</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155;">Your payment was successful and your <strong>${tierDisplay}</strong> sponsorship for ${typeLabel || "your listing"} is now active.</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border-radius:12px;overflow:hidden;margin:20px 0;border:1px solid #e5e7eb;"><tbody>
          <tr><td style="padding:10px 16px;font-size:13px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.04em;width:140px;border-bottom:1px solid #f1f5f9;">Tier</td><td style="padding:10px 16px;font-size:15px;font-weight:600;color:#0f172a;border-bottom:1px solid #f1f5f9;">${tierDisplay}</td></tr>
          <tr><td style="padding:10px 16px;font-size:13px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.04em;width:140px;border-bottom:1px solid #f1f5f9;">Runs Until</td><td style="padding:10px 16px;font-size:15px;font-weight:600;color:#0f172a;border-bottom:1px solid #f1f5f9;">${expiryDisplay}</td></tr>
        </tbody></table>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155;">Your sponsored placement is now live and visible to customers browsing Spotlight.</p>
        <div style="background:#dcfce7;border:1px solid #86efac;border-radius:10px;padding:14px 18px;margin:20px 0;"><p style="margin:0;font-size:14px;line-height:1.6;color:#166534;">You'll get another email if this sponsorship needs renewing before it expires.</p></div>
      </td></tr>
      <tr><td style="padding:0 40px;"><div style="height:1px;background:#e5e7eb;"></div></td></tr>
      <tr><td style="padding:24px 40px;text-align:center;">
        <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;">Spotlight Directories &mdash; Helping Nigerian businesses get found.</p>
        <p style="margin:0;font-size:12px;color:#94a3b8;">&copy; ${new Date().getFullYear()} Spotlight Digital Services Ltd. All rights reserved.</p>
        <p style="margin:8px 0 0;font-size:12px;color:#94a3b8;"><a href="https://spotlightdirectories.com" style="color:#94a3b8;text-decoration:underline;">spotlightdirectories.com</a></p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

function computeExpectedMonthlyNaira(
  sponsorshipType: string,
  tier: string,
  itemCount: number,
  vendorPlanTier: string
): number {
  if (sponsorshipType === "business") {
    const base = BUSINESS_TIERS[tier] ?? 0;
    const multiplier = PLAN_MULTIPLIER[vendorPlanTier] ?? 1;
    return base * multiplier;
  }
  const tierConfig = PRODUCT_SERVICE_TIERS[tier];
  if (!tierConfig) return 0;
  return itemCount === 1 ? tierConfig.singleMonthly : tierConfig.monthly;
}

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

  // Fetch the vendor's real plan tier — needed to compute the correct
  // expected price for business-type sponsorships (scaled by plan).
  const { data: vendorData } = await supabase
    .from("vendors")
    .select("email, name, plan_tier")
    .eq("id", firstSponsorship.vendor_id)
    .single();

  // -----------------------------------------------------------------
  // SERVER-SIDE PRICE CHECK — the actual security fix.
  // Independently recompute what this batch SHOULD have cost, using
  // the same pricing rules as getsponsored.js, and compare it to what
  // Paystack actually confirms was charged. The browser's number is
  // never trusted on its own — if someone altered it before checkout,
  // this catches the mismatch and refuses to activate.
  // -----------------------------------------------------------------
  const itemCount = firstSponsorship.sponsorship_type === "business" ? 1 : existingSponsorships.length;

  const expectedMonthly = computeExpectedMonthlyNaira(
    firstSponsorship.sponsorship_type,
    firstSponsorship.tier,
    itemCount,
    vendorData?.plan_tier || "standard"
  );

  const expectedNaira = firstSponsorship.billing_cycle === "yearly" ? expectedMonthly * 9 : expectedMonthly;
  const expectedKobo = expectedNaira * 100;
  const actualKobo = verifyJson.data.amount;

  if (actualKobo !== expectedKobo) {
    console.error(
      "PRICE MISMATCH — refusing to activate.",
      {
        sponsorship_ids,
        sponsorship_type: firstSponsorship.sponsorship_type,
        tier: firstSponsorship.tier,
        billing_cycle: firstSponsorship.billing_cycle,
        itemCount,
        vendor_plan_tier: vendorData?.plan_tier,
        expectedKobo,
        actualKobo,
        reference,
      }
    );
    // Left as "pending" deliberately — not auto-rejected — so an
    // admin can review a genuine mismatch rather than it silently
    // activating OR silently vanishing. The vendor was already
    // charged whatever they were charged; a human should look at
    // this specific case before anything else happens to it.
    return new Response(
      JSON.stringify({
        message: "Payment amount does not match the expected price for this sponsorship. This has been flagged for manual review."
      }),
      { status: 400, headers: corsHeaders }
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
            html: sponsorshipActivatedEmail(vendorData.name || "", firstSponsorship.tier, typeLabel, expiry.toISOString())
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
