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
// 2026-11-10 UPDATE (card thumbnails): for public photo categories
// (product, service, portfolio, gallery, cover, logo) a small copy,
// at most THUMB_SIZE px on its longest side, is also saved at
// "thumbs/<same path>" in the same bucket. Cards on the website and
// the app show that small copy instead of the full photo, which is
// several times lighter and appears almost instantly. The original is
// stored exactly as before. If making the small copy fails, the upload
// still succeeds (cards fall back to the original).
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
//
// 2026-08 UPDATE: added `partner_nin` category (Cyril's requirement:
// partner payout setup collects an uploaded NIN document, not a typed
// 11-digit number) -- owned by a `partners` row instead of a
// `vendors` row, via the new `ownerTable` rule field.
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

// Longest side of the small card copy, in px. Cards show photos at
// roughly 64-200px; 480 keeps them sharp on high-density phone screens.
const THUMB_SIZE = 480;
const THUMB_QUALITY = 78;

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
  thumbnail?: boolean; // also save a small card copy at thumbs/<path> (2026-11-10)
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
    thumbnail: true,
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
    thumbnail: true,
  },
  gallery: {
    allowedTypes: ["image/jpeg", "image/png"],
    maxBytes: 750 * 1024,
    resizeTo: 1200,
    bucket: "vendor-branding",
    folder: "gallery",
    isPublic: true,
    thumbnail: true,
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
    thumbnail: true,
  },
  cover: {
    allowedTypes: ["image/jpeg", "image/png"],
    maxBytes: 3 * 1024 * 1024,
    resizeTo: 1200,
    bucket: "vendor-branding",
    folder: "cover",
    isPublic: true,
    thumbnail: true,
  },
  logo: {
    allowedTypes: ["image/jpeg", "image/png"],
    maxBytes: 3 * 1024 * 1024,
    resizeTo: 1200,
    bucket: "vendor-branding",
    folder: "logo",
    isPublic: true,
    thumbnail: true,
  },
  verification: {
    allowedTypes: ["image/jpeg", "image/png", "application/pdf"],
    maxBytes: 4 * 1024 * 1024,
    maxPdfBytes: 2 * 1024 * 1024,
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

    const bytes = Uint8Array.from(atob(fileBase64), (c) => c.charCodeAt(0));

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
    // The processed (resized, white-backed) photo, kept so the small
    // card copy can be made from it after the original is stored.
    let processed: Image | null = null;

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

      const whiteBackground = new Image(img.width, img.height);
      whiteBackground.fill(0xffffffff);
      whiteBackground.composite(img, 0, 0);

      finalBytes = await whiteBackground.encodeJPEG(80);
      finalType = "image/jpeg";
      processed = whiteBackground;
    }

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

    // Small card copy (2026-11-10). Never blocks the upload: if it
    // fails, cards simply fall back to the original photo.
    if (rule.thumbnail && processed) {
      try {
        const thumb = processed.clone();
        if (thumb.width > THUMB_SIZE || thumb.height > THUMB_SIZE) {
          if (thumb.width > thumb.height) {
            thumb.resize(THUMB_SIZE, Image.RESIZE_AUTO);
          } else {
            thumb.resize(Image.RESIZE_AUTO, THUMB_SIZE);
          }
        }
        const thumbBytes = await thumb.encodeJPEG(THUMB_QUALITY);
        const { error: thumbError } = await supabase.storage
          .from(rule.bucket)
          .upload(`thumbs/${path}`, thumbBytes, {
            contentType: "image/jpeg",
            upsert: true,
          });
        if (thumbError) console.error("Thumbnail upload error:", thumbError);
      } catch (thumbErr) {
        console.error("Thumbnail error:", thumbErr);
      }
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
