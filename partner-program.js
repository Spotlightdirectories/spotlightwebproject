document.addEventListener("DOMContentLoaded", async () => {

  const supabase = window.supabaseClient;

  // -----------------------------
  // MOBILE MENU TOGGLE (same pattern as index.js)
  // -----------------------------
  const menuOpenBtn = document.querySelector(".menu-open");
  const menuCloseBtn = document.querySelector(".xclose");
  const navLinks = document.querySelector(".nav-links");

  if (menuOpenBtn && navLinks) {
    menuOpenBtn.addEventListener("click", () => navLinks.classList.add("open"));
  }
  if (menuCloseBtn && navLinks) {
    menuCloseBtn.addEventListener("click", () => navLinks.classList.remove("open"));
  }

  // -----------------------------
  // AUTH BUTTON
  // -----------------------------
  const authBtn = document.getElementById("authBtn");

  if (authBtn && supabase) {
    function updateAuthBtn(user) {
      if (user) {
        authBtn.textContent = "Log out";
        authBtn.href = "#";
      } else {
        authBtn.textContent = "Log in";
        authBtn.href = "login";
      }
    }
    supabase.auth.onAuthStateChange((event, session) => updateAuthBtn(session?.user || null));
    supabase.auth.getSession().then(({ data: { session } }) => updateAuthBtn(session?.user || null));
    authBtn.addEventListener("click", async (e) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        e.preventDefault();
        await supabase.auth.signOut();
        window.location.reload();
      }
    });
  }

  // -----------------------------
  // NIGERIA STATE / LGA (reuses shared nigeria-data.js
  // instead of a duplicated inline copy)
  // -----------------------------
  const stateSelect = document.getElementById("partner-state");
  const lgaSelect = document.getElementById("partner-lga");

  if (stateSelect && window.nigeriaData) {
    Object.keys(window.nigeriaData).sort().forEach(state => {
      const opt = document.createElement("option");
      opt.value = state;
      opt.textContent = state;
      stateSelect.appendChild(opt);
    });

    stateSelect.addEventListener("change", () => {
      lgaSelect.innerHTML = '<option value="" disabled selected>Select LGA</option>';
      const lgas = window.nigeriaData[stateSelect.value] || [];
      lgas.forEach(lga => {
        const opt = document.createElement("option");
        opt.value = lga;
        opt.textContent = lga;
        lgaSelect.appendChild(opt);
      });
    });
  }

  // -----------------------------
  // REFERRAL CODE CAPTURE
  // -----------------------------
  const urlParams = new URLSearchParams(window.location.search);
  const referralCode = urlParams.get("ref");
  if (referralCode) {
    localStorage.setItem("partner_referral_code", referralCode);
  }

  // -----------------------------
  // SIGNUP FORM
  // -----------------------------
  const signupForm = document.querySelector(".pp-hero .pp-form");

  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById("partner-name").value.trim();
      const email = document.getElementById("partner-email").value.trim().toLowerCase();
      const phone = document.getElementById("partner-phone").value.trim();
      const state = stateSelect.value;
      const lga = lgaSelect.value;
      const dob = document.getElementById("partner-dob").value;
      const consent = document.getElementById("partner-consent").checked;

      if (!name || !email || !phone || !state || !lga || !dob) {
        alert("Please fill in all fields.");
        return;
      }

      if (!consent) {
        alert("Please agree to the Terms and Privacy Policy to continue.");
        return;
      }

      // Age check — must be 18+
      const birthDate = new Date(dob);
      const age = Math.floor((Date.now() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
      if (age < 18) {
        alert("You must be at least 18 years old to become a partner.");
        return;
      }

      // Duplicate application check
      const { data: existing } = await supabase
        .from("partners")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (existing) {
        alert("An application with this email already exists.");
        return;
      }

      const referredBy = localStorage.getItem("partner_referral_code") || null;

      const { error: insertError } = await supabase
        .from("partners")
        .insert({
          name,
          email,
          phone,
          state,
          lga,
          date_of_birth: dob,
          status: "pending",
          referred_by_code: referredBy
        });

      if (insertError) {
        console.error("Partner application error:", insertError.message);
        alert("Something went wrong submitting your application. Please try again.");
        return;
      }

      try {
        await supabase.functions.invoke("send-email", {
          body: {
            template: "partnerApplicationReceived",
            to: email,
            data: { name }
          }
        });
      } catch (err) {
        console.error("Application received email error:", err.message);
      }

      alert("Application submitted! We'll be in touch shortly.");
      signupForm.reset();
      lgaSelect.innerHTML = '<option value="" disabled selected>Select LGA</option>';
    });
  }

  // -----------------------------
  // PASSWORD VISIBILITY TOGGLE
  // -----------------------------
  const togglePassword = document.getElementById("toggle-password");
  const passwordInput = document.getElementById("login-password");

  if (togglePassword && passwordInput) {
    togglePassword.addEventListener("click", () => {
      const isHidden = passwordInput.type === "password";
      passwordInput.type = isHidden ? "text" : "password";
      togglePassword.classList.toggle("fa-eye");
      togglePassword.classList.toggle("fa-eye-slash");
    });
  }

  // -----------------------------
  // REMEMBER ME
  // Interpretation: remembers the email address for next visit
  // (pre-fills the login form), not session persistence duration.
  // Flagging this choice clearly — if a different behavior was
  // intended (e.g. staying signed in longer), let me know.
  // -----------------------------
  const loginEmailInput = document.getElementById("login-email");
  const rememberedEmail = localStorage.getItem("partner_remembered_email");
  const rememberCheckbox = document.querySelector('input[name="remember"]');

  if (rememberedEmail && loginEmailInput) {
    loginEmailInput.value = rememberedEmail;
    if (rememberCheckbox) rememberCheckbox.checked = true;
  }

  // -----------------------------
  // LOGIN FORM
  // -----------------------------
  const loginForm = document.querySelector(".pp-login-form");

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = loginEmailInput.value.trim().toLowerCase();
      const password = passwordInput.value;
      const remember = rememberCheckbox.checked;

      if (!email || !password) {
        alert("Please enter your email and password.");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        alert("Invalid email or password.");
        return;
      }

      if (remember) {
        localStorage.setItem("partner_remembered_email", email);
      } else {
        localStorage.removeItem("partner_remembered_email");
      }

      window.location.href = "/admin/partner-dashboard";
    });
  }

});
