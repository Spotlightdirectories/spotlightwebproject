document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;

  const badgeType = localStorage.getItem("pendingBadgeType");

  if (!badgeType) {
    window.location.href = "dashboard.html";
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
      "Gray badge builds trust. Requires Government ID and Passport photo.";
    blueOnly.forEach(el => el.style.display = "none");
  }

  if (badgeType === "blue") {
    badgeTitle.textContent = "Blue Badge Verification";
    badgeRequirements.textContent =
      "Blue badge verifies registered businesses. Requires Government ID, CAC Certificate and Utility Bill.";
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

    const upload = async (file, name) => {
      if (!file) return null;

      const path = `${user.id}/${name}-${Date.now()}`;

      const { error } = await supabase.storage
        .from("vendor-verifications")
        .upload(path, file, { upsert: true });

      if (error) throw error;

      const { data } = supabase.storage
        .from("vendor-verifications")
        .getPublicUrl(path);

      return data.publicUrl;
    };

    try {

      const idUrl = await upload(idFile, "id");
      const passportUrl = passportFile ? await upload(passportFile, "passport") : null;
      const cacUrl = cacFile ? await upload(cacFile, "cac") : null;
      const utilityUrl = utilityFile ? await upload(utilityFile, "utility") : null;

      const { error } = await supabase
        .from("vendor_verifications")
        .insert({
          vendor_id: user.id,
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

      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 1500);

    } catch (err) {
      verifyMsg.textContent = "Upload failed. Try again.";
    }

  });
});
