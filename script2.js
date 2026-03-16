/* global window, supabaseClient */
var supabaseClient = window.supabaseClient;

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

slides.forEach(slide => slide.classList.remove("active"));

if(index >= slides.length) currentSlide = 0;
else if(index < 0) currentSlide = slides.length - 1;
else currentSlide = index;

slides[currentSlide].classList.add("active");

}

if(nextBtn && prevBtn){

nextBtn.onclick = () => showSlide(currentSlide + 1);
prevBtn.onclick = () => showSlide(currentSlide - 1);

}

if(slides.length > 0){

setInterval(()=>{
showSlide(currentSlide + 1);
},5000);

}



// HERO SLIDESHOW

const heroSlides = document.querySelectorAll(".hero-slide");

let heroIndex = 0;

function showHeroSlide(index){

if(heroSlides.length === 0) return;

heroSlides.forEach(slide => slide.classList.remove("active"));

if(index >= heroSlides.length) heroIndex = 0;
else if(index < 0) heroIndex = heroSlides.length - 1;
else heroIndex = index;

heroSlides[heroIndex].classList.add("active");

}

if(heroSlides.length > 0){

setInterval(()=>{
showHeroSlide(heroIndex + 1);
},4000);

}



// AUTH BUTTON LOGIC

const authBtn = document.getElementById("authBtn");
const supabase = window.supabaseClient || null;

if (authBtn && supabase) {

async function checkAuth() {

const { data: { session } } = await supabase.auth.getSession();

if (session) {
authBtn.textContent = "Log out";
authBtn.href = "#";
} else {
authBtn.textContent = "Log in";
authBtn.href = "login.html";
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

});



// GLOBAL FUNCTIONS (called from HTML)

function redirectTo(page){
window.location.href = page;
}

function newsletterPending(e){
e.preventDefault();
alert("Newsletter signup will be available soon.");
}