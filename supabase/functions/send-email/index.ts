import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import nodemailer from "https://esm.sh/nodemailer@6.9.8";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { to, subject, html } = await req.json();

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: "Missing email fields" }),
        { status: 400 }
      );
    }

    const transporter = nodemailer.createTransport({
      host: Deno.env.get("SMTP_HOST"),
      port: Number(Deno.env.get("SMTP_PORT")),
      secure: false, // MUST be false for Gmail + 587
      auth: {
        user: Deno.env.get("SMTP_USER"),
        pass: Deno.env.get("SMTP_PASS"),
      },
    });

    await transporter.sendMail({
      from: Deno.env.get("SMTP_FROM"),
      to,
      subject,
      html,
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200 }
    );
  } catch (err) {
    console.error("EMAIL ERROR:", err);

    return new Response(
      JSON.stringify({
        error: "Email failed",
        details: String(err),
      }),
      { status: 500 }
    );
  }
});
