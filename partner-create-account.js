document.addEventListener("DOMContentLoaded", () => {

  const form = document.querySelector(".partner-create-form");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const supabase = window.supabaseClient;

    const email = document.getElementById("create-email").value.trim();
    const password = document.getElementById("create-password").value;
    const confirmPassword = document.getElementById("create-confirm-password").value;

    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });

    if (error) {
      alert(error.message);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();

if (userData?.user) {
  await supabase
    .from("partners")
    .update({ user_id: userData.user.id })
    .eq("email", userData.user.email);
}

    alert("Account created successfully. You can now log in.");

    window.location.href = "partner-program.html";
  });

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