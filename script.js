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



