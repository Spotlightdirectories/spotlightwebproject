document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;

  const badgeType = localStorage.getItem("pendingBadgeType");

  if (!badgeType) {
    window.location.href = "getlisted.html";
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const badgeTitle = document.getElementById("badgeTitle");
  const badgeRequirements = document.getElementById("badgeRequirements");

  const grayOnly = document.querySelectorAll(".gray-only");
  const blueOnly = document.querySelectorAll(".blue-only");

  if (badgeType === "gray") {
    badgeTitle.textContent = "Gray Badge Verification";
    badgeRequirements.textContent =
      "Upload Government ID and Passport Photograph.";

    blueOnly.forEach(el => el.style.display = "none");
  }

  if (badgeType === "blue") {
    badgeTitle.textContent = "Blue Badge Verification";
    badgeRequirements.textContent =
      "Upload Government ID, CAC Certificate and Utility Bill.";

    grayOnly.forEach(el => el.style.display = "none");
  }

  const form = document.getElementById("verificationForm");
  const verifyMsg = document.getElementById("verifyMsg");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    verifyMsg.textContent = "Uploading documents...";

    const idFile = document.getElementById("idFile").files[0];
    const passportFile = document.getElementById("passportFile").files[0];
    const cacFile = document.getElementById("cacFile").files[0];
    const utilityFile = document.getElementById("utilityFile").files[0];

    const vendorId = user.id; // assuming vendor_id = auth_user_id

    const upload = async (file, path) => {
      if (!file) return null;

      const { data, error } = await supabase.storage
        .from("vendor-verifications")
        .upload(path, file);

      if (error) throw error;

      const { data: publicUrl } = supabase.storage
        .from("vendor-verifications")
        .getPublicUrl(path);

      return publicUrl.publicUrl;
    };

    try {

      const idUrl = await upload(idFile, `${vendorId}/id-${Date.now()}`);
      const passportUrl = passportFile
        ? await upload(passportFile, `${vendorId}/passport-${Date.now()}`)
        : null;

      const cacUrl = cacFile
        ? await upload(cacFile, `${vendorId}/cac-${Date.now()}`)
        : null;

      const utilityUrl = utilityFile
        ? await upload(utilityFile, `${vendorId}/utility-${Date.now()}`)
        : null;

      const { error } = await supabase
        .from("vendor_verifications")
        .insert({
          vendor_id: vendorId,
          badge_type: badgeType,
          id_url: idUrl,
          passport_url: passportUrl,
          cac_url: cacUrl,
          utility_url: utilityUrl,
          status: "pending"
        });

      if (error) throw error;

      verifyMsg.textContent =
        "Verification submitted successfully. Await admin review.";

      localStorage.removeItem("pendingBadgeType");

    } catch (err) {
      verifyMsg.textContent = "Upload failed. Try again.";
    }

  });
});
