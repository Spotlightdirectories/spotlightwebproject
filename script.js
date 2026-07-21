// ============================
// 1️⃣ Initialize Supabase
// ============================

/* global window */
// supabase setup moved to its own file: supabase-client.js
const supabaseClient = window.supabaseClient;

// Connection verified via supabase-client.js


// ===============================
// CONTACT FORM LOGIC
// ===============================

// showAlert function
function showAlert(message, type = "success") {
  const alertBox = document.getElementById("customAlert");

  if (!alertBox) {
    alert(message);
    return;
  }

  alertBox.textContent = message;

  alertBox.style.backgroundColor = type === "error" ? "#c0392b" : "#27ae60";
  alertBox.style.color = "#fff";

  alertBox.style.display = "block";
  alertBox.style.opacity = "1";
  alertBox.style.transform = "translate(-50%, 0)";

  setTimeout(() => {
    alertBox.style.opacity = "0";
    setTimeout(() => {
      alertBox.style.display = "none";
    }, 250);
  }, 3000);
}


// Contact form submission
document.addEventListener("DOMContentLoaded", () => {

  const contactForm = document.getElementById("contactForm");

  if (!contactForm) return;

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

});


// ===============================
// FEEDBACK FORM LOGIC
// ===============================

document.addEventListener('DOMContentLoaded', () => {

  const form = document.getElementById('feedbackForm');
  const resultBox = document.getElementById('result');
  const clearBtn = document.getElementById('clearBtn');

  if (!form) return;

  form.addEventListener('submit', async (e) => {

    e.preventDefault();

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

    const submitBtn = form.querySelector('button[type="submit"]');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    try {

      const { error } = await supabaseClient
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

  clearBtn?.addEventListener('click', () => {

    form.reset();
    resultBox.style.display = 'none';

  });

});


// ===============================
// GET LISTED PLAN TOGGLE
// ===============================

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


// ===============================
// AUTH NAV
// Handled by script2.js via authBtn pattern.
// loginLink / logoutLink pattern removed — no longer used on any page.
// ===============================


document.addEventListener("DOMContentLoaded", () => {

  const accordions = document.querySelectorAll(".accordion-header");

  accordions.forEach(header => {
    header.addEventListener("click", () => {

      accordions.forEach(item => {
        if (item !== header) {
          item.classList.remove("active");
          item.nextElementSibling.style.maxHeight = null;
        }
      });

      header.classList.toggle("active");

      const panel = header.nextElementSibling;

      if (panel.style.maxHeight) {
        panel.style.maxHeight = null;
      } else {
        panel.style.maxHeight = panel.scrollHeight + "px";
      }

    });
  });

});