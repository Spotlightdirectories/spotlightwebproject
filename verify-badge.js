document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;

  const badgeType = localStorage.getItem("pendingBadgeType");

  if (!badgeType) {
    window.location.href = "dashboard";
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    window.location.href = "login";
    return;
  }

  const { data: vendorRow, error: vendorLookupError } = await supabase
     .from("vendors")
     .select("id")
     .eq("auth_user_id", user.id)
     .single();

  if (vendorLookupError || !vendorRow) {
      verifyMsg.textContent = "Vendor record not found.";
      return;
   }

  const vendorId = vendorRow.id;

  const badgeTitle = document.getElementById("badgeTitle");
  const badgeRequirements = document.getElementById("badgeRequirements");
  const applicantNameField = document.getElementById("applicantName");

  const grayOnly = document.querySelectorAll(".gray-only");
  const blueOnly = document.querySelectorAll(".blue-only");

  if (badgeType === "gray") {
    badgeTitle.textContent = "Gray Badge Verification";
    badgeRequirements.textContent =
      "Gray badge builds trust. Requires Government ID and Passport photo.";
    blueOnly.forEach(el => el.style.display = "none");
    applicantNameField.placeholder = "Name must match the Government ID";
  }

  if (badgeType === "blue") {
    badgeTitle.textContent = "Blue Badge Verification";
    badgeRequirements.textContent =
      "Blue badge verifies registered businesses. Requires Government ID, CAC Certificate, Mermat, Status Report and Utility Bill.";
    grayOnly.forEach(el => el.style.display = "none");

    applicantNameField.placeholder =
      "Name (must be a Director or Shareholder in the CAC registration)";
   }

    const form = document.getElementById("verificationForm");
    const verifyMsg = document.getElementById("verifyMsg");
    document.getElementById("email").value = user.email;


  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const verifyConsent =
      document.getElementById("verifyConsent");

    if (verifyConsent && !verifyConsent.checked) {
      verifyMsg.textContent =
         "You must accept the consent terms before submitting.";
       return;
    }

    verifyMsg.textContent = "Uploading documents...";

    const applicantName = document.getElementById("applicantName").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const email = user.email;
    
    const idNumberField = document.getElementById("idNumber");
    const cacNumberField = document.getElementById("cacNumber");

    const idNumber = idNumberField ? idNumberField.value.trim() : null;
    const cacNumber = cacNumberField ? cacNumberField.value.trim() : null;

    const idFile = document.getElementById("idFile").files[0];
    const passportFile = document.getElementById("passportFile").files[0];
    const cacFile = document.getElementById("cacFile").files[0];
    const utilityFile = document.getElementById("utilityFile").files[0];
    const memartFile = document.getElementById("memartFile")?.files[0];
    const statusReportFile = document.getElementById("statusReportFile")?.files[0];

    const upload = async (file, name) => {
      if (!file) return null;

      const path = `${user.id}/${name}-${Date.now()}`;

      const { error } = await supabase.storage
        .from("vendor-verifications")
        .upload(path, file, { upsert: true });

      if (error) throw error;

      // Store the file path only — not a public URL.
      // The bucket is private. Admins generate signed URLs
      // on demand when reviewing verification documents.
      return path;
    };

    try {

  const { error } = await supabase
    .from("vendor_verifications")
    .insert({
      vendor_id: vendorId,
      badge_type: badgeType,
      applicant_name: applicantName,
      phone: phone,
      email: email,
      id_number: idNumber,
      cac_number: cacNumber,
      id_url: idUrl,
      passport_photo_url: passportUrl,
      cac_url: cacUrl,
      utility_url: utilityUrl,
      memart_url: memartUrl,
      status_report_url: statusReportUrl,
      status: "pending",
      consent_accepted: true,
      consent_accepted_at: new Date().toISOString(),
      consent_text_version: "v1"
    });

  if (error) throw error;

  verifyMsg.textContent =
    "Verification submitted successfully. Await admin review.";

  localStorage.removeItem("pendingBadgeType");

  setTimeout(() => {
    window.location.href = "dashboard";
  }, 1500);

} catch (err) {
  console.error("Verification error FULL:", err);
  console.error("Error message:", err?.message);
  console.error("Error details:", err?.details);
  console.error("Error hint:", err?.hint);

  verifyMsg.textContent = "Upload failed. Check console.";
}

  });
});
