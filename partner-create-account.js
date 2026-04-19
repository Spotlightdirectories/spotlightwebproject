document.addEventListener("DOMContentLoaded", async () => {

  const form = document.querySelector(".partner-create-form");

  const supabase = window.supabaseClient;

const params = new URLSearchParams(window.location.search);
const partnerId = params.get("partner_id");

if (!partnerId) {
  alert("Invalid partner link.");
  return;
}

const { data: partner, error } = await supabase
  .from("partners")
  .select("email")
  .eq("id", partnerId)
  .single();

if (error || !partner) {
  alert("Partner not found.");
  return;
}

const emailInput = document.getElementById("create-email");

if (!partner.email) {
  alert("No email found for this partner.");
  return;
}

emailInput.value = partner.email;

  if (!form) return;

  // ===============================
  // FORM SUBMIT
  // ===============================
let isSubmitting = false;

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (isSubmitting) return;
  isSubmitting = true;

  const submitBtn = form.querySelector("button[type='submit']");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = "Creating account...";
  }

  const supabase = window.supabaseClient;

  const email = document.getElementById("create-email").value.trim();
  const password = document.getElementById("create-password").value;
  const confirmPassword = document.getElementById("create-confirm-password").value;

  if (password !== confirmPassword) {
    alert("Passwords do not match");

    isSubmitting = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = "Create Account";
    }
    return;
  }

  const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: `${window.location.origin}/partner-program.html#login`
  }
});

  if (error) {
    alert(error.message);

    isSubmitting = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = "Create Account";
    }
    return;
  }

  const user = data?.user;

if (!user) {
  alert("Account created, but session not ready. Please verify your email and log in.");
  return;
}

    const params = new URLSearchParams(window.location.search);
    const partnerId = params.get("partner_id");

    if (!partnerId) {
      alert("Invalid or missing partner link.");

      isSubmitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = "Create Account";
      }
      return;
    }

    await supabase
      .from("partners")
      .update({ user_id: user.id })
      .eq("id", partnerId);

    alert("Account created successfully. Check your email and confirm your account before logging in.");
    window.location.href = "/partner-program.html";

});

  // ===============================
  // PASSWORD TOGGLE
  // ===============================
  const toggleCreate = document.getElementById("toggle-create-password");
  const createPassword = document.getElementById("create-password");

  if (toggleCreate) {
    toggleCreate.addEventListener("click", () => {
      createPassword.type =
        createPassword.type === "password" ? "text" : "password";
    });
  }

  const toggleConfirm = document.getElementById("toggle-confirm-password");
  const confirmPassword = document.getElementById("create-confirm-password");

  if (toggleConfirm) {
    toggleConfirm.addEventListener("click", () => {
      confirmPassword.type =
        confirmPassword.type === "password" ? "text" : "password";
    });
  }

});