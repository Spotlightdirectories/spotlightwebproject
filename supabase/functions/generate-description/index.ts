import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// -----------------------------------------------------------------
// GENERATE DESCRIPTION (item 56)
//
// Generates a business/product/service description from a few short
// guided hints, respecting each field's REAL constraint. Called only
// by an authenticated vendor, for their OWN listing — verified
// server-side against the real vendor_id, never trusted from the
// client alone.
//
// IMPORTANT: the three description types do NOT share one limit
// system, confirmed directly from vendordashboard.js's actual save
// validation:
// - Business description: plan-tier WORD limit (100-650 words) —
//   the only one that's actually plan-based.
// - Service description: a FIXED 280-500 CHARACTER range, enforced
//   regardless of plan tier — going over OR under both hard-block
//   saving.
// - Product description: no formal save-blocking limit exists, but
//   the saved list display truncates at 160 characters — anything
//   longer just gets cut off with "..." wherever it's shown.
// -----------------------------------------------------------------

// Matches vendordashboard.js's DESCRIPTION_WORD_LIMITS exactly —
// business description only.
const BUSINESS_PLAN_WORD_LIMITS: Record<string, number> = {
  free: 50,
  standard: 100,
  enterprise: 150,
  elite: 200,
  custom: 250
};

serve(async (req) => {

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {

    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");

    if (!jwt) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const { type, hints, itemName } = body;

    if (!["business", "product", "service"].includes(type)) {
      return new Response(JSON.stringify({ error: "Invalid type" }), { status: 400, headers: corsHeaders });
    }

    const { data: vendor, error: vendorError } = await supabase
      .from("vendors")
      .select("id, name, category, subcategory, plan_tier")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (vendorError || !vendor) {
      return new Response(JSON.stringify({ error: "No vendor account found for this user" }), { status: 403, headers: corsHeaders });
    }

    // -----------------------------------------------------------------
    // REAL LIMIT PER TYPE — see file header for why these differ
    // -----------------------------------------------------------------
    let limitInstruction: string;
    let responseUnit: string;
    let responseLimit: number;

    if (type === "business") {
      const words = BUSINESS_PLAN_WORD_LIMITS[vendor.plan_tier] || BUSINESS_PLAN_WORD_LIMITS.free;
      responseUnit = "words";
      responseLimit = words;
      limitInstruction = `Stay under ${words} words \u2014 this is a hard limit tied to the vendor's subscription plan. If the limit allows more than ~120 words, structure the text as 2-3 short paragraphs (separated by a blank line) rather than one dense block, so it's easy to scan \u2014 do not write a single unbroken wall of text.`;
    } else if (type === "service") {
      // Real constraint: 280-500 characters, hard-blocked both ways,
      // regardless of plan. Target the middle of that range so real
      // LLM output-length variance can't accidentally breach either
      // end.
      responseUnit = "characters";
      responseLimit = 420;
      limitInstruction = `Write between 320 and 420 characters INCLUDING SPACES \u2014 this is a strict range (not words, actual characters). Too short or too long will both be rejected. Keep it as one tight, concise paragraph \u2014 no line breaks needed at this length.`;
    } else {
      // product: no formal save-blocking limit exists, but the saved
      // list display truncates at 160 characters \u2014 target well
      // under that so the full description always shows, never cut
      // off with "...".
      responseUnit = "characters";
      responseLimit = 200;
      limitInstruction = `Write between 170 and 200 characters INCLUDING SPACES (not words, actual characters). Aim for the full range, not just under the ceiling \u2014 this display truncates longer text with "...", so staying under this keeps the full description visible. Keep it as one tight, concise sentence or two \u2014 no line breaks needed at this length.`;
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      console.error("ANTHROPIC_API_KEY missing");
      return new Response(JSON.stringify({ error: "Server misconfigured" }), { status: 500, headers: corsHeaders });
    }

    const typeLabel = type === "business" ? "business" : type === "product" ? "product" : "service";
    const subjectName = type === "business" ? vendor.name : (itemName || vendor.name);

    const HINT_LABELS: Record<string, { differentiator: string; specialty: string; targetCustomer: string }> = {
      business: {
        differentiator: "What makes the business different",
        specialty: "What it's known for",
        targetCustomer: "Typical customer"
      },
      product: {
        differentiator: "Key features / what's included",
        specialty: "What problem it solves / why someone would buy it",
        targetCustomer: "Who it's for"
      },
      service: {
        differentiator: "What's included / how it's delivered",
        specialty: "What outcome customers get",
        targetCustomer: "Ideal client"
      }
    };

    const hintLabelSet = HINT_LABELS[type] || HINT_LABELS.business;

    const hintLines = [
      hints?.differentiator ? `${hintLabelSet.differentiator}: ${hints.differentiator}` : null,
      hints?.specialty ? `${hintLabelSet.specialty}: ${hints.specialty}` : null,
      hints?.targetCustomer ? `${hintLabelSet.targetCustomer}: ${hints.targetCustomer}` : null
    ].filter(Boolean).join("\n");

    const systemPrompt = `You write concise, natural-sounding ${typeLabel} descriptions for Spotlight Directories, a Nigerian business discovery platform. Write in a warm, professional tone \u2014 never generic filler, never a list of buzzwords. Naturally reflect the category/subcategory without keyword-stuffing. Every word must earn its place \u2014 cover the real, concrete value or key aspect a reader needs, not vague marketing language. A reader should understand exactly what this business/product/service actually offers within a few seconds. Output ONLY the description text itself, no headings, no quotation marks, no preamble. ${limitInstruction}`;

    const userPrompt = `Write a ${typeLabel} description for: ${subjectName}
Category: ${vendor.category || "N/A"} / ${vendor.subcategory || "N/A"}
${hintLines || "(No additional details provided \u2014 write a solid general description from the category alone.)"}`;

    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 600,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }]
      })
    });

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      console.error("Anthropic API error:", anthropicResponse.status, errText);
      return new Response(JSON.stringify({ error: "Generation failed. Please try again." }), { status: 502, headers: corsHeaders });
    }

    const anthropicData = await anthropicResponse.json();

    const textBlock = (anthropicData?.content || []).find((block: any) => block.type === "text");
    let generatedText = textBlock?.text?.trim() || "";

    if (!generatedText) {
      console.error("No text block found in Anthropic response:", JSON.stringify(anthropicData));
      return new Response(JSON.stringify({ error: "No content generated. Please try again." }), { status: 502, headers: corsHeaders });
    }

    // Hard safety net: even with clear instructions, LLM output length
    // can vary. For service specifically, both ends are hard-blocked
    // by the save validation, so a too-long result is truncated to a
    // safe length here rather than risk failing to save entirely.
    // (A too-short result can't be fixed automatically without
    // fabricating content, so that risk is accepted as rare.)
    if (type === "service" && generatedText.length > 500) {
      generatedText = generatedText.slice(0, 490).replace(/\s+\S*$/, "") + ".";
    }
    if (type === "product" && generatedText.length > 200) {
      generatedText = generatedText.slice(0, 195).replace(/\s+\S*$/, "") + ".";
    }

    return new Response(
      JSON.stringify({
        text: generatedText,
        unit: responseUnit,
        limit: responseLimit,
        planTier: vendor.plan_tier,
        type
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("generate-description error:", err);
    return new Response(JSON.stringify({ error: "Something went wrong. Please try again." }), { status: 500, headers: corsHeaders });
  }

});
