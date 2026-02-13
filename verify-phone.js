document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    window.location.href = "login.html";
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
  "https://gyvzmktavyrevfxnwsay.supabase.co/functions/v1/send-whatsapp-otp",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      phone,
      auth_user_id: user.id
    })
  }
);


    if (!res.ok) {
      verifyMsg.textContent = "Failed to send OTP.";
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
      "https://gyvzmktavyrevfxnwsay.supabase.co/functions/v1/verify-whatsapp-otp",
    {
       method: "POST",
       headers: {
         "Content-Type": "application/json",
         "Authorization": `Bearer ${accessToken}`
      },
         body: JSON.stringify({
         auth_user_id: user.id,
         otp
       })
     }
   );


    const result = await res.json();

    if (!res.ok || !result.success) {
      verifyMsg.textContent = "Invalid or expired OTP.";
      verifyMsg.classList.remove("hidden");
      return;
    }

    // After verification → route correctly
    const selectedPlan = localStorage.getItem("selectedPlan");

    if (selectedPlan === "free") {
      window.location.href = "onboarding.html";
    } else {
      window.location.href = "payment.html";
    }
  });
});
