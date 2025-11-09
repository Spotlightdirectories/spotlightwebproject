// ✅ Supabase setup
//const SUPABASE_URL = "https://gyvzmktavyrevfxnwsay.supabase.co";
//const SUPABASE_ANON_KEY =
  //"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dnpta3RhdnlyZXZmeG53c2F5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NjIyNzUsImV4cCI6MjA3NjUzODI3NX0.a5LnkYZb6IlTd2PEwD-M-Cw-hQSC8lKSU1uOEjgwjRo";

//const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const params = new URLSearchParams(window.location.search);
const vendorId = params.get("id");

const vendorName = document.getElementById("vendor-name");
const vendorContent = document.getElementById("vendor-content");

(async function () {
  try {
    const { data: vendor, error } = await supabaseClient
      .from("Vendors")
      .select("*")
      .eq("id", vendorId)
      .single();

    if (error || !vendor) {
      vendorContent.innerHTML = "<p>Vendor not found.</p>";
      return;
    }

    vendorName.textContent = vendor.name;

    // ✅ Basic info (always shown)
    let html = `
      <div class="vendor-details">
        <p><strong>Category:</strong> ${vendor.category || "N/A"}</p>
        <p><strong>Address:</strong> ${vendor.address || "N/A"}</p>
        <p><strong>Phone:</strong> ${vendor.phone || "N/A"}</p>
        <p><strong>Email:</strong> ${vendor.email || "N/A"}</p>
        ${
          vendor.phone
            ? `<p><a class="whatsapp-btn" href="https://wa.me/${vendor.phone}" target="_blank">Chat on WhatsApp</a></p>`
            : ""
        }
      </div>
    `;

    // ✅ For paid plans, add more details
    if (vendor.plan && vendor.plan.toLowerCase() !== "free") {
      if (vendor.logo_url) {
        html += `<img src="${vendor.logo_url}" alt="${vendor.name} Logo" class="vendor-logo" />`;
      }

      if (vendor.description) {
        html += `<p class="vendor-description">${vendor.description}</p>`;
      }

      if (vendor.video_url) {
        html += `
          <div class="vendor-video">
            <video width="100%" controls>
              <source src="${vendor.video_url}" type="video/mp4">
              Your browser does not support the video tag.
            </video>
          </div>
        `;
      }

      if (vendor.gallery_urls && vendor.gallery_urls.length > 0) {
        html += `
          <div class="vendor-gallery">
            ${vendor.gallery_urls
              .map((img) => `<img src="${img}" class="gallery-image" />`)
              .join("")}
          </div>
        `;
      }
    } else {
      // ✅ Message for free vendors
      html += `
        <div class="upgrade-hint">
          <p>Want to showcase your profile picture, gallery, logo, and videos?</p>
          <a href="getListed.html" class="upgrade-btn">Upgrade Your Plan</a>
        </div>
      `;
    }

    vendorContent.innerHTML = html;
  } catch (err) {
    console.error(err);
    vendorContent.innerHTML =
      "<p>Something went wrong loading this vendor's page.</p>";
  }
})();

console.log("✅ Contact form script loaded");

// ✅ Contact Us Form Logic (runs only if contact form exists)

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
      contact: formData.get('contact') || null,
      role: formData.get('role') || null,
      category: formData.get('category') || null,
      message: formData.get('message')?.trim() || null,
      rating: formData.get('rating') ? parseInt(formData.get('rating'), 10) : null,
      created_at: new Date().toISOString()
    };

    // disable submit button
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    try {
      const { error } = await supabaseClient.from('feedback').insert([feedback]);
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