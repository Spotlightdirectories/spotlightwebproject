//Hamburger start logic//

const menu = document.querySelector('.nav-links');
const openBtn = document.querySelector('.menu-open');
const closeBtn = document.querySelector('.xclose');

if(openBtn && closeBtn && menu){

openBtn.addEventListener('click',()=>{
menu.classList.add('open');
});

closeBtn.addEventListener('click',()=>{
menu.classList.remove('open');
});

}

//hamburger end logic//

/* global window */
const mobileMenuBtn=document.getElementById("mobileMenuBtn");
const closeMenuBtn=document.getElementById("closeMenuBtn");
const mobileMenu=document.getElementById("mobileMenu");

mobileMenuBtn.onclick=()=>mobileMenu.style.display="flex";
closeMenuBtn.onclick=()=>mobileMenu.style.display="none";


const slides=document.querySelectorAll(".slide");
const prevBtn=document.getElementById("prevSlide");
const nextBtn=document.getElementById("nextSlide");

let currentSlide=0;

function showSlide(index){

slides.forEach(slide=>slide.classList.remove("active"));

if(index>=slides.length)currentSlide=0;
else if(index<0)currentSlide=slides.length-1;
else currentSlide=index;

slides[currentSlide].classList.add("active");

}

nextBtn.onclick=()=>showSlide(currentSlide+1);
prevBtn.onclick=()=>showSlide(currentSlide-1);

setInterval(()=>{
showSlide(currentSlide+1);
},5000);


function redirectTo(page){
window.location.href=page;
}

const heroSlides = document.querySelectorAll(".hero-slide");

let heroIndex = 0;

function showHeroSlide(index){

heroSlides.forEach(slide => slide.classList.remove("active"));

if(index >= heroSlides.length){
heroIndex = 0;
}else if(index < 0){
heroIndex = heroSlides.length - 1;
}else{
heroIndex = index;
}

heroSlides[heroIndex].classList.add("active");

}

setInterval(()=>{
showHeroSlide(heroIndex + 1);
},4000);

function newsletterPending(e){
e.preventDefault();
alert("Newsletter signup will be available soon.");
}