document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;

  const badgeType = localStorage.getItem("pendingBadgeType");

  if (!badgeType) {
    window.location.href = "vendordashboard.html";
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

  // Check if vendor already has a pending verification
  const { data: existingPending } = await supabase
    .from("vendor_verifications")
    .select("id, badge_type")
    .eq("vendor_id", vendorId)
    .eq("status", "pending")
    .maybeSingle();

  const verifyMsg = document.getElementById("verifyMsg");
  const form = document.getElementById("verificationForm");

  if (existingPending) {
    if (verifyMsg) {
      verifyMsg.textContent =
        `You already have a pending ${existingPending.badge_type} badge verification under review. Please wait for the admin to complete the review before submitting again.`;
      verifyMsg.style.color = "#dc2626";
    }
    if (form) {
      form.style.opacity = "0.4";
      form.style.pointerEvents = "none";
    }
    return;
  }
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

    const badgeTitle = document.getElementById("badgeTitle");
    document.getElementById("email").value = user.email;


  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const verifyConsent = document.getElementById("verifyConsent");

    if (verifyConsent && !verifyConsent.checked) {
      verifyMsg.textContent = "You must accept the consent terms before submitting.";
      return;
    }

    // --- REQUIRED FIELD VALIDATION ---
    let hasError = false;

    // Clear previous highlights
    document.querySelectorAll(".field-error").forEach(el => {
      el.classList.remove("field-error");
      el.style.borderColor = "";
    });
    document.querySelectorAll(".field-error-msg").forEach(el => el.remove());
    verifyMsg.textContent = "";
    verifyMsg.style.color = "";

    function markRequired(inputId, message) {
      const el = document.getElementById(inputId);
      if (!el) return;
      el.classList.add("field-error");
      el.style.borderColor = "#dc2626";
      const msg = document.createElement("p");
      msg.textContent = message || "This field is required";
      msg.className = "field-error-msg";
      msg.style.cssText = "color:#dc2626;font-size:13px;margin:4px 0 0;";
      el.parentNode.insertBefore(msg, el.nextSibling);
      hasError = true;
    }

    const applicantName = document.getElementById("applicantName").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const email = user.email;

    const idNumberField = document.getElementById("idNumber");
    const cacNumberField = document.getElementById("cacNumber");
    const idNumber = idNumberField ? idNumberField.value.trim() : null;
    const cacNumber = cacNumberField ? cacNumberField.value.trim() : null;

    const idFile = document.getElementById("idFile")?.files[0];
    const passportFile = document.getElementById("passportFile")?.files[0];
    const cacFile = document.getElementById("cacFile")?.files[0];
    const utilityFile = document.getElementById("utilityFile")?.files[0];
    const memartFile = document.getElementById("memartFile")?.files[0];
    const statusReportFile = document.getElementById("statusReportFile")?.files[0];

    if (!applicantName) markRequired("applicantName", "Full name is required");
    if (!phone) markRequired("phone", "Phone number is required");
    if (!idFile) markRequired("idFile", "Government ID is required");

    if (badgeType === "gray") {
      if (!passportFile) markRequired("passportFile", "Passport photograph is required");
    }

    if (badgeType === "blue") {
      if (!cacFile) markRequired("cacFile", "CAC Certificate is required");
      if (!utilityFile) markRequired("utilityFile", "Utility Bill is required");
      if (!memartFile) markRequired("memartFile", "MEMART is required");
      if (!statusReportFile) markRequired("statusReportFile", "CAC Status Report is required");
    }

    if (hasError) {
      verifyMsg.textContent = "Please fill in all required fields before submitting.";
      verifyMsg.style.color = "#dc2626";
      return;
    }

    verifyMsg.style.color = "";
    verifyMsg.textContent = "Uploading documents...";

    const submitBtn = document.getElementById("submitVerificationBtn") ||
      form.querySelector("button[type='submit']");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Uploading...";
    }

    // --- UPLOAD FUNCTION ---
    const upload = async (file, name) => {
      if (!file) return null;
      const path = `${user.id}/${name}-${Date.now()}`;
      const { error } = await supabase.storage
        .from("vendor-verifications")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      return path;
    };

    try {
      // --- UPLOAD ALL FILES ---
      const idUrl = await upload(idFile, "id");
      const passportUrl = await upload(passportFile, "passport");
      const cacUrl = await upload(cacFile, "cac");
      const utilityUrl = await upload(utilityFile, "utility");
      const memartUrl = await upload(memartFile, "memart");
      const statusReportUrl = await upload(statusReportFile, "status-report");

      // --- INSERT VERIFICATION RECORD ---
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

      // --- SEND ACKNOWLEDGEMENT EMAIL ---
      try {
        await fetch(
          "https://gyvzmktavyrevfxnwsay.supabase.co/functions/v1/send-email",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": window.SUPABASE_ANON_KEY
            },
            body: JSON.stringify({
              to: email,
              subject: "Verification Documents Received",
              html: EmailTemplates.badgeSubmitted({
                vendorName: applicantName,
                badgeType: badgeType
              })
            })
          }
        );
      } catch (err) {
        console.error("Badge submission email failed:", err);
      }

      verifyMsg.textContent = "Verification submitted successfully. Await admin review.";
      localStorage.removeItem("pendingBadgeType");

      setTimeout(() => {
        window.location.href = "vendordashboard.html";
      }, 1500);

    } catch (err) {
      console.error("Verification error FULL:", err);
      console.error("Error message:", err?.message);
      console.error("Error details:", err?.details);
      console.error("Error hint:", err?.hint);
      verifyMsg.textContent = "Upload failed. Please try again.";
      verifyMsg.style.color = "#dc2626";
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Verification";
      }
    }

  });
});
