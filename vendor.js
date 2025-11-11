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

//END OF FEEDBACK FORM LOGIC


// VENDOR ONBOARDING JS
// ---------------------------
document.addEventListener("DOMContentLoaded", () => {

  // --- Get elements ---
  const step1 = document.getElementById("step1");
  const step2 = document.getElementById("step2");
  const nextBtn = document.getElementById("nextBtn");
  const backBtn = document.getElementById("backBtn");
  const submitBtn = document.getElementById("submitBtn");
  const paymentMethods = document.getElementById("paymentMethods");
  const bankDetails = document.getElementById("bankDetails");
  const tierText = document.getElementById("selectedTierText");
  const messageBox = document.getElementById("message");
  const nextStepMessage = document.getElementById("nextStepMessage");
  const vendorForm = document.getElementById("vendorForm");

  // --- Get selected plan info from localStorage ---
  const selectedPlan = localStorage.getItem("selectedPlan") || "free";
  const selectedPrice = localStorage.getItem("selectedPrice") || "₦0";
  const billingType = localStorage.getItem("billingType") || "monthly";

  // Display plan and price
  if (tierText) {
    tierText.textContent = `${selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)} (${billingType}) - ${selectedPrice}`;
  }

  // --- Helper function to collect form data ---
  const getFormData = () => {
    return {
      name: document.getElementById("name").value.trim(),
      category: document.getElementById("category").value.trim(),
      address: document.getElementById("address").value.trim(),
      phone: document.getElementById("phone").value.trim(),
      email: document.getElementById("email").value.trim(),
      tier: selectedPlan,
      billing_type: billingType,
      price: selectedPrice,
      verification_status: "pending",
      email_verified: false,
      phone_verified: false,
      created_at: new Date()
    };
  };

  // --- Step Navigation ---
  nextBtn.addEventListener("click", async () => {
    // Validate step 1 required fields
    if (!vendorForm.checkValidity()) {
      vendorForm.reportValidity();
      return;
    }

    if (selectedPlan.toLowerCase() === "basic" || selectedPlan.toLowerCase() === "free") {
      // Free plan → submit immediately
      submitFreePlan();
    } else {
      // Paid plan → go to step 2
      step1.classList.add("ob-hidden");
      step2.classList.remove("ob-hidden");
      paymentMethods.classList.remove("ob-hidden");
    }
  });

  backBtn.addEventListener("click", () => {
    step2.classList.add("ob-hidden");
    step1.classList.remove("ob-hidden");
  });

  // --- Payment method selection ---
  paymentMethods.addEventListener("change", (e) => {
    if (e.target.name === "payment_method") {
      bankDetails.classList.toggle("ob-hidden", e.target.value !== "Bank Transfer");
    }
  });

  // --- Submit for paid plan ---
  submitBtn.addEventListener("click", () => {
    const paymentOption = document.querySelector('input[name="payment_method"]:checked');
    if (!paymentOption) {
      alert("Please select a payment method");
      return;
    }

    const formData = getFormData();
    formData.payment_method = paymentOption.value;

    // Save formData temporarily for payment page or bank transfer workflow
    localStorage.setItem("onboardingFormData", JSON.stringify(formData));

    if (paymentOption.value === "Bank Transfer") {
      // Show instructions for bank transfer
      step2.classList.add("ob-hidden");
      messageBox.classList.remove("ob-hidden");
      nextStepMessage.innerHTML = `
        Please make a transfer of <strong>${selectedPrice}</strong> to the bank account provided.
        After sending the proof of payment, your account will be verified.
      `;
    } else {
      // Card / USSD → redirect to payment page
      window.location.href = "payment.html";
    }
  });

  // --- Submit Free Plan ---
  async function submitFreePlan() {
    const data = getFormData();

    try {
      const { data: inserted, error } = await supabase
        .from("Vendors")
        .insert([data]);

      if (error) {
        alert("Error submitting form. Please try again.");
        console.error(error);
      } else {
        step1.classList.add("ob-hidden");
        messageBox.classList.remove("ob-hidden");
        nextStepMessage.textContent = "Thank you! Your free listing has been successfully submitted.";
        // Clean localStorage
        localStorage.removeItem("selectedPlan");
        localStorage.removeItem("selectedPrice");
        localStorage.removeItem("billingType");
      }
    } catch (err) {
      console.error(err);
      alert("Unexpected error. Please try again later.");
    }
  }

});

