


const toggle = document.getElementById("toggle-password");
const password = document.getElementById("login-password");

toggle.addEventListener("click", () => {
  const type = password.getAttribute("type") === "password" ? "text" : "password";
  password.setAttribute("type", type);

  toggle.textContent = type === "password" ? "visibility" : "visibility_off";
});