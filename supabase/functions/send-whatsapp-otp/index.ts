import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {

  // 🔹 CORS HEADERS
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  // 🔹 Handle preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders
    });
  }

  try {
    const { phone, auth_user_id } = await req.json();

    if (!phone || !auth_user_id) {
      return new Response("Missing fields", {
        status: 400,
        headers: corsHeaders
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 🔹 Format Nigerian phone number
    let formattedPhone = phone.trim();

    if (formattedPhone.startsWith("0")) {
      formattedPhone = "234" + formattedPhone.slice(1);
    }

    if (!formattedPhone.startsWith("234")) {
      return new Response("Invalid phone format", {
        status: 400,
        headers: corsHeaders
      });
    }

    // 🔹 Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 5 * 60 * 1000);

    await supabase.from("phone_verifications").insert({
      auth_user_id,
      phone: formattedPhone,
      otp_code: otp,
      expires_at: expires.toISOString(),
      verified: false
    });

    // 🔹 Send WhatsApp OTP
    const termiiResponse = await fetch("https://v3.api.termii.com/api/sms/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        api_key: Deno.env.get("TERMII_API_KEY"),
        to: formattedPhone,
        from: Deno.env.get("TERMII_SENDER_ID"),
        sms: `Your Spotlight verification code is ${otp}. It expires in 5 minutes.`,
        type: "plain",
        channel: "dnd"
      })
    });

    const termiiData = await termiiResponse.json();
    console.log("Termii response:", termiiData);

if (!termiiResponse.ok || termiiData.code !== "ok") {
  return new Response(
    JSON.stringify({
      success: false,
      error: "Termii failed",
      details: termiiData
    }),
    {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    }
  );
}

return new Response(JSON.stringify({ success: true }), {
  headers: { ...corsHeaders, "Content-Type": "application/json" }
});


  } catch (err) {
    console.error("Error:", err);
    return new Response("Server error", {
      status: 500,
      headers: corsHeaders
    });
  }
});
