/* global window, supabaseClient */

document.addEventListener("DOMContentLoaded", () => {


// HAMBURGER MENU

const menu = document.querySelector('.nav-links');
const openBtn = document.querySelector('.menu-open');
const closeBtn = document.querySelector('.xclose');

if (openBtn && closeBtn && menu) {

openBtn.addEventListener('click', () => {
menu.classList.add('open');
});

closeBtn.addEventListener('click', () => {
menu.classList.remove('open');
});

}



// SLIDESHOW (MEDIA SECTION)

const slides = document.querySelectorAll(".slide");
const prevBtn = document.getElementById("prevSlide");
const nextBtn = document.getElementById("nextSlide");

let currentSlide = 0;

function showSlide(index){

if(slides.length === 0) return;

let previousSlide = slides[currentSlide] || null;

if(index >= slides.length) currentSlide = 0;
else if(index < 0) currentSlide = slides.length - 1;
else currentSlide = index;

let nextSlide = slides[currentSlide] || null;

if(previousSlide) previousSlide.classList.remove("active");
if(nextSlide) nextSlide.classList.add("active");

}

if(nextBtn && prevBtn){
nextBtn.onclick = () => showSlide(currentSlide + 1);
prevBtn.onclick = () => showSlide(currentSlide - 1);
}

if(slides.length > 0){
setInterval(()=>{
if (!document.hidden) {
showSlide(currentSlide + 1);
}
},5000);
}



// HERO SLIDESHOW

const heroSlides = document.querySelectorAll(".hero-slide");

let heroIndex = 0;

function showHeroSlide(index){

if(heroSlides.length === 0) return;

let previousSlide = heroSlides[heroIndex] || null;

if(index >= heroSlides.length) heroIndex = 0;
else if(index < 0) heroIndex = heroSlides.length - 1;
else heroIndex = index;

let nextSlide = heroSlides[heroIndex] || null;

if(previousSlide) previousSlide.classList.remove("active");
if(nextSlide) nextSlide.classList.add("active");

}

if(heroSlides.length > 0){
setInterval(()=>{
if (!document.hidden) {
showHeroSlide(heroIndex + 1);
}
},4000);
}



// AUTH BUTTON LOGIC

const authBtn = document.getElementById("authBtn");
const supabase = window.supabaseClient || null;

if (authBtn && supabase) {

async function checkAuth() {
  try {
    const res = await supabase.auth.getSession();
    const session = res.data.session;

    if (session) {
      authBtn.textContent = "Log out";
      authBtn.href = "#";
    } else {
      authBtn.textContent = "Log in";
      authBtn.href = "login";
    }
  } catch (error) {
    console.error("Auth check failed:", error);
  }
}

  checkAuth();

  authBtn.addEventListener("click", async (e) => {
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
      e.preventDefault();
      await supabase.auth.signOut();
      window.location.reload();
    }
  });

}



// GLOBAL FUNCTIONS

function redirectTo(page){
window.location.href = page;
}

function newsletterPending(e){
e.preventDefault();
alert("Newsletter signup will be available soon.");
}

});