// END OF VENDOR ONBOARDING PAGE JS LOGIC

// GET LISTED PAGE SCRIPT?
// syncing with onboarding---------------------------

document.addEventListener("DOMContentLoaded", () => {

  const billingToggle = document.getElementById("billingToggle");
  const planButtons = document.querySelectorAll(".glcard .btn, .glcard .btnwhite");

  planButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault(); // prevent default anchor behavior

      // Get the parent card of the clicked button
      const card = e.target.closest(".glcard");

      // 1️⃣ Plan name from <h2>
      let planName = card.querySelector("h2").textContent.trim();
      planName = planName.toLowerCase().replace(/\s*\(free\)/i, "").trim(); // normalize

      // 2️⃣ Billing type
      const billingType = billingToggle.checked ? "yearly" : "monthly";

      // 3️⃣ Plan price from data attributes
      const priceEl = card.querySelector(".price");
      const planPrice = billingType === "yearly" ? priceEl.dataset.yearly : priceEl.dataset.monthly;

      // 4️⃣ Save everything to localStorage
      localStorage.setItem("selectedPlan", planName);
      localStorage.setItem("selectedPrice", planPrice);
      localStorage.setItem("billingType", billingType);

      // 5️⃣ Redirect to onboarding page
      window.location.href = "onboarding.html";
    });
  });

});

// END OF GET LISTED PAGE SCRIPT - SYNCING ONBOARDING?

