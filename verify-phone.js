document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    window.location.href = "login";
    return;
  }

  const phoneForm = document.getElementById("phoneForm");
  const otpForm = document.getElementById("otpForm");
  const verifyMsg = document.getElementById("verifyMsg");

  // ===============================
  // SEND OTP
  // ===============================
  phoneForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const phone = document.getElementById("phoneInput").value.trim();

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session.access_token;

    const res = await fetch(
      "https://gyvzmktavyrevfxnwsay.supabase.co/functions/v1/send-sms-otp",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify({ phone })
      }
    );

    const result = await res.json();

    if (!res.ok || !result.success) {
      verifyMsg.textContent = result.message || "Failed to send OTP.";
      verifyMsg.classList.remove("hidden");
      return;
    }

    phoneForm.classList.add("hidden");
    otpForm.classList.remove("hidden");
  });

  // ===============================
  // VERIFY OTP
  // ===============================
  otpForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const otp = document.getElementById("otpInput").value.trim();

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session.access_token;

    const res = await fetch(
      "https://gyvzmktavyrevfxnwsay.supabase.co/functions/v1/verify-sms-otp",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify({ otp })
      }
    );

    const result = await res.json();

    if (!res.ok || !result.success) {
      verifyMsg.textContent = result.message || "Invalid or expired OTP.";
      verifyMsg.classList.remove("hidden");
      return;
    }

    // Route after verification
    const selectedPlan = localStorage.getItem("selectedPlan");

   if (selectedPlan === "free") {
     window.location.replace("onboarding");
     return;
   }

     window.location.replace("payment");

  });
});
