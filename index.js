document.addEventListener("DOMContentLoaded", () => {

  // -----------------------------
  // MOBILE MENU TOGGLE
  // -----------------------------
  const menuOpenBtn = document.querySelector(".menu-open");
  const menuCloseBtn = document.querySelector(".xclose");
  const navLinks = document.querySelector(".nav-links");

  if (menuOpenBtn && navLinks) {
    menuOpenBtn.addEventListener("click", () => {
      navLinks.classList.add("open");
    });
  }

  if (menuCloseBtn && navLinks) {
    menuCloseBtn.addEventListener("click", () => {
      navLinks.classList.remove("open");
    });
  }

  // -----------------------------
  // AUTH BUTTON — Log in / Log out based on session,
  // same pattern as script2.js
  // -----------------------------
  const authBtn = document.getElementById("authBtn");
  const supabase = window.supabaseClient || null;

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

    supabase.auth.onAuthStateChange((event, session) => {
      updateAuthBtn(session?.user || null);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      updateAuthBtn(session?.user || null);
    });

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
  // HERO SLIDESHOW (with captions + dots)
  // -----------------------------
  const slides = document.querySelectorAll(".ld-slide");
  const dots = document.querySelectorAll(".ld-dot");

  let currentSlide = 0;
  let slideInterval;

  function showSlide(index) {
    slides.forEach(slide => slide.classList.remove("active"));
    dots.forEach(dot => dot.classList.remove("active"));

    slides[index].classList.add("active");
    dots[index].classList.add("active");

    currentSlide = index;
  }

  function nextSlide() {
    const next = (currentSlide + 1) % slides.length;
    showSlide(next);
  }

  function startAutoRotate() {
    slideInterval = setInterval(nextSlide, 5000);
  }

  function stopAutoRotate() {
    clearInterval(slideInterval);
  }

  if (slides.length > 0) {

    startAutoRotate();

    dots.forEach((dot, index) => {
      dot.addEventListener("click", () => {
        stopAutoRotate();
        showSlide(index);
        startAutoRotate();
      });
    });

  }

});