//NIGERIA STATES AND LGAS SCRIPT
  const nigeriaData = {
    "Abia": ["Aba North","Aba South","Arochukwu","Bende","Ikwuano","Isiala Ngwa North","Isiala Ngwa South","Isuikwuato","Obi Ngwa","Ohafia","Osisioma","Ugwunagbo","Ukwa East","Ukwa West","Umuahia North","Umuahia South","Umu Nneochi"],
    "Adamawa": ["Demsa","Fufore","Ganye","Girei","Gombi","Guyuk","Hong","Jada","Lamurde","Madagali","Maiha","Mayo-Belwa","Michika","Mubi North","Mubi South","Numan","Shelleng","Song","Toungo","Yola North","Yola South"],
    "Akwa Ibom": ["Abak","Eastern Obolo","Eket","Esit-Eket","Essien Udim","Etim Ekpo","Etinan","Ibeno","Ibesikpo Asutan","Ibiono Ibom","Ika","Ikono","Ikot Abasi","Ikot Ekpene","Ini","Itu","Mbo","Mkpat-Enin","Nsit-Atai","Nsit-Ibom","Nsit-Ubium","Obot Akara","Okobo","Onna","Oron","Oruk Anam","Udung-Uko","Ukanafun","Uruan","Urue-Offong/Oruko","Uyo"],
    "Anambra": ["Aguata","Anambra East","Anambra West","Anaocha","Awka North","Awka South","Ayamelum","Dunukofia","Ekwusigo","Idemili North","Idemili South","Ihiala","Njikoka","Nnewi North","Nnewi South","Ogbaru","Onitsha North","Onitsha South","Orumba North","Orumba South","Oyi"],
    "Bauchi": ["Alkaleri","Bauchi","Bogoro","Damban","Darazo","Dass","Gamawa","Ganjuwa","Giade","Itas/Gadau","Jama'are","Katagum","Kirfi","Misau","Ningi","Shira","Tafawa Balewa","Toro","Warji","Zaki"],
    "Bayelsa": ["Brass","Ekeremor","Kolokuma/Opokuma","Nembe","Ogbia","Sagbama","Southern Ijaw","Yenagoa"],
    "Benue": ["Ado","Agatu","Apa","Buruku","Gboko","Guma","Gwer East","Gwer West","Katsina-Ala","Konshisha","Kwande","Logo","Makurdi","Obi","Ogbadibo","Ohimini","Oju","Okpokwu","Otukpo","Tarka","Ukum","Ushongo","Vandeikya"],
    "Borno": ["Abadam","Askira/Uba","Bama","Bayo","Biu","Chibok","Damboa","Dikwa","Gubio","Guzamala","Gwoza","Hawul","Jere","Kaga","Kala/Balge","Konduga","Kukawa","Kwaya Kusar","Mafa","Magumeri","Maiduguri","Marte","Mobbar","Monguno","Ngala","Nganzai","Shani"],
    "Cross River": ["Abi","Akamkpa","Akpabuyo","Bakassi","Bekwarra","Biase","Boki","Calabar Municipal","Calabar South","Etung","Ikom","Obanliku","Obubra","Obudu","Odukpani","Ogoja","Yakuur","Yala"],
    "Delta": ["Aniocha North","Aniocha South","Bomadi","Burutu","Ethiope East","Ethiope West","Ika North East","Ika South","Isoko North","Isoko South","Ndokwa East","Ndokwa West","Okpe","Oshimili North","Oshimili South","Patani","Sapele","Udu","Ughelli North","Ughelli South","Ukwuani","Uvwie","Warri North","Warri South","Warri South West"],
    "Ebonyi": ["Abakaliki","Afikpo North","Afikpo South","Ebonyi","Ezza North","Ezza South","Ikwo","Ishielu","Ivo","Izzi","Ohaozara","Ohaukwu","Onicha"],
    "Edo": ["Akoko-Edo","Egor","Esan Central","Esan North-East","Esan South-East","Esan West","Etsako Central","Etsako East","Etsako West","Igueben","Ikpoba-Okha","Orhionmwon","Oredo","Ovia North-East","Ovia South-West","Owan East","Owan West","Uhunmwonde"],
    "Ekiti": ["Ado-Ekiti","Efon","Ekiti East","Ekiti South-West","Ekiti West","Emure","Gbonyin","Ido Osi","Ijero","Ikere","Ikole","Ilejemeje","Irepodun/Ifelodun","Ise/Orun","Moba","Oye"],
    "Enugu": ["Aninri","Awgu","Enugu East","Enugu North","Enugu South","Ezeagu","Igbo Etiti","Igbo Eze North","Igbo Eze South","Isi Uzo","Nkanu East","Nkanu West","Nsukka","Oji River","Udenu","Udi","Uzo-Uwani"],
    "Gombe": ["Akko","Balanga","Billiri","Dukku","Funakaye","Gombe","Kaltungo","Kwami","Nafada","Shongom","Yamaltu/Deba"],
    "Imo": ["Aboh Mbaise","Ahiazu Mbaise","Ehime Mbano","Ezinihitte","Ideato North","Ideato South","Ihitte/Uboma","Ikeduru","Isiala Mbano","Isu","Mbaitoli","Ngor Okpala","Njaba","Nkwerre","Nwangele","Obowo","Oguta","Ohaji/Egbema","Okigwe","Onuimo","Orlu","Orsu","Oru East","Oru West","Owerri Municipal","Owerri North","Owerri West"],
    "Jigawa": ["Auyo","Babura","Biriniwa","Birnin Kudu","Buji","Dutse","Gagarawa","Garki","Gumel","Guri","Gwaram","Gwiwa","Hadejia","Jahun","Kafin Hausa","Kazaure","Kiri Kasama","Kiyawa","Maigatari","Malam Madori","Miga","Ringim","Roni","Sule Tankarkar","Taura","Yankwashi"],
    "Kaduna": ["Birnin Gwari","Chikun","Giwa","Igabi","Ikara","Jaba","Jema'a","Kachia","Kaduna North","Kaduna South","Kagarko","Kajuru","Kaura","Kauru","Kubau","Kudan","Lere","Makarfi","Sabon Gari","Sanga","Soba","Zangon Kataf","Zaria"],
    "Kano": ["Ajingi","Albasu","Bagwai","Bebeji","Bichi","Bunkure","Dala","Dambatta","Dawakin Kudu","Dawakin Tofa","Doguwa","Fagge","Gabasawa","Garko","Garun Mallam","Gaya","Gezawa","Gwale","Gwarzo","Kabo","Kano Municipal","Karaye","Kibiya","Kiru","Kumbotso","Kunchi","Kura","Madobi","Makoda","Minjibir","Nasarawa","Rano","Rimin Gado","Rogo","Shanono","Sumaila","Takai","Tarauni","Tofa","Tsanyawa","Tudun Wada","Ungogo","Warawa","Wudil"],
    "Katsina": ["Bakori","Batagarawa","Batsari","Baure","Bindawa","Charanchi","Dandume","Danja","Dan Musa","Daura","Dutsi","Dutsin Ma","Faskari","Funtua","Ingawa","Jibia","Kafur","Kaita","Kankara","Kankia","Katsina","Kurfi","Kusada","Mai’Adua","Malumfashi","Mani","Mashi","Matazu","Musawa","Rimi","Sabuwa","Safana","Sandamu","Zango"],
    "Kebbi": ["Aleiro","Arewa Dandi","Argungu","Augie","Bagudo","Birnin Kebbi","Bunza","Dandi","Fakai","Gwandu","Jega","Kalgo","Koko/Besse","Maiyama","Ngaski","Sakaba","Shanga","Suru","Wasagu/Danko","Yauri","Zuru"],
    "Kogi": ["Adavi","Ajaokuta","Ankpa","Bassa","Dekina","Ibaji","Idah","Igalamela Odolu","Ijumu","Kabba/Bunu","Kogi","Lokoja","Mopa Muro","Ofu","Ogori/Magongo","Okehi","Okene","Olamaboro","Omala","Yagba East","Yagba West"],
    "Kwara": ["Asa","Baruten","Edu","Ekiti","Ifelodun","Ilorin East","Ilorin South","Ilorin West","Irepodun","Isin","Kaiama","Moro","Offa","Oke Ero","Oyun","Pategi"],
    "Lagos": ["Agege","Ajeromi-Ifelodun","Alimosho","Amuwo-Odofin","Apapa","Badagry","Epe","Eti-Osa","Ibeju-Lekki","Ifako-Ijaiye","Ikeja","Ikorodu","Kosofe","Lagos Island","Lagos Mainland","Mushin","Ojo","Oshodi-Isolo","Shomolu","Surulere"],
    "Nasarawa": ["Akwanga","Awe","Doma","Karu","Keana","Keffi","Kokona","Lafia","Nasarawa","Nasarawa Egon","Obi","Toto","Wamba"],
    "Niger": ["Agaie","Agwara","Bida","Borgu","Bosso","Chanchaga","Edati","Gbako","Gurara","Katcha","Kontagora","Lapai","Lavun","Magama","Mariga","Mashegu","Mokwa","Muya","Paikoro","Rafi","Rijau","Shiroro","Suleja","Tafa","Wushishi"],
    "Ogun": ["Abeokuta North","Abeokuta South","Ado-Odo/Ota","Egbado North","Egbado South","Ewekoro","Ifo","Ijebu East","Ijebu North","Ijebu North East","Ijebu Ode","Ikenne","Imeko Afon","Ipokia","Obafemi Owode","Odeda","Odogbolu","Ogun Waterside","Remo North","Shagamu"],
    "Ondo": ["Akoko North-East","Akoko North-West","Akoko South-West","Akoko South-East","Akure North","Akure South","Ese Odo","Idanre","Ifedore","Ilaje","Ile Oluji/Okeigbo","Irele","Odigbo","Okitipupa","Ondo East","Ondo West","Ose","Owo"],
    "Osun": ["Atakunmosa East","Atakunmosa West","Aiyedaade","Aiyedire","Boluwaduro","Boripe","Ede North","Ede South","Egbedore","Ejigbo","Ife Central","Ife East","Ife North","Ife South","Ifedayo","Ifelodun","Ila","Ilesa East","Ilesa West","Irepodun","Irewole","Isokan","Iwo","Obokun","Odo Otin","Ola Oluwa","Olorunda","Oriade","Orolu","Osogbo"],
    "Oyo": ["Afijio","Akinyele","Atiba","Atisbo","Egbeda","Ibadan North","Ibadan North-East","Ibadan North-West","Ibadan South-East","Ibadan South-West","Ibarapa Central","Ibarapa East","Ibarapa North","Ido","Irepo","Iseyin","Itesiwaju","Iwajowa","Kajola","Lagelu","Ogbomosho North","Ogbomosho South","Ogo Oluwa","Olorunsogo","Oluyole","Ona Ara","Orelope","Ori Ire","Oyo East","Oyo West","Saki East","Saki West","Surulere"],
    "Plateau": ["Barkin Ladi","Bassa","Bokkos","Jos East","Jos North","Jos South","Kanam","Kanke","Langtang North","Langtang South","Mangu","Mikang","Pankshin","Qua'an Pan","Riyom","Shendam","Wase"],
    "Rivers": ["Abua/Odual","Ahoada East","Ahoada West","Akuku-Toru","Andoni","Asari-Toru","Bonny","Degema","Eleme","Emohua","Etche","Gokana","Ikwerre","Khana","Obio/Akpor","Ogba/Egbema/Ndoni","Ogu/Bolo","Okrika","Omuma","Opobo/Nkoro","Oyigbo","Port Harcourt","Tai"],
    "Sokoto": ["Binji","Bodinga","Dange Shuni","Gada","Goronyo","Gudu","Gwadabawa","Illela","Isa","Kebbe","Kware","Rabah","Sabon Birni","Shagari","Silame","Sokoto North","Sokoto South","Tambuwal","Tangaza","Tureta","Wamako","Wurno","Yabo"],
    "Taraba": ["Ardo Kola","Bali","Donga","Gashaka","Gassol","Ibi","Jalingo","Karim Lamido","Kumi","Lau","Sardauna","Takum","Ussa","Wukari","Yorro","Zing"],
    "Yobe": ["Bade","Bursari","Damaturu","Fika","Fune","Geidam","Gujba","Gulani","Jakusko","Karasuwa","Machina","Nangere","Nguru","Potiskum","Tarmuwa","Yunusari","Yusufari"],
    "Zamfara": ["Anka","Bakura","Birnin Magaji/Kiyaw","Bukkuyum","Bungudu","Gummi","Gusau","Kaura Namoda","Maradun","Maru","Shinkafi","Talata Mafara","Chafe","Zurmi"],
    "FCT": ["Abaji","Bwari","Gwagwalada","Kuje","Kwali","Municipal Area Council"]
  };

  const stateSelect = document.getElementById("state");
  const lgaSelect = document.getElementById("lga");

  Object.keys(nigeriaData).forEach(state => {
    const option = document.createElement("option");
    option.value = state;
    option.textContent = state;
    stateSelect.appendChild(option);
  });

  stateSelect.addEventListener("change", () => {
    const selectedState = stateSelect.value;
    lgaSelect.innerHTML = "<option value=''>Select LGA</option>";
    if (nigeriaData[selectedState]) {
      nigeriaData[selectedState].forEach(lga => {
        const option = document.createElement("option");
        option.value = lga;
        option.textContent = lga;
        lgaSelect.appendChild(option);
      });
    }
  });