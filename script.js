
// hamburger MENU SCRIPT

const menu = document.querySelector('nav ul');
const openBtn = document.querySelector('.menu-open');
const closeBtn = document.querySelector('.xclose');

openBtn.addEventListener('click', () => {
    menu.classList.add('open')
  })
  
  closeBtn.addEventListener('click', () => {
    menu.classList.remove('open')
  })

// END OF hamburger MENU SCRIPT


// FAQ TOGGLE SCRIPT
document.addEventListener('DOMContentLoaded', () => {
const headers = document.querySelectorAll('.accordion-header');

headers.forEach(header => {
  header.addEventListener('click', () => {

          // 1️⃣ Close all others first
      headers.forEach(h => {
        if (h !== header) {
          h.classList.remove('active');
        }
      });


     // 2️⃣ Toggle the clicked one
    header.classList.toggle('active');
    });
  });
});
// END OF FAQ TOGGLE SCRIPT

//GET LISTED PLAN TOGGLE SCRIPT

  const toggle = document.getElementById("billingToggle");
  const prices = document.querySelectorAll(".price");
  const yearlyTexts = document.querySelectorAll(".yearly");

  toggle.addEventListener("change", () => {
    const yearly = toggle.checked;

    prices.forEach(price => {
      price.textContent = yearly 
        ? price.getAttribute("data-yearly") 
        : price.getAttribute("data-monthly");
    });

    yearlyTexts.forEach(text => {
      text.style.display = yearly ? "none" : "block";
    });
  });
// END OF GET LISTED PLAN TOGGLE SCRIPT

// ADDON BILLING TOGGLE SCRIPT

//<script defer>
document.addEventListener("DOMContentLoaded", function() {
  const toggle = document.getElementById("addonBillingToggle");
  const cards = document.querySelectorAll(".addon-card");

  function updatePrices() {
    const yearly = toggle.checked;
    cards.forEach(card => {
      const basicPrice = card.querySelector(".addon-plan.addon-basic .addon-price");
      const proPrice = card.querySelector(".addon-plan.addon-pro .addon-price");

      if (yearly) {
        basicPrice.innerHTML = "₦26,000<span>/year</span>";
        proPrice.innerHTML = "₦42,000<span>/year</span>";
      } else {
        basicPrice.innerHTML = "₦3,000<span>/month</span>";
        proPrice.innerHTML = "₦4,500<span>/month</span>";
      }
    });
  }

  toggle.addEventListener("change", updatePrices);
  updatePrices();
});
//</script>
// END OF ADDON BILLING TOGGLE SCRIPT