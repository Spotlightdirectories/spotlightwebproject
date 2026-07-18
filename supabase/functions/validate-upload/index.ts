// ===============================================================
// validate-upload
//
// Single, shared checkpoint for every file the platform accepts:
// product/service images, gallery photos, cover/logo, verification
// documents, and bank payment receipts.
//
// WHY THIS EXISTS:
// Until now, each upload point (vendordashboard.js, vendor-profile.js,
// verify-badge.js, payment.js) checked file type/size only in the
// browser, using the claimed file type and only what JavaScript could
// see client-side. That can be bypassed entirely by calling Supabase
// storage directly. This function re-checks everything server-side,
// using the file's real bytes (not just its claimed type), before
// anything reaches storage.
//
// NOTE: This function is not yet wired into the four upload points.
// That happens in Block 4 item 17 (consolidating the upload handlers).
// For now this function can be tested on its own.
// ===============================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Image } from "https://deno.land/x/imagescript@1.2.15/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ===============================================================
// RULES PER UPLOAD CATEGORY
// (matches the specs agreed in Block 4 planning)
// ===============================================================

type Rule = {
  allowedTypes: string[];
  maxBytes: number;
  minWidth?: number;
  minHeight?: number;
  resizeTo?: number; // longest side, in px — images only
  bucket: string;
  folder: string; // subfolder inside the vendor's own bucket path
  isPublic: boolean; // false for private buckets (verification docs, receipts) — no public URL exists for these
};

const RULES: Record<string, Rule> = {
  product: {
    allowedTypes: ["image/jpeg", "image/png", "image/webp"],
    maxBytes: 2 * 1024 * 1024,
    minWidth: 800,
    minHeight: 800,
    resizeTo: 1600,
    bucket: "vendor-gallery",
    folder: "products",
    isPublic: true,
  },
  service: {
    allowedTypes: ["image/jpeg", "image/png", "image/webp"],
    maxBytes: 2 * 1024 * 1024,
    minWidth: 800,
    minHeight: 800,
    resizeTo: 1600,
    bucket: "vendor-gallery",
    folder: "services",
    isPublic: true,
  },
  gallery: {
    allowedTypes: ["image/jpeg", "image/png", "image/webp"],
    maxBytes: 750 * 1024,
    resizeTo: 1200,
    bucket: "vendor-branding",
    folder: "gallery",
    isPublic: true,
  },
  cover: {
    allowedTypes: ["image/jpeg", "image/png", "image/webp"],
    maxBytes: 1024 * 1024,
    resizeTo: 1200,
    bucket: "vendor-branding",
    folder: "cover",
    isPublic: true,
  },
  logo: {
    allowedTypes: ["image/jpeg", "image/png", "image/webp"],
    maxBytes: 1024 * 1024,
    resizeTo: 1200,
    bucket: "vendor-branding",
    folder: "logo",
    isPublic: true,
  },
  verification: {
    allowedTypes: ["image/jpeg", "image/png", "application/pdf"],
    maxBytes: 300 * 1024,
    bucket: "vendor-verifications",
    folder: "documents",
    isPublic: false,
  },
  receipt: {
    allowedTypes: ["image/jpeg", "image/png", "application/pdf"],
    maxBytes: 300 * 1024,
    bucket: "payment-receipts",
    folder: "bank-receipts",
    isPublic: false,
  },
  sponsorship_receipt: {
    allowedTypes: ["image/jpeg", "image/png", "application/pdf"],
    maxBytes: 300 * 1024,
    bucket: "sponsorship-receipts",
    folder: "bank-receipts",
    isPublic: false,
  },
};

// ===============================================================
// REAL FILE TYPE DETECTION (magic bytes — not the claimed MIME type)
// ===============================================================

function detectRealType(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  if (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  ) {
    return "application/pdf";
  }
  return null;
}

