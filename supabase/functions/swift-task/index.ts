import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
  "Access-Control-Max-Age":
    "86400",
};

if (req.method === "OPTIONS") {

  return new Response(
    "ok",
    {
      status: 200,
      headers: corsHeaders,
    }
  );

}

  try {

    if (req.method !== "POST") {

      return new Response(
        "Method Not Allowed",
        {
          status: 405,
          headers: corsHeaders,
        }
      );

    }

    const {
      vendorId,
      email
    } = await req.json();

    if (!vendorId || !email) {

      return new Response(
        JSON.stringify({
          error: "Missing fields"
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json",
          },
        }
      );

    }

    const supabase = createClient(
      Deno.env.get(
        "SUPABASE_URL"
      )!,
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY"
      )!
    );

    /* ===============================
    GENERATE TOKEN
    =============================== */

    const token =
      crypto.randomUUID();

    const expiresAt =
      new Date(
        Date.now() +
        1000 * 60 * 60 * 24
      ).toISOString();

    /* ===============================
    STORE TOKEN
    =============================== */

    const {
      error: tokenError
    } = await supabase
      .from(
        "email_verification_tokens"
      )
      .insert({
        vendor_id: vendorId,
        email,
        token,
        expires_at: expiresAt
      });

    if (tokenError) {

      return new Response(
        JSON.stringify(tokenError),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json",
          },
        }
      );

    }

    /* ===============================
    VERIFICATION LINK
    =============================== */

    const verifyUrl =
      `https://spotlightdirectories.com/verify-email.html?token=${token}`;

    /* ===============================
    EMAIL HTML — matches the branded
    shell used by every other Spotlight
    transactional email (email-templates.js).
    Edge Functions can't import that browser
    module directly, so the markup is
    reproduced by hand here to match exactly:
    black header (yellow "Spotlight" + white
    "Directories"), white card, black primary
    button (NOT orange — orange is reserved
    for upgrade CTAs only), muted footer.
    =============================== */

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Spotlight Directories</title>
</head>
<body style="margin:0;padding:0;background-color:#fafaf8;font-family:Arial,sans-serif;">

  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">
    Verify your email address to keep your Spotlight account secure.
  </span>

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

          <tr>
            <td style="padding:40px 40px 32px;">

              <h1 style="margin:0 0 16px;font-size:26px;font-weight:700;
                          color:#0f172a;line-height:1.2;">
                Verify Your Email
              </h1>

              <p style="margin:0 0 16px;font-size:15px;line-height:1.7;
                        color:#334155;">
                Hello,
              </p>

              <p style="margin:0 0 16px;font-size:15px;line-height:1.7;
                        color:#334155;">
                Click the button below to verify your email address and complete this step of your Spotlight profile.
              </p>

              <table cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
                <tr>
                  <td style="background:#000000;border-radius:10px;">
                    <a href="${verifyUrl}"
                       style="display:inline-block;padding:14px 28px;
                              font-size:15px;font-weight:700;
                              color:#ffffff;text-decoration:none;">
                      Verify Email
                    </a>
                  </td>
                </tr>
              </table>

              <div style="background:#dbeafe;border:1px solid #93c5fd;
                          border-radius:10px;padding:14px 18px;margin:20px 0;">
                <p style="margin:0;font-size:14px;line-height:1.6;color:#1e40af;">
                  This verification link expires in 24 hours. If you did not request this, you can safely ignore this email.
                </p>
              </div>

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
                <a href="https://spotlightdirectories.com"
                   style="color:#94a3b8;text-decoration:underline;">
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

    /* ===============================
    SEND EMAIL VIA RESEND
    =============================== */

    const resendResponse =
      await fetch(
        "https://api.resend.com/emails",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "Authorization":
              `Bearer ${Deno.env.get("RESEND_API_KEY")}`
          },

          body: JSON.stringify({
            from:
              "Spotlight <onboarding@mail.spotlightdirectories.com>",

            to: email,

            subject:
              "Verify Your Email",

            html
          }),
        }
      );

    const resendResult =
      await resendResponse.json();

    if (!resendResponse.ok) {

      return new Response(
        JSON.stringify(resendResult),
        {
          status:
            resendResponse.status,

          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json",
          },
        }
      );

    }

    return new Response(
      JSON.stringify({
        success: true
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json",
        },
      }
    );

  } catch (err) {

    return new Response(
      JSON.stringify({
        error:
          String(err)
      }),
      {
        status: 500,
        headers: {
          "Content-Type":
            "application/json",
        },
      }
    );

  }

});