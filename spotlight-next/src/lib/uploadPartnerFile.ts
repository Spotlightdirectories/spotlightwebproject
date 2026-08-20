// ===============================================================
// src/lib/uploadPartnerFile.ts
//
// Partner-side sibling of uploadVendorFile.ts. Identical wire
// protocol (same validate-upload Edge Function, same base64 +
// fetch() pattern), but authenticates via partnerSupabase's own
// session instead of the vendor/customer default client — partners
// have an isolated Supabase client (src/lib/partnerSupabase.ts) so
// a partner login doesn't collide with a vendor/customer session in
// the same browser. Kept as a separate file rather than editing
// uploadVendorFile.ts, since that helper is used widely across the
// vendor/customer side and shouldn't be touched for a partner-only
// need.
//
// Usage:
//   const { path } = await uploadPartnerFile(file, "partner_nin");
//
// publicUrl is always null for "partner_nin" — partner-verifications
// is a private bucket, so only `path` is meaningful.
// ===============================================================

import { partnerSupabase } from "@/lib/partnerSupabase";

export type PartnerUploadCategory = "partner_nin";

export async function uploadPartnerFile(
  file: File,
  category: PartnerUploadCategory
): Promise<{ path: string; publicUrl: string | null }> {
  const {
    data: { session },
  } = await partnerSupabase.auth.getSession();

  if (!session) {
    throw new Error("You must be logged in to upload files.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  let binary = "";
  const chunkSize = 8192;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  const fileBase64 = btoa(binary);

  // Deliberately a raw fetch(), not supabase.functions.invoke() — see
  // uploadVendorFile.ts for why (invoke() swallows the real error body
  // on non-2xx responses).
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
