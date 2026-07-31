// ===============================================================
// src/lib/adminSignedUrl.ts
//
// Shared helper for opening a private-bucket document from the admin
// dashboard. Previously copy-pasted verbatim into six tab files
// (PaymentsTab, SponsorshipsTab, VerificationsTab, PaymentHistoryTab,
// SponsorshipHistoryTab, VerificationHistoryTab) — consolidated here
// during the 2026-07-31 admin dashboard audit since all six copies
// were identical. Handles both a bare storage path and a legacy full
// public URL (older rows may still have the full
// `.../object/public/<bucket>/<path>` URL saved instead of just the
// path — this strips that prefix down to the path Supabase's
// `createSignedUrl` actually expects).
// ===============================================================

import { adminSupabase } from "@/lib/adminSupabase";

export async function viewSignedUrl(bucket: string, pathOrUrl: string | null): Promise<void> {
  if (!pathOrUrl) return;

  let filePath = pathOrUrl;
  const marker = `/object/public/${bucket}/`;
  if (pathOrUrl.includes(marker)) filePath = pathOrUrl.split(marker)[1];

  const { data, error } = await adminSupabase.storage.from(bucket).createSignedUrl(filePath, 3600);
  if (error || !data?.signedUrl) {
    alert("Could not generate document link. Please try again.");
    return;
  }
  window.open(data.signedUrl, "_blank");
}
