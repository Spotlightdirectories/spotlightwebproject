// ============================================================
// SPOTLIGHT DIRECTORIES — SEND EXPIRY WARNINGS
// send-expiry-warnings/index.ts
//
// Called by pg_cron daily at 7:00 AM UTC (8:00 AM Lagos).
// Queries vendors needing trial or subscription warnings,
// builds branded HTML emails, and sends via Resend.
//
// Called internally by database cron — not from the browser.
// ============================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ------------------------------------------------------------
// BRANDED EMAIL BUILDER
// Mirrors the structure of email-templates.js for Deno/TypeScript
// ------------------------------------------------------------

function base(preheader: string, body: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Spotlight Directories</title>
</head>
<body style="margin:0;padding:0;background-color:#fafaf8;font-family:Arial,sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</span>
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background-color:#fafaf8;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0"
          style="max-width:600px;width:100%;background:#ffffff;
                 border-radius:16px;overflow:hidden;
                 box-shadow:0 4px 16px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#000000;padding:28px 40px;text-align:left;">
              <span style="font-size:24px;font-weight:700;color:#e6c200;">Spotlight</span>
              <span style="font-size:24px;font-weight:700;color:#ffffff;">Directories</span>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 32px;">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px;">
              <div style="height:1px;background:#e5e7eb;"></div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;">
                Spotlight Directories &mdash; Helping Nigerian businesses get found.
              </p>
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                &copy; ${new Date().getFullYear()} Spotlight Digital Services Ltd. All rights reserved.
              </p>
              <p style="margin:8px 0 0;font-size:12px;color:#94a3b8;">
                <a href="https://spotlightdirectories.com" style="color:#94a3b8;">
                  spotlightdirectories.com
                </a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(label: string, url: string): string {
  return `
  <table cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
    <tr>
      <td style="background:#f97316;border-radius:10px;">
        <a href="${url}"
           style="display:inline-block;padding:14px 28px;
                  font-size:15px;font-weight:700;
                  color:#ffffff;text-decoration:none;">
          ${label}
        </a>
      </td>
    </tr>
  </table>`;
}

function alertBox(text: string, colour: string): string {
  const colours: Record<string, { bg: string; border: string; text: string }> = {
    warning: { bg: "#fef3c7", border: "#fcd34d", text: "#92400e" },
    info:    { bg: "#dbeafe", border: "#93c5fd", text: "#1e40af" },
  };
  const c = colours[colour] || colours.info;
  return `
  <div style="background:${c.bg};border:1px solid ${c.border};
              border-radius:10px;padding:14px 18px;margin:20px 0;">
    <p style="margin:0;font-size:14px;line-height:1.6;color:${c.text};">
      ${text}
    </p>
  </div>`;
}

function infoTable(rows: string): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background:#f8fafc;border-radius:12px;
           overflow:hidden;margin:20px 0;border:1px solid #e5e7eb;">
    <tbody>${rows}</tbody>
  </table>`;
}

function infoRow(label: string, value: string): string {
  return `
  <tr>
    <td style="padding:10px 16px;font-size:13px;font-weight:700;
               color:#94a3b8;text-transform:uppercase;
               letter-spacing:0.04em;width:140px;
               border-bottom:1px solid #f1f5f9;">
      ${label}
    </td>
    <td style="padding:10px 16px;font-size:15px;font-weight:600;
               color:#0f172a;border-bottom:1px solid #f1f5f9;">
      ${value}
    </td>
  </tr>`;
}

// ------------------------------------------------------------
// TRIAL EXPIRY WARNING TEMPLATE
// ------------------------------------------------------------
function trialExpiryWarningHtml(vendorName: string, daysLeft: number, expiresAt: string): string {
  const expiryDisplay = new Date(expiresAt).toLocaleDateString("en-NG", {
    day: "numeric", month: "long", year: "numeric"
  });

  const body = `
    <h1 style="margin:0 0 16px;font-size:26px;font-weight:700;color:#0f172a;line-height:1.2;">
      Your Free Trial Ends in ${daysLeft} Days
    </h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155;">
      Hello${vendorName ? " " + vendorName : ""},
    </p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155;">
      Your Spotlight free trial expires on <strong>${expiryDisplay}</strong>.
      Upgrade now to keep your listing active and continue reaching customers.
    </p>
    ${infoTable(infoRow("Trial Expires", expiryDisplay))}
    <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155;">
      After your trial ends, your profile will no longer be visible to customers
      until you upgrade to a paid plan.
    </p>
    ${ctaButton("Upgrade My Plan", "https://spotlightdirectories.com/getlisted.html")}
    ${alertBox(
      "Upgrading before your trial expires means zero downtime — your listing stays live without interruption.",
      "warning"
    )}
  `;

  return base(
    `Your Spotlight free trial ends in ${daysLeft} days. Upgrade to keep your listing active.`,
    body
  );
}

// ------------------------------------------------------------
// SUBSCRIPTION EXPIRY WARNING TEMPLATE
// ------------------------------------------------------------
function subscriptionExpiryWarningHtml(vendorName: string, plan: string, expiresAt: string): string {
  const planDisplay = plan
    ? plan.charAt(0).toUpperCase() + plan.slice(1)
    : "Current";
  const expiryDisplay = new Date(expiresAt).toLocaleDateString("en-NG", {
    day: "numeric", month: "long", year: "numeric"
  });

  const body = `
    <h1 style="margin:0 0 16px;font-size:26px;font-weight:700;color:#0f172a;line-height:1.2;">
      Your Subscription Is Expiring Soon
    </h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155;">
      Hello${vendorName ? " " + vendorName : ""},
    </p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155;">
      Your <strong>${planDisplay} Plan</strong> subscription expires on
      <strong>${expiryDisplay}</strong>. Renew now to keep your business
      visible on Spotlight.
    </p>
    ${infoTable(
      infoRow("Plan", planDisplay) +
      infoRow("Expiry Date", expiryDisplay)
    )}
    <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155;">
      If your subscription expires, your profile will be suspended and
      customers will not be able to find you.
    </p>
    ${ctaButton("Renew My Subscription", "https://spotlightdirectories.com/getlisted.html")}
    ${alertBox(
      "Renewing before expiry keeps your listing uninterrupted. Your existing profile, products, and reviews are preserved.",
      "warning"
    )}
  `;

  return base(
    `Your Spotlight ${planDisplay} Plan expires on ${expiryDisplay}. Renew now to stay visible.`,
    body
  );
}

// ------------------------------------------------------------
// SPONSORSHIP-AT-RISK WARNING TEMPLATE
// Sent when a vendor's subscription is about to expire while
// they still have an active sponsorship running past that date —
// the sponsorship becomes worthless the moment the listing itself
// disappears from search.
// ------------------------------------------------------------
function sponsorshipRiskWarningHtml(vendorName: string, plan: string, subExpiresAt: string, sponsorshipTier: string, sponsorshipType: string, sponsorshipExpiresAt: string): string {
  const planDisplay = plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : "Current";
  const subExpiryDisplay = new Date(subExpiresAt).toLocaleDateString("en-NG", {
    day: "numeric", month: "long", year: "numeric"
  });
  const sponsorshipExpiryDisplay = new Date(sponsorshipExpiresAt).toLocaleDateString("en-NG", {
    day: "numeric", month: "long", year: "numeric"
  });
  const tierDisplay = sponsorshipTier ? sponsorshipTier.charAt(0).toUpperCase() + sponsorshipTier.slice(1) : "";
  const typeDisplay = sponsorshipType === "business" ? "Business" : sponsorshipType === "product" ? "Product" : "Service";

  const body = `
    <h1 style="margin:0 0 16px;font-size:26px;font-weight:700;color:#0f172a;line-height:1.2;">
      Your Sponsorship Is At Risk
    </h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155;">
      Hello${vendorName ? " " + vendorName : ""},
    </p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155;">
      Your <strong>${planDisplay} Plan</strong> subscription expires on
      <strong>${subExpiryDisplay}</strong> — but your <strong>${tierDisplay} ${typeDisplay} Sponsorship</strong>
      is still active until <strong>${sponsorshipExpiryDisplay}</strong>.
    </p>
    ${infoTable(
      infoRow("Subscription Expires", subExpiryDisplay) +
      infoRow("Sponsorship Type", `${tierDisplay} ${typeDisplay}`) +
      infoRow("Sponsorship Runs Until", sponsorshipExpiryDisplay)
    )}
    <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155;">
      If your subscription expires, your entire listing is removed from search —
      which means your sponsorship will have no platform to run on for the remainder
      of its term. Renewing your subscription keeps both your listing and your
      sponsorship working as intended.
    </p>
    ${ctaButton("Renew My Subscription", "https://spotlightdirectories.com/getlisted.html")}
    ${alertBox(
      "This is separate from your sponsorship payment — your subscription and sponsorship are billed and tracked independently, and both need to stay active for your sponsorship to be worth anything.",
      "warning"
    )}
  `;

  return base(
    `Your subscription expires ${subExpiryDisplay}, but your sponsorship runs until ${sponsorshipExpiryDisplay}. Renew now to avoid wasting it.`,
    body
  );
}

// ------------------------------------------------------------
// SEND EMAIL VIA RESEND
// ------------------------------------------------------------
async function sendEmail(to: string, subject: string, html: string, resendKey: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: "Spotlight <onboarding@mail.spotlightdirectories.com>",
      to,
      subject,
      html,
    }),
  });
  return response.ok;
}

// ------------------------------------------------------------
// MAIN HANDLER
// ------------------------------------------------------------
serve(async () => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  try {
    const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_KEY     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RESEND_API_KEY   = Deno.env.get("RESEND_API_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    let trialSent = 0;
    let subscriptionSent = 0;

    // --------------------------------------------------------
    // TRIAL EXPIRY WARNINGS
    // Vendors on trial whose trial_started_at + 90 days
    // falls within the next 6-8 days
    // --------------------------------------------------------
    const { data: trialVendors } = await supabase
      .from("vendors")
      .select("id, name, email, trial_started_at")
      .eq("subscription_status", "trial")
      .eq("trial_expiry_warning_sent", false)
      .not("trial_started_at", "is", null);

    if (trialVendors) {
      for (const vendor of trialVendors) {
        const trialEnd = new Date(vendor.trial_started_at);
        trialEnd.setDate(trialEnd.getDate() + 90);

        const daysLeft = Math.round(
          (trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysLeft >= 6 && daysLeft <= 8) {
          const html = trialExpiryWarningHtml(
            vendor.name || "",
            daysLeft,
            trialEnd.toISOString()
          );

          const sent = await sendEmail(
            vendor.email,
            `Your Spotlight Free Trial Ends in ${daysLeft} Days`,
            html,
            RESEND_API_KEY
          );

          if (sent) {
            await supabase
              .from("vendors")
              .update({ trial_expiry_warning_sent: true })
              .eq("id", vendor.id);
            trialSent++;
          }
        }
      }
    }

    // --------------------------------------------------------
    // SUBSCRIPTION EXPIRY WARNINGS
    // Active paid vendors whose expires_at falls in 6-8 days
    // --------------------------------------------------------
    const { data: subVendors } = await supabase
      .from("vendors")
      .select("id, name, email, plan_tier, expires_at")
      .eq("subscription_status", "active")
      .eq("subscription_expiry_warning_sent", false)
      .not("expires_at", "is", null)
      .gte("expires_at", new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString())
      .lte("expires_at", new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000).toISOString());

    if (subVendors) {
      for (const vendor of subVendors) {
        const html = subscriptionExpiryWarningHtml(
          vendor.name || "",
          vendor.plan_tier || "",
          vendor.expires_at
        );

        const sent = await sendEmail(
          vendor.email,
          `Your Spotlight Subscription Is Expiring Soon`,
          html,
          RESEND_API_KEY
        );

        if (sent) {
          await supabase
            .from("vendors")
            .update({ subscription_expiry_warning_sent: true })
            .eq("id", vendor.id);
          subscriptionSent++;
        }
      }
    }

    // --------------------------------------------------------
    // SPONSORSHIP-AT-RISK WARNINGS
    // Active paid vendors whose subscription expires in 6-8 days
    // AND who have an active sponsorship running past that date.
    // --------------------------------------------------------
    let sponsorshipRiskSent = 0;

    const { data: atRiskVendors } = await supabase
      .from("vendors")
      .select("id, name, email, plan_tier, expires_at")
      .eq("subscription_status", "active")
      .not("expires_at", "is", null)
      .gte("expires_at", new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString())
      .lte("expires_at", new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000).toISOString());

    if (atRiskVendors) {

      for (const vendor of atRiskVendors) {

        const { data: riskSponsorship } = await supabase
          .from("vendor_sponsorships")
          .select("id, tier, sponsorship_type, expires_at, subscription_risk_warning_sent")
          .eq("vendor_id", vendor.id)
          .eq("payment_status", "active")
          .eq("subscription_risk_warning_sent", false)
          .gt("expires_at", vendor.expires_at)
          .order("expires_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!riskSponsorship) continue;

        const html = sponsorshipRiskWarningHtml(
          vendor.name || "",
          vendor.plan_tier || "",
          vendor.expires_at,
          riskSponsorship.tier,
          riskSponsorship.sponsorship_type,
          riskSponsorship.expires_at
        );

        const sent = await sendEmail(
          vendor.email,
          `Your Sponsorship Is At Risk — Subscription Expiring Soon`,
          html,
          RESEND_API_KEY
        );

        if (sent) {
          await supabase
            .from("vendor_sponsorships")
            .update({ subscription_risk_warning_sent: true })
            .eq("id", riskSponsorship.id);
          sponsorshipRiskSent++;
        }

      }

    }

    return new Response(
      JSON.stringify({
        success: true,
        trial_warnings_sent: trialSent,
        subscription_warnings_sent: subscriptionSent,
        sponsorship_risk_warnings_sent: sponsorshipRiskSent
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Expiry warning job failed", details: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
