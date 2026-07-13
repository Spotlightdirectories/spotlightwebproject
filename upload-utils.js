// ===============================================================
// upload-utils.js
//
// One shared function for every file upload on the platform.
// Sends the file to the validate-upload Edge Function, which checks
// it server-side (real file type, size, resolution) and only then
// uploads it to storage. Replaces the old pattern of uploading
// straight from the browser to Supabase storage.
//
// Usage:
//   const { path, publicUrl } = await uploadVendorFile(file, "product");
//
// Categories: "product", "service", "gallery", "cover", "logo",
// "verification", "receipt", "sponsorship_receipt"
//
// publicUrl is null for "verification", "receipt", and
// "sponsorship_receipt" — those buckets are private, so only
// `path` is meaningful for them.
//
// Throws an Error with a user-friendly message if validation or
// upload fails — callers should wrap calls in try/catch.
// ===============================================================

async function uploadVendorFile(file, category) {
  const supabase = window.supabaseClient;

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
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + chunkSize)
    );
  }

  const fileBase64 = btoa(binary);

  const response = await fetch(
    "https://gyvzmktavyrevfxnwsay.supabase.co/functions/v1/validate-upload",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        category: category,
        fileName: file.name,
        fileBase64: fileBase64,
      }),
    }
  );

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.error || "Upload failed. Please try again.");
  }

  return { path: result.path, publicUrl: result.publicUrl };
}

window.uploadVendorFile = uploadVendorFile;
