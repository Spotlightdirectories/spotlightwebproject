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
// UPDATE (this revision): dropped "image/webp" from the accepted
// types for every category that goes through the decode/resize step
// (product, service, gallery, cover, logo). The imagescript library
// used below to decode+resize+recompress images has unreliable WEBP
// decode support -- a structurally valid WEBP file (confirmed valid
// by the real-bytes magic-number check) could still fail at
// Image.decode(), surfacing as "Could not read image file. It may be
// corrupted." even though the file was never corrupted at all. Every
// image is re-encoded as JPEG on the way out regardless of input
// type, so accepting WEBP as input only ever mattered for decode
// compatibility -- removing it here is the actual fix, not a
// workaround. JPEG/PNG decode is solid in this library, so those
// remain the only accepted image formats.
//
// PRIOR UPDATE: verification/receipt/sponsorship_receipt categories
// previously capped the ORIGINAL upload at 300KB, checked BEFORE any
// server-side compression -- meaning a normal phone photo of an ID or
// utility bill (typically 1-6MB straight out of the camera) was
// rejected before this function ever got a chance to shrink it.
// Vendors have no practical way to resize a photo themselves, so that
// cap effectively blocked most real uploads. Fixed by: (1) accepting
// a much larger original for these categories, (2) resizing +
// recompressing them exactly like product/service images already do,
// so the FINAL stored file still ends up small. PDFs bypass that
// resize/recompress step entirely (they're stored as-is), so they
// keep their own, tighter cap via the new `maxPdfBytes` rule field.
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
// (matches the specs agreed in Block 4 planning, revised for
// verification/receipt/sponsorship_receipt per founder decision, and
// with WEBP dropped from image-processing categories per the WEBP
// decode-reliability fix above)
// ===============================================================

type Rule = {
  allowedTypes: string[];
  maxBytes: number; // cap for images (and for PDFs, when maxPdfBytes isn't set)
  maxPdfBytes?: number; // separate, tighter cap for PDFs — they are stored as-is, never compressed
  minWidth?: number;
  minHeight?: number;
  resizeTo?: number; // longest side, in px — images only
  bucket: string;
  folder: string; // subfolder inside the owner's own bucket path
  isPublic: boolean; // false for private buckets (verification docs, receipts) — no public URL exists for these
  ownerTable?: "vendors" | "partners"; // which table owns the uploader — defaults to "vendors" (every category except partner_nin)
};

