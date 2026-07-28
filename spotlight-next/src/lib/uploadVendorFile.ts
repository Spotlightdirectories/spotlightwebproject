// ===============================================================
// src/lib/uploadVendorFile.ts
//
// Faithful port of production's upload-utils.js — one shared
// function for every file upload on the platform. Sends the file
// to the validate-upload Edge Function (server-side type/size
// checks) which then stores it, rather than uploading straight
// from the browser to Supabase storage.
//
// Usage:
//   const { path, publicUrl } = await uploadVendorFile(file, "verification");
//
// publicUrl is null for "verification", "receipt", and
// "sponsorship_receipt" — those buckets are private, so only
// `path` is meaningful for them.
// ===============================================================

import { supabase } from "@/lib/supabase";

export type UploadCategory =
  | "product"
  | "service"
  | "gallery"
  | "cover"
  | "logo"
  | "verification"
  | "receipt"
  | "sponsorship_receipt";

export async function uploadVendorFile(
  file: File,
  category: UploadCategory
): Promise<{ path: string; publicUrl: string | null }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("You must be logged in to upload files.");
  }

  // Convert file to base64 in chunks (avoids call-stack issues on large files)
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  let binary = "";
  const chunkSize = 8192;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  const fileBase64 = btoa(binary);

  // NOTE: deliberately a raw fetch() here, not supabase.functions.invoke().
  // invoke() swallows the Edge Function's actual JSON body whenever it
  // responds with a non-2xx status — it only surfaces a generic "Edge
  // Function returned a non-2xx status code", hiding the real reason
  // (wrong file type, too large, image too small, etc.) that
  // validate-upload puts in its response body. A plain fetch() lets us
  // read that body regardless of status code, exactly like production's
  // upload-utils.js already does.
  const response = await fetch(
    "https://gyvzmktavyrevfxnwsay.supabase.co/functions/v1/validate-upload",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        category,
        fileName: file.name,
        fileBase64,
      }),
    }
  );

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.error || "Upload failed. Please try again.");
  }

  return { path: result.path, publicUrl: result.publicUrl ?? null };
}
