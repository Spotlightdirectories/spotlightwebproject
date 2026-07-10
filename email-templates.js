// ============================================================
// SPOTLIGHT DIRECTORIES — EMAIL TEMPLATES
// email-templates.js
//
// All transactional email templates in one place.
// Each function accepts relevant data and returns
// a fully branded HTML string ready to pass to
// the send-email Edge Function.
//
// USAGE:
//   const html = EmailTemplates.paymentApproved({ vendorName, plan, spotId, expiresAt });
//   await sendEmail({ to: email, subject: "Payment Approved", html });
//
// BRAND COLOURS:
//   Primary yellow:  #e6c200
//   Coal black:      #000000
//   Orange CTA:      #f97316  (upgrade only)
//   Background:      #fafaf8
//   Surface:         #ffffff
//   Body text:       #334155
//   Muted text:      #64748b
// ============================================================

const EmailTemplates = (() => {

  // ------------------------------------------------------------
  // BASE LAYOUT
  // Wraps every email in the Spotlight branded shell.
  // ------------------------------------------------------------
  function base({ preheader = "", body = "" }) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Spotlight Directories</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#fafaf8;font-family:Arial,sans-serif;">

  <!-- PREHEADER (hidden preview text in inbox) -->
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${preheader}
  </span>

  <!-- OUTER WRAPPER -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background-color:#fafaf8;padding:40px 16px;">
    <tr>
      <td align="center">

        <!-- EMAIL CARD -->
        <table width="600" cellpadding="0" cellspacing="0" border="0"
          style="max-width:600px;width:100%;background:#ffffff;
                 border-radius:16px;overflow:hidden;
                 box-shadow:0 4px 16px rgba(0,0,0,0.08);">

          <!-- HEADER -->
          <tr>
            <td style="background:#000000;padding:28px 40px;text-align:left;">
              <span style="font-size:24px;font-weight:700;color:#e6c200;
                           letter-spacing:-0.5px;">
                Spotlight
              </span>
              <span style="font-size:24px;font-weight:700;color:#ffffff;
                           letter-spacing:-0.5px;">
                Directories
              </span>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding:40px 40px 32px;">
              ${body}
            </td>
          </tr>

          <!-- DIVIDER -->
          <tr>
            <td style="padding:0 40px;">
              <div style="height:1px;background:#e5e7eb;"></div>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding:24px 40px;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;">
                Spotlight Directories &mdash; Helping Nigerian businesses get found.
              </p>
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                &copy; ${new Date().getFullYear()} Spotlight Digital Services Ltd. All rights reserved.
              </p>
              <p style="margin:8px 0 0;font-size:12px;color:#94a3b8;">
                <a href="https://spotlightdirectories.com"
                   style="color:#94a3b8;text-decoration:underline;">
                  spotlightdirectories.com
                </a>
              </p>
            </td>
          </tr>

        </table>
        <!-- END EMAIL CARD -->

      </td>
    </tr>
  </table>
  <!-- END OUTER WRAPPER -->

</body>
</html>`;
  }

  // ------------------------------------------------------------
  // REUSABLE COMPONENTS
  // ------------------------------------------------------------

  function heading(text) {
    return `<h1 style="margin:0 0 16px;font-size:26px;font-weight:700;
                        color:#0f172a;line-height:1.2;">${text}</h1>`;
  }

  function greeting(name) {
    return paragraph(`Hello${name ? " " + name : " there"},`);
  }

  function paragraph(text) {
    return `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;
                       color:#334155;">${text}</p>`;
  }

  function infoRow(label, value) {
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

  function infoTable(rows) {
    return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
      style="background:#f8fafc;border-radius:12px;
             overflow:hidden;margin:20px 0;border:1px solid #e5e7eb;">
      <tbody>
        ${rows}
      </tbody>
    </table>`;
  }

  function primaryButton(label, url) {
    return `
    <table cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
      <tr>
        <td style="background:#000000;border-radius:10px;">
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

  function ctaButton(label, url) {
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

  function alertBox(text, type = "info") {
    const colours = {
      info:    { bg: "#dbeafe", border: "#93c5fd", text: "#1e40af" },
      success: { bg: "#dcfce7", border: "#86efac", text: "#166534" },
      warning: { bg: "#fef3c7", border: "#fcd34d", text: "#92400e" },
      error:   { bg: "#fef2f2", border: "#fca5a5", text: "#991b1b" },
    };
    const c = colours[type] || colours.info;
    return `
    <div style="background:${c.bg};border:1px solid ${c.border};
                border-radius:10px;padding:14px 18px;margin:20px 0;">
      <p style="margin:0;font-size:14px;line-height:1.6;color:${c.text};">
        ${text}
      </p>
    </div>`;
  }

  // ============================================================
  // EMAIL 1 — PAYMENT APPROVED
  // Triggered: Admin approves a bank transfer in admin dashboard
  // Improvement: now includes SPOT ID, plan name, expiry date
  // ============================================================
  function paymentApproved({ vendorName = "", plan = "", billingType = "", spotId = "", expiresAt = "" }) {
    const planDisplay = plan
      ? plan.charAt(0).toUpperCase() + plan.slice(1)
      : "—";
    const expiryDisplay = expiresAt
      ? new Date(expiresAt).toLocaleDateString("en-NG", {
          day: "numeric", month: "long", year: "numeric"
        })
      : "—";

    const body = `
      ${heading("Payment Confirmed ✓")}
      ${greeting(vendorName)}
      ${paragraph("Your bank transfer has been reviewed and approved. Your Spotlight subscription is now active.")}
      ${infoTable(
        infoRow("Plan", planDisplay) +
        infoRow("Billing", billingType ? billingType.charAt(0).toUpperCase() + billingType.slice(1) : "—") +
        (spotId ? infoRow("Your SPOT ID", spotId) : "") +
        infoRow("Valid Until", expiryDisplay)
      )}
      ${paragraph("You can now complete your profile, add your listings, and start getting discovered by customers.")}
      ${primaryButton("Go to My Dashboard", "https://spotlightdirectories.com/login.html")}
      ${alertBox("Your SPOT ID is your unique business identifier on Spotlight. Keep it safe — you may need it when contacting support.", "info")}
    `;
    return base({
      preheader: "Your Spotlight payment has been approved. Your listing is now active.",
      body
    });
  }

  // ============================================================
  // EMAIL 2 — PAYMENT REJECTED
  // Triggered: Admin rejects a bank transfer
  // ============================================================
  function paymentRejected({ vendorName = "", reason = "" }) {
    const body = `
      ${heading("Payment Could Not Be Verified")}
      ${greeting(vendorName)}
      ${paragraph("We reviewed your bank transfer but were unable to verify it at this time.")}
      ${reason ? infoTable(infoRow("Reason", reason)) : ""}
      ${paragraph("Please check the details and try again. If you believe this is an error, please contact us.")}
      ${primaryButton("Try Again", "https://spotlightdirectories.com/payment.html")}
      ${alertBox("Make sure your transfer receipt matches the exact amount and account details provided.", "warning")}
    `;
    return base({
      preheader: "There was an issue with your Spotlight payment. Please review and try again.",
      body
    });
  }

  // ============================================================
  // EMAIL 3 — BADGE VERIFICATION APPROVED
  // Triggered: Admin approves a gray or blue badge application
  // ============================================================
  function badgeApproved({ vendorName = "", badgeType = "" }) {
    const badgeDisplay = badgeType
      ? badgeType.charAt(0).toUpperCase() + badgeType.slice(1)
      : "Verified";
    const badgeColour = badgeType === "blue" ? "#2563eb" : "#64748b";

    const body = `
      ${heading("Verification Approved ✓")}
      ${greeting(vendorName)}
      ${paragraph("Congratulations! Your verification documents have been reviewed and approved.")}
      ${infoTable(infoRow("Badge Awarded", `<span style="color:${badgeColour};font-weight:700;">${badgeDisplay} Badge</span>`))}
      ${paragraph("Your business listing now displays your verification badge, giving customers greater confidence in your business.")}
      ${primaryButton("View My Profile", "https://spotlightdirectories.com/login.html")}
      ${alertBox("Your badge is now visible to all visitors viewing your profile on Spotlight.", "success")}
    `;
    return base({
      preheader: `Your ${badgeDisplay} Badge verification has been approved on Spotlight.`,
      body
    });
  }

  // ============================================================
  // EMAIL 4 — BADGE VERIFICATION REJECTED
  // Triggered: Admin rejects a badge application
  // ============================================================
  function badgeRejected({ vendorName = "", badgeType = "", reason = "" }) {
    const badgeDisplay = badgeType
      ? badgeType.charAt(0).toUpperCase() + badgeType.slice(1)
      : "";

    const body = `
      ${heading("Verification Not Approved")}
      ${greeting(vendorName)}
      ${paragraph(`We reviewed your${badgeDisplay ? " " + badgeDisplay + " Badge" : ""} verification submission but were unable to approve it at this time.`)}
      ${reason ? infoTable(infoRow("Reason", reason)) : ""}
      ${paragraph("Please review your documents and submit again. Make sure all documents are clear, current, and match the requirements for your chosen badge tier.")}
      ${primaryButton("Resubmit Documents", "https://spotlightdirectories.com/login.html")}
      ${alertBox("Gray Badge requires: Government ID + Passport Photograph.<br/>Blue Badge requires: Government ID + CAC Certificate + Utility Bill + MEMART + CAC Status Report.", "info")}
    `;
    return base({
      preheader: "Your Spotlight verification could not be approved. Please review and resubmit.",
      body
    });
  }

  // ============================================================
  // EMAIL 5 — PARTNER APPLICATION APPROVED
  // Triggered: Admin approves a partner application
  // ============================================================
  function partnerApproved({ partnerName = "", referralCode = "", vendorReferralLink = "", partnerReferralLink = "", inductionLink = "", createAccountLink = "" }) {
    const body = `
      ${heading("Welcome to the Spotlight Partner Programme 🎉")}
      ${greeting(partnerName)}
      ${paragraph("Your partner application has been reviewed and approved. You are now an official Spotlight Partner.")}
      ${infoTable(
        infoRow("Your Referral Code", `<strong style="font-size:18px;letter-spacing:2px;">${referralCode}</strong>`) +
        infoRow("Vendor Referral Link", `<a href="${vendorReferralLink}" style="color:#2563eb;">${vendorReferralLink}</a>`) +
        infoRow("Partner Referral Link", `<a href="${partnerReferralLink}" style="color:#2563eb;">${partnerReferralLink}</a>`)
      )}
      ${paragraph("Share your Vendor Referral Link with businesses to help them get listed on Spotlight. You earn a commission for every vendor who subscribes through your link.")}
      ${primaryButton("Create My Partner Account", createAccountLink || `https://spotlightdirectories.com/partner-create-account.html`)}
      ${inductionLink ? `<p style="margin:0 0 16px;font-size:14px;color:#64748b;">
        New to the programme? <a href="${inductionLink}" style="color:#2563eb;text-decoration:underline;">Read the partner induction guide</a> to get started.
      </p>` : ""}
      ${alertBox("Keep your referral code private. It is your unique identifier for earning commissions.", "warning")}
    `;
    return base({
      preheader: "You have been approved as a Spotlight Partner. Here are your referral details.",
      body
    });
  }

  // ============================================================
  // EMAIL 5a — PARTNER APPLICATION RECEIVED
  // Triggered: Partner submits application form
  // ============================================================
  function partnerApplicationReceived({ partnerName = "" }) {
    const body = `
      ${heading("Application Received")}
      ${greeting(partnerName)}
      ${paragraph("Thank you for applying to the Spotlight Partner Programme. We have received your application and our team will review it shortly.")}
      ${infoTable(infoRow("Status", "Under Review"))}
      ${paragraph("We will notify you by email once a decision has been made. This typically takes 2–5 business days.")}
      ${alertBox("You do not need to resubmit. If you have any questions, contact us at support@spotlightdirectories.com.", "info")}
    `;
    return base({
      preheader: "We have received your Spotlight Partner application. We will be in touch shortly.",
      body
    });
  }

  // ============================================================
  // EMAIL 5b — PARTNER ACCOUNT CREATED
  // Triggered: Partner completes account creation
  // ============================================================
  function partnerAccountCreated({ partnerName = "", referralCode = "" }) {
    const body = `
      ${heading("Your Partner Account is Ready 🎉")}
      ${greeting(partnerName)}
      ${paragraph("Your Spotlight Partner account has been created successfully. You can now log in to your partner dashboard and start earning commissions.")}
      ${referralCode ? infoTable(infoRow("Your Referral Code", `<strong style="font-size:18px;letter-spacing:2px;">${referralCode}</strong>`)) : ""}
      ${paragraph("Share your referral link with businesses to help them get listed on Spotlight. You earn a commission every time a vendor subscribes through your link.")}
      ${primaryButton("Log In to Partner Dashboard", "https://spotlightdirectories.com/partner-program.html")}
      ${alertBox("Your referral code is unique to you. Share it with businesses to start earning commissions immediately.", "info")}
    `;
    return base({
      preheader: "Your Spotlight Partner account is ready. Log in to start earning.",
      body
    });
  }

  // ============================================================
  // EMAIL — BADGE REVOKED
  // Triggered: Super admin revokes a vendor's badge
  // ============================================================
  function badgeRevoked({ vendorName = "", badgeType = "", reason = "" }) {
    const badgeDisplay = badgeType
      ? badgeType.charAt(0).toUpperCase() + badgeType.slice(1)
      : "";

    const body = `
      ${heading("Verification Badge Revoked")}
      ${greeting(vendorName)}
      ${paragraph(`Your ${badgeDisplay ? badgeDisplay + " Badge" : "verification badge"} has been revoked by the Spotlight team following a review of your account.`)}
      ${reason ? infoTable(infoRow("Reason", reason)) : ""}
      ${paragraph("If you believe this decision was made in error, please contact us at support@spotlightdirectories.com with supporting documentation.")}
      ${alertBox("Your business profile will no longer display a verification badge. You may reapply for verification once the issue has been resolved.", "warning")}
    `;
    return base({
      preheader: "An important update regarding your Spotlight verification badge.",
      body
    });
  }

  // ============================================================
  // EMAIL 6 — PARTNER APPLICATION REJECTED
  // Triggered: Admin rejects a partner application
  // ============================================================
  function partnerRejected({ partnerName = "", reason = "" }) {
    const body = `
      ${heading("Application Update")}
      ${greeting(partnerName)}
      ${paragraph("Thank you for applying to the Spotlight Partner Programme. After reviewing your application, we are unable to approve it at this time.")}
      ${reason ? infoTable(infoRow("Reason", reason)) : ""}
      ${paragraph("You are welcome to address the issue and reapply. We look forward to potentially working with you in the future.")}
      ${primaryButton("Learn About the Programme", "https://spotlightdirectories.com/partner-program.html")}
    `;
    return base({
      preheader: "An update on your Spotlight Partner application.",
      body
    });
  }

  // ============================================================
  // EMAIL 7 — WELCOME ON SIGNUP
  // Triggered: Vendor creates an account (Phase 3 new email)
  // ============================================================
  function welcomeVendor({ vendorName = "", spotId = "", plan = "" }) {
    const planDisplay = plan
      ? plan.charAt(0).toUpperCase() + plan.slice(1)
      : "Free Trial";

    const body = `
      ${heading("Welcome to Spotlight Directories 🎉")}
      ${greeting(vendorName)}
      ${paragraph("Your business is now on Spotlight — Nigeria's discovery platform connecting businesses with customers.")}
      ${spotId ? infoTable(
        infoRow("Your SPOT ID", spotId) +
        infoRow("Current Plan", planDisplay)
      ) : ""}
      ${paragraph("Here is how to get the most from your free trial:")}
      <ol style="margin:0 0 16px;padding-left:20px;font-size:15px;
                 line-height:1.9;color:#334155;">
        <li>Complete your business profile — name, address, description, photo</li>
        <li>Add your listings with clear images and prices</li>
        <li>Set your exact business location so customers can find you</li>
        <li>Apply for verification to build trust with customers</li>
      </ol>
      ${primaryButton("Complete My Profile", "https://spotlightdirectories.com/login.html")}
      ${alertBox("Your 90-day free trial starts today. You can upgrade to a paid plan at any time to unlock more features.", "info")}
    `;
    return base({
      preheader: "Welcome to Spotlight Directories. Let us help your business get found.",
      body
    });
  }

  // ============================================================
  // EMAIL 8 — BADGE SUBMISSION ACKNOWLEDGEMENT
  // Triggered: Vendor submits verification documents (Phase 3 new email)
  // ============================================================
  function badgeSubmitted({ vendorName = "", badgeType = "" }) {
    const badgeDisplay = badgeType
      ? badgeType.charAt(0).toUpperCase() + badgeType.slice(1)
      : "";

    const body = `
      ${heading("Documents Received")}
      ${greeting(vendorName)}
      ${paragraph(`We have received your${badgeDisplay ? " " + badgeDisplay + " Badge" : ""} verification submission. Our team will review your documents and get back to you within 2–5 business days.`)}
      ${infoTable(infoRow("Status", "Under Review"))}
      ${paragraph("You do not need to resubmit. We will send you an email once the review is complete.")}
      ${alertBox("If you need to make a correction or have questions, please contact us at support@spotlightdirectories.com.", "info")}
    `;
    return base({
      preheader: "We have received your verification documents. Review is in progress.",
      body
    });
  }

  // ============================================================
  // EMAIL 9 — TRIAL EXPIRY WARNING
  // Triggered: pg_cron job, 7 days before trial ends (Phase 3 new email)
  // ============================================================
  function trialExpiryWarning({ vendorName = "", daysLeft = 7, expiresAt = "" }) {
    const expiryDisplay = expiresAt
      ? new Date(expiresAt).toLocaleDateString("en-NG", {
          day: "numeric", month: "long", year: "numeric"
        })
      : "soon";

    const body = `
      ${heading(`Your Free Trial Ends in ${daysLeft} Days`)}
      ${greeting(vendorName)}
      ${paragraph(`Your Spotlight free trial expires on <strong>${expiryDisplay}</strong>. Upgrade now to keep your listing active and continue reaching customers.`)}
      ${infoTable(infoRow("Trial Expires", expiryDisplay))}
      ${paragraph("After your trial ends, your profile will no longer be visible to customers until you upgrade to a paid plan.")}
      ${ctaButton("Upgrade My Plan", "https://spotlightdirectories.com/getlisted.html")}
      ${alertBox("Upgrading before your trial expires means zero downtime — your listing stays live without interruption.", "warning")}
    `;
    return base({
      preheader: `Your Spotlight free trial ends in ${daysLeft} days. Upgrade to keep your listing active.`,
      body
    });
  }

  // ============================================================
  // EMAIL 10 — SUBSCRIPTION EXPIRY WARNING
  // Triggered: pg_cron job, before paid plan expires (Phase 3 new email)
  // ============================================================
  function subscriptionExpiryWarning({ vendorName = "", plan = "", expiresAt = "" }) {
    const planDisplay = plan
      ? plan.charAt(0).toUpperCase() + plan.slice(1)
      : "Current";
    const expiryDisplay = expiresAt
      ? new Date(expiresAt).toLocaleDateString("en-NG", {
          day: "numeric", month: "long", year: "numeric"
        })
      : "soon";

    const body = `
      ${heading("Your Subscription Is Expiring Soon")}
      ${greeting(vendorName)}
      ${paragraph(`Your <strong>${planDisplay} Plan</strong> subscription expires on <strong>${expiryDisplay}</strong>. Renew now to keep your business visible on Spotlight.`)}
      ${infoTable(
        infoRow("Plan", planDisplay) +
        infoRow("Expiry Date", expiryDisplay)
      )}
      ${paragraph("If your subscription expires, your profile will be suspended and customers will not be able to find you.")}
      ${ctaButton("Renew My Subscription", "https://spotlightdirectories.com/getlisted.html")}
      ${alertBox("Renewing before expiry keeps your listing uninterrupted. Your existing profile, products, and reviews are preserved.", "warning")}
    `;
    return base({
      preheader: `Your Spotlight ${planDisplay} Plan expires on ${expiryDisplay}. Renew now to stay visible.`,
      body
    });
  }

  // ============================================================
  // EMAIL 11 — ADMIN STAFF INVITATION
  // Triggered: Super admin invites a new staff member who doesn't
  // already have an account (admin_invitations table)
  // ============================================================
  function adminInvitation({ role = "", signupLink = "" }) {
    const roleLabels = {
      super_admin: "Super Admin",
      admin: "Admin",
      finance_admin: "Finance Admin",
      verification_admin: "Verification Admin"
    };
    const roleDisplay = roleLabels[role] || role;

    const body = `
      ${heading("You've Been Invited to Spotlight Admin")}
      ${paragraph("Hello,")}
      ${paragraph(`You have been invited to join the Spotlight Directories admin team as a <strong>${roleDisplay}</strong>.`)}
      ${infoTable(infoRow("Role", roleDisplay))}
      ${paragraph("To get started, create your admin account using the button below. Your role is applied automatically the first time you log in — no further steps needed.")}
      ${primaryButton("Create My Admin Account", signupLink)}
      ${alertBox("This invitation was sent by a Spotlight super admin. If you were not expecting this, you can safely ignore this email.", "info")}
    `;
    return base({
      preheader: `You've been invited to join Spotlight as a ${roleDisplay}.`,
      body
    });
  }

  // ------------------------------------------------------------
  // PUBLIC API
  // ------------------------------------------------------------
  return {
    paymentApproved,
    paymentRejected,
    badgeApproved,
    badgeRejected,
    badgeRevoked,
    partnerApplicationReceived,
    partnerApproved,
    partnerAccountCreated,
    partnerRejected,
    welcomeVendor,
    badgeSubmitted,
    trialExpiryWarning,
    subscriptionExpiryWarning,
    adminInvitation
  };

})();