const RULES: Record<string, Rule> = {
  product: {
    allowedTypes: ["image/jpeg", "image/png"],
    maxBytes: 2 * 1024 * 1024,
    minWidth: 800,
    minHeight: 800,
    resizeTo: 1600,
    bucket: "vendor-gallery",
    folder: "products",
    isPublic: true,
  },
  service: {
    allowedTypes: ["image/jpeg", "image/png"],
    maxBytes: 2 * 1024 * 1024,
    minWidth: 800,
    minHeight: 800,
    resizeTo: 1600,
    bucket: "vendor-gallery",
    folder: "services",
    isPublic: true,
  },
  gallery: {
    allowedTypes: ["image/jpeg", "image/png"],
    maxBytes: 750 * 1024,
    resizeTo: 1200,
    bucket: "vendor-branding",
    folder: "gallery",
    isPublic: true,
  },
  portfolio: {
    allowedTypes: ["image/jpeg", "image/png"],
    maxBytes: 2 * 1024 * 1024,
    minWidth: 800,
    minHeight: 800,
    resizeTo: 1600,
    bucket: "vendor-gallery",
    folder: "portfolio",
    isPublic: true,
  },
  cover: {
    // Original upload cap raised 1MB -> 3MB: vendors have no practical way
    // to shrink a photo themselves before uploading, and every image is
    // resized to 1200px + recompressed as JPEG-80 below regardless of
    // input size, so the FINAL stored file stays small either way (see
    // formatSize-based error text and the resize/recompress step further
    // down). Same reasoning already applied to verification/receipt.
    allowedTypes: ["image/jpeg", "image/png"],
    maxBytes: 3 * 1024 * 1024,
    resizeTo: 1200,
    bucket: "vendor-branding",
    folder: "cover",
    isPublic: true,
  },
  logo: {
    allowedTypes: ["image/jpeg", "image/png"],
    maxBytes: 3 * 1024 * 1024,
    resizeTo: 1200,
    bucket: "vendor-branding",
    folder: "logo",
    isPublic: true,
  },
  verification: {
    allowedTypes: ["image/jpeg", "image/png", "application/pdf"],
    maxBytes: 4 * 1024 * 1024, // accepted as-is from the phone; resized+recompressed below
    maxPdfBytes: 2 * 1024 * 1024, // PDFs are stored as-is — no server-side compression
    resizeTo: 1600,
    bucket: "vendor-verifications",
    folder: "documents",
    isPublic: false,
  },
  receipt: {
    allowedTypes: ["image/jpeg", "image/png", "application/pdf"],
    maxBytes: 4 * 1024 * 1024,
    maxPdfBytes: 2 * 1024 * 1024,
    resizeTo: 1600,
    bucket: "payment-receipts",
    folder: "bank-receipts",
    isPublic: false,
  },
  sponsorship_receipt: {
    allowedTypes: ["image/jpeg", "image/png", "application/pdf"],
    maxBytes: 4 * 1024 * 1024,
    maxPdfBytes: 2 * 1024 * 1024,
    resizeTo: 1600,
    bucket: "sponsorship-receipts",
    folder: "bank-receipts",
    isPublic: false,
  },
  // 2026-08 addition, per Cyril: partner payout setup collects a NIN
  // document (not a typed number) — same identity-document handling
  // already established for vendor "verification", just owned by a
  // `partners` row instead of a `vendors` row.
  partner_nin: {
    allowedTypes: ["image/jpeg", "image/png", "application/pdf"],
    maxBytes: 4 * 1024 * 1024,
    maxPdfBytes: 2 * 1024 * 1024,
    resizeTo: 1600,
    bucket: "partner-verifications",
    folder: "nin",
    isPublic: false,
    ownerTable: "partners",
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

// Human-readable size for error messages — KB below 1MB, MB above,
// so a 4MB limit reads as "4MB" instead of "4096KB".
function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${Number.isInteger(mb) ? mb.toFixed(0) : mb.toFixed(1)}MB`;
  }
  return `${(bytes / 1024).toFixed(0)}KB`;
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

    // ---- OWNER LOOKUP ----
    // Every category except partner_nin belongs to a vendor (looked
    // up by auth_user_id, as this always did). partner_nin belongs to
    // a partner instead (looked up by user_id) -- same "never trust a
    // caller-supplied id" principle, just against the other table.
    let ownerId: string;

    if (rule.ownerTable === "partners") {
      const { data: partnerRow, error: partnerLookupError } = await supabase
        .from("partners")
        .select("id")
        .eq("user_id", userData.user.id)
        .maybeSingle();

      if (partnerLookupError || !partnerRow) {
        return new Response(
          JSON.stringify({ success: false, error: "Partner record not found." }),
          { status: 403, headers: corsHeaders }
        );
      }
      ownerId = partnerRow.id;
    } else {
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
      ownerId = vendorRow.id;
    }

    // Decode base64 → raw bytes
    const bytes = Uint8Array.from(atob(fileBase64), (c) => c.charCodeAt(0));

    // ---- REAL TYPE CHECK (ignores the claimed content-type entirely) ----
    // Done before the size check now, since PDFs and images can have
    // different size caps (PDFs aren't compressed below, images are).
    const realType = detectRealType(bytes);

    if (!realType || !rule.allowedTypes.includes(realType)) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            realType === "image/webp"
              ? "WEBP is not supported for this upload — please use JPG or PNG."
              : "File type not recognized or not allowed for this upload type.",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // ---- SIZE CHECK ----
    const effectiveMaxBytes =
      realType === "application/pdf" && rule.maxPdfBytes
        ? rule.maxPdfBytes
        : rule.maxBytes;

    if (bytes.length > effectiveMaxBytes) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `File exceeds the ${formatSize(
            effectiveMaxBytes
          )} limit for this upload type.`,
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
            error: "Could not read image file. Please try a different JPG or PNG.",
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
    const path = `${ownerId}/${rule.folder}/${Date.now()}-${safeName}.${ext}`;

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
