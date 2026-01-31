// ============================
// 1️⃣ Initialize Supabase
// ============================

//supabase set up moved to its own file: supabase-client.js

const supabaseClient = window.supabaseClient;

// ✅ Test Supabase connection
   (async() => {
    try {
      const { data, error } = await supabaseClient.from("vendors").select("*").limit(1);
      if (error) console.error("❌ Supabase connection failed:", error.message);
      else console.log("✅ Supabase connected! Sample:", data);
    } catch (err) {
      console.error("⚠️ Supabase test error:", err);
    }
  })();


//MAIN DOM WRAPPER

document.addEventListener('DOMContentLoaded', async () => {
  console.log("✅ Page scripts initialized successfully.");

// HAMBURGER MENU SCRIPT

  const menu = document.querySelector('nav ul');
  const openBtn = document.querySelector('.menu-open');
  const closeBtn = document.querySelector('.xclose');

  if (openBtn && closeBtn && menu) {
    openBtn.addEventListener('click', () => menu.classList.add('open'));
    
    closeBtn.addEventListener('click', () => menu.classList.remove('open'));
   }

// END OF hamburger MENU SCRIPT


// FAQ TOGGLE SCRIPT
const headers = document.querySelectorAll('.accordion-header');

headers.forEach(header => {
  header.addEventListener('click', () => {

          // 1️⃣ Close all others first
      headers.forEach(h => {
        if (h !== header) h.classList.remove('active');
      });

     // 2️⃣ Toggle the clicked one
    header.classList.toggle('active');
    });
  });
   });

// END OF FAQ TOGGLE SCRIPT

// ✅ CONTACT US LOGIC (runs only if contact form exists)

// showAlert function — put this near the top of your JS file
function showAlert(message, type = "success") {
  const alertBox = document.getElementById("customAlert");
  if (!alertBox) {
    // Fallback to native alert if the element is missing
    alert(message);
    return;
  }

  alertBox.textContent = message;
  // Style by type
  alertBox.style.backgroundColor = type === "error" ? "#c0392b" : "#27ae60";
  alertBox.style.color = "#fff";

  // Show with small slide-down effect
  alertBox.style.display = "block";
  alertBox.style.opacity = "1";
  alertBox.style.transform = "translate(-50%, 0)";

  // Hide after 3 seconds
  setTimeout(() => {
    alertBox.style.opacity = "0";
    // small delay to allow opacity transition to finish
    setTimeout(() => {
      alertBox.style.display = "none";
    }, 250);
  }, 3000);
}

// Main form logic
document.addEventListener("DOMContentLoaded", () => {
  const contactForm = document.getElementById("contactForm");

  if (contactForm) {
    contactForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById("name").value.trim();
      const email = document.getElementById("email").value.trim();
      const phone = document.getElementById("phone").value.trim();
      const state = document.getElementById("state").value.trim();
      const message = document.getElementById("message").value.trim();

      if (!name || !email || !phone || !state || !message) {
        showAlert("⚠️ Please fill all fields before submitting.", "error");
        return;
      }

      try {
        const { error } = await supabaseClient
          .from("contact_messages")
          .insert([{ name, email, phone, state, message }]);

        if (error) {
          console.error("Supabase Insert Error:", error);
          showAlert("❌ Error sending your message. Please try again later.", "error");
          return;
        }

        contactForm.reset();
        showAlert("✅ Message sent successfully. Thank you for contacting us!", "success");
      } catch (err) {
        console.error("Unexpected Error:", err);
        showAlert("⚠️ Unexpected error. Please try again.", "error");
      }
    });
  }
});
//END OF CONTACT FORM LOGIC

//BEGINING OF FEEDBACK FORM LOGIC

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('feedbackForm');
  const resultBox = document.getElementById('result');
  const clearBtn = document.getElementById('clearBtn');

  if (!form) return; // exit if no form on page

  // --- Submit Feedback ---
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); // prevent normal form submission
    resultBox.style.display = 'none';

    const formData = new FormData(form);
    const feedback = {
  contact: formData.get('contact'),
  role: formData.get('role'),
  category: formData.get('category'),
  message: formData.get('message').trim(),
  rating: formData.get('rating')
    ? parseInt(formData.get('rating'), 10)
    : null
};


    // disable submit button
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    console.log('SUPABASE URL:', window.supabaseClient.supabaseUrl);

    try {
      const { error } = await window.supabaseClient
  .from('feedback')
  .insert([feedback]);

      if (error) throw error;

      form.reset();
      resultBox.textContent = '✅ Thank you for your feedback!';
      resultBox.style.color = 'green';
    } catch (err) {
      console.error('Feedback submission failed:', err);
      resultBox.textContent = '❌ Sorry, something went wrong. Please try again.';
      resultBox.style.color = 'red';
    } finally {
      resultBox.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Feedback';
    }
  });

  // --- Clear button ---
  clearBtn?.addEventListener('click', () => {
    form.reset();
    resultBox.style.display = 'none';
  });
});

//END OF FEEDBACK FORM LOGIC



//GET LISTED PLAN TOGGLE SCRIPT

  const billingToggle = document.getElementById("billingToggle");
  const prices = document.querySelectorAll(".price");
  const yearlyTexts = document.querySelectorAll(".yearly");

  if (billingToggle) {
  billingToggle.addEventListener("change", () => {
    const yearly = billingToggle.checked;

    prices.forEach(price => {
      price.textContent = yearly 
        ? price.getAttribute("data-yearly") 
        : price.getAttribute("data-monthly");
    });

    yearlyTexts.forEach(text => {
      text.style.display = yearly ? "none" : "block";
    });
  });
}
// END OF GET LISTED PLAN TOGGLE SCRIPT

// ADDON BILLING TOGGLE SCRIPT

  const addonToggle = document.getElementById("addonBillingToggle");
  const addonCards = document.querySelectorAll(".addon-card");

  if (addonToggle && addonCards.length > 0) {
  function updateAddonPrices() {
    const yearly = addonToggle.checked;
    addonCards.forEach(card => {
      const basicPrice = card.querySelector(".addon-plan.addon-basic .addon-price");
      const proPrice = card.querySelector(".addon-plan.addon-pro .addon-price");
   
    if (basicPrice && proPrice) {
      if (yearly) {
        basicPrice.innerHTML = "₦26,000<span>/year</span>";
        proPrice.innerHTML = "₦42,000<span>/year</span>";
      } else {
        basicPrice.innerHTML = "₦3,000<span>/month</span>";
        proPrice.innerHTML = "₦4,500<span>/month</span>";
      }
    }
    });
  }

  addonToggle.addEventListener("change", updateAddonPrices);
  updateAddonPrices();
}
// END OF ADDON BILLING TOGGLE SCRIPT

// ===============================
// AUTH-AWARE NAV (LOGIN / LOGOUT)
// ===============================
document.addEventListener("DOMContentLoaded", async () => {
  if (!window.supabaseClient) return;

  const supabase = window.supabaseClient;

  const loginLink = document.getElementById("loginLink");
  const logoutLink = document.getElementById("logoutLink");
  const logoutBtn = document.getElementById("logoutBtn");

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    // Logged in
    loginLink?.classList.add("hidden");
    logoutLink?.classList.remove("hidden");
  } else {
    // Logged out
    loginLink?.classList.remove("hidden");
    logoutLink?.classList.add("hidden");
  }

  logoutBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    await supabase.auth.signOut();
    window.location.href = "index.html";
  });
});



  