function extensionFor(type: string): string {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "application/pdf") return "pdf";
  return "bin";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    // ---- AUTH CHECK ----
    // We never trust a vendorId sent from the browser. Instead we verify
    // who is actually calling (via their login token) and look up THEIR
    // OWN vendor record — so nobody can upload a file into another
    // vendor's folder just by changing an ID in the request.
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing authorization." }),
        { status: 401, headers: corsHeaders }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: userData, error: authError } = await supabase.auth.getUser(
      token
    );

    if (authError || !userData?.user) {
      return new Response(
        JSON.stringify({ success: false, error: "Not authenticated." }),
        { status: 401, headers: corsHeaders }
      );
    }

    const { data: vendorRow, error: vendorLookupError } = await supabase
      .from("vendors")
      .select("id")
      .eq("auth_user_id", userData.user.id)
      .maybeSingle();

    if (vendorLookupError || !vendorRow) {
      return new Response(
        JSON.stringify({ success: false, error: "Vendor record not found." }),
        { status: 403, headers: corsHeaders }
      );
    }

    const vendorId = vendorRow.id;

    const body = await req.json();
    const { category, fileName, fileBase64 } = body;

    if (!category || !RULES[category]) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Unknown upload category: ${category}`,
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!fileBase64) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing file data.",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const rule = RULES[category];

    // Decode base64 → raw bytes
    const bytes = Uint8Array.from(atob(fileBase64), (c) => c.charCodeAt(0));

    // ---- SIZE CHECK ----
    if (bytes.length > rule.maxBytes) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `File exceeds the ${(rule.maxBytes / 1024).toFixed(
            0
          )}KB limit for this upload type.`,
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // ---- REAL TYPE CHECK (ignores the claimed content-type entirely) ----
    const realType = detectRealType(bytes);

    if (!realType || !rule.allowedTypes.includes(realType)) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "File type not recognized or not allowed for this upload type.",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    let finalBytes = bytes;
    let finalType = realType;

    // ---- IMAGE-ONLY: dimension check + resize/compress ----
    if (realType !== "application/pdf") {
      let img;

      try {
        img = await Image.decode(bytes);
      } catch {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Could not read image file. It may be corrupted.",
          }),
          { status: 400, headers: corsHeaders }
        );
      }

      if (
        (rule.minWidth && img.width < rule.minWidth) ||
        (rule.minHeight && img.height < rule.minHeight)
      ) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Image must be at least ${rule.minWidth}x${rule.minHeight}px.`,
          }),
          { status: 400, headers: corsHeaders }
        );
      }

      if (
        rule.resizeTo &&
        (img.width > rule.resizeTo || img.height > rule.resizeTo)
      ) {
        if (img.width > img.height) {
          img.resize(rule.resizeTo, Image.RESIZE_AUTO);
        } else {
          img.resize(Image.RESIZE_AUTO, rule.resizeTo);
        }
      }

      // Re-encode as JPEG at 80% quality.
      // (WEBP encoding isn't reliably supported in the Deno edge
      // runtime today; JPEG at 80% gives an equivalent size/quality
      // result for photographic content.)
      //
      // JPEG has no transparency support. Without flattening first,
      // any transparent areas (common in PNG logos/product images)
      // default to BLACK when the encoder discards the alpha channel
      // — confirmed as the exact cause of the black-background bug.
      // Composite the image onto a solid white background first, so
      // transparent areas become white instead.
      const whiteBackground = new Image(img.width, img.height);
      whiteBackground.fill(0xffffffff); // opaque white (RGBA)
      whiteBackground.composite(img, 0, 0);

      finalBytes = await whiteBackground.encodeJPEG(80);
      finalType = "image/jpeg";
    }

    // ---- UPLOAD TO STORAGE (same service-role client used for auth check above) ----
    const ext = extensionFor(finalType);
    const safeName = (fileName || "file").replace(/[^a-zA-Z0-9.-]/g, "_");
    const path = `${vendorId}/${rule.folder}/${Date.now()}-${safeName}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(rule.bucket)
      .upload(path, finalBytes, {
        contentType: finalType,
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return new Response(
        JSON.stringify({ success: false, error: "Upload failed." }),
        { status: 500, headers: corsHeaders }
      );
    }

    const { data: publicUrlData } = rule.isPublic
      ? supabase.storage.from(rule.bucket).getPublicUrl(path)
      : { data: { publicUrl: null } };

    return new Response(
      JSON.stringify({
        success: true,
        path,
        publicUrl: publicUrlData.publicUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("validate-upload error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Unexpected server error." }),
      { status: 500, headers: corsHeaders }
    );
  }
});
