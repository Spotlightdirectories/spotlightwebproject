const menu = document.querySelector('nav ul');
const openBtn = document.querySelector('.menu-open');
const closeBtn = document.querySelector('.xclose');

openBtn.addEventListener('click', () => {
    menu.classList.add('open')
  })
  
  closeBtn.addEventListener('click', () => {
    menu.classList.remove('open')
  })

// Open/close when hamburger is clicked
// menuOpen.addEventListener("click", (e) => {
 // e.preventDefault(); // prevent jumping to top
// menu.classList.toggle("active");
//});

// Close when any link inside the menu is clicked
//document.querySelectorAll("nav ul li a").forEach((link) => {
//  link.addEventListener("click", () => {
  //  menu.classList.remove("active");
 // });
//});

// Prevent flash on resize
//window.addEventListener('resize', () => {
  // Hide menu instantly during resize
  //menu.style.visibility = 'hidden';

  // Clear previous timer
  //clearTimeout(resizeTimer);

  // Restore visibility after resize stops (200ms)
  //resizeTimer = setTimeout(() => {
    //menu.style.visibility = '';
  //}, 200);
//});

//FEEDBACK FORM


// FAQ accordion behaviour
document.querySelectorAll('.faq-item .question').forEach(q => {
q.addEventListener('click', () => toggleFaq(q.parentElement));
q.addEventListener('keydown', (e) => { if(e.key==='Enter' || e.key===' ') { e.preventDefault(); toggleFaq(q.parentElement); } });
});
function toggleFaq(item){
const open = item.classList.contains('open');
// close all
document.querySelectorAll('.faq-item.open').forEach(i=>i.classList.remove('open'));
if(!open) item.classList.add('open');
}


// Feedback form: client-side handling for demo. Replace with actual endpoint.
const form = document.getElementById('feedbackForm');
const result = document.getElementById('result');
form.addEventListener('submit', (e)=>{
e.preventDefault();
const data = new FormData(form);
const payload = Object.fromEntries(data.entries());


// basic validation
if(!payload.message || payload.message.trim().length < 10){
showResult('Please provide more details in your feedback (at least 10 characters).','error');
return;
}


// TODO: replace fetch URL with your real backend or form provider endpoint
// Example: fetch('https://yourapi.example/feedback', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)})
// For demo, we mimic success
showResult('✅ Thank you for your feedback! Our team will review it and get back to you if follow-up is needed.','success');
form.reset();
});


function showResult(msg, type){
result.style.display='block';
result.textContent = msg;
if(type==='success') result.className='success'; else result.className='full';
window.scrollTo({top: result.getBoundingClientRect().top + window.scrollY - 80, behavior:'smooth'});
}

// Clear button
document.getElementById('clearBtn').addEventListener('click', ()=>{ form.reset(); result.style.display='none'; });

//FAQ Accordion
//const headers = document.querySelectorAll(".accordion-header");

//headers.forEach(header => {
  //const panel = header.nextElementSibling; // move outside click for performance

  //header.addEventListener("click", () => {
    //const isActive = header.classList.toggle("active");

    //if (isActive) {
      //panel.style.maxHeight = panel.scrollHeight + "px";
     // panel.style.padding = "1rem"; // apply padding on expand
    //} else {
      //panel.style.maxHeight = "0";
      //panel.style.padding = "0 1rem"; // reset padding on collapse
    //}
  //});
//});


// GET LISTE PAGE: Toggle between monthly/annual pricing

const toggle = document.getElementById('billingToggle');
const prices = document.querySelectorAll('.price');

toggle.addEventListener('change', () => {
  prices.forEach(price => {
    if (toggle.checked) {
      price.textContent = price.getAttribute('data-yearly');
    } else {
      price.textContent = price.getAttribute('data-monthly');
    }
  });
});