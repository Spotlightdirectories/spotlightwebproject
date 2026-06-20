// ---------- Helpers ----------
const fmt = n => n.toLocaleString();
const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';

/* ===========================
GLOBAL PERIOD
=========================== */

let insightPeriod="This Month";

function syncPeriod(period){
  insightPeriod=period;
  document.querySelectorAll(".period-select").forEach(s=>s.value=period);
  updateDateRange();
  renderMarketplaceStats();
}

/* ===========================
DATE RANGE
=========================== */

function updateDateRange(){
  const today=new Date();let start=new Date(today);

  switch(insightPeriod){
    case "Today":
      start=new Date(today);
      break;

    case "This Week":
      start.setDate(today.getDate()-6);
      break;

    case "This Quarter":
      const quarter=Math.floor(today.getMonth()/3);
      start=new Date(today.getFullYear(),quarter*3,1);
      break;

    case "This Year":
      start=new Date(today.getFullYear(),0,1);
      break;

    default:
      start=new Date(today.getFullYear(),today.getMonth(),1);
  }

  const options={month:"short",day:"numeric",year:"numeric"};
  $("dateRange").textContent=`${start.toLocaleDateString("en-US",options)} – ${today.toLocaleDateString("en-US",options)}`;
}

document.addEventListener("DOMContentLoaded",()=>{
  document.querySelectorAll(".period-select").forEach(select=>{
    select.addEventListener("change",e=>syncPeriod(e.target.value));
  });
  syncPeriod("This Month");
});

function svgEl(tag, attrs){
  const el = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k, v));
  return el;
}

// ---------- Business Health Score (gauge) ----------
const health={
  score:84,
  max:100,
  stars:4,
  deltaPct:12,
  items:[
    {label:"Profile Completeness",score:20,max:20},
    {label:"Verification",score:20,max:20},
    {label:"Reviews",score:18,max:20},
    {label:"Catalog",score:16,max:20},
    {label:"Sponsorship",score:10,max:20}
  ]
};

(function renderGauge(){
  const svg = $('gaugeSvg');

  // gradient defs
  const defs = svgEl('defs', {});
  const grad = svgEl('linearGradient', { id:'gaugeGradient', x1:'0%', y1:'0%', x2:'100%', y2:'0%' });
  [['0%', '#D93025'], ['50%', '#E6B800'], ['100%', '#1E8E3E']].forEach(([offset,color])=>{
    grad.appendChild(svgEl('stop', { offset, 'stop-color':color }));
  });
  defs.appendChild(grad);
  svg.insertBefore(defs, svg.firstChild);

  // arc length ~ 282.6 (semicircle radius 90)
  const fullLength = Math.PI * 90;
  const pct = health.score / health.max;
  const fill = $('gaugeFill');
  fill.style.strokeDasharray = `${fullLength * pct} ${fullLength}`;

  $('healthValue').textContent = health.score;

  const starsEl = $('starRow');
  starsEl.textContent = '★★★★★'.slice(0, health.stars) + '☆☆☆☆☆'.slice(0, 5 - health.stars);

})();

// ---------- Marketplace Performance ----------
function getPerfStats(){
  switch(insightPeriod){
    case "Today":
      return[
        {label:"Profile Views",value:312,growth:8,up:true},
        {label:"Unique Visitors",value:98,growth:6,up:true},
        {label:"Search Impressions",value:1624,growth:12,up:true}
      ];
    case "This Week":
      return[
        {label:"Profile Views",value:2140,growth:16,up:true},
        {label:"Unique Visitors",value:624,growth:12,up:true},
        {label:"Search Impressions",value:10852,growth:24,up:true}
      ];
    case "This Quarter":
      return[
        {label:"Profile Views",value:24182,growth:32,up:true},
        {label:"Unique Visitors",value:7521,growth:27,up:true},
        {label:"Search Impressions",value:128450,growth:46,up:true}
      ];
    case "This Year":
      return[
        {label:"Profile Views",value:91420,growth:58,up:true},
        {label:"Unique Visitors",value:30218,growth:51,up:true},
        {label:"Search Impressions",value:482610,growth:73,up:true}
      ];
    default:
      return[
        {label:"Profile Views",value:8930,growth:21,up:true},
        {label:"Unique Visitors",value:2140,growth:16,up:true},
        {label:"Search Impressions",value:45201,growth:34,up:true}
      ];
  }
}

function renderMarketplaceStats(){
  const perfStats=getPerfStats();
  $("perfStats").innerHTML="";
  $("perfStats").className="grid-3";
  perfStats.forEach(p=>{
    const div=document.createElement("div");
    div.className="perf-stat";
    div.innerHTML=`<div class="p-lbl">${p.label}</div><div class="p-val">${fmt(p.value)}</div><div class="p-trend ${p.up?"up":"down"}">${p.up?"▲":"▼"} ${p.growth}%</div>`;
    $("perfStats").appendChild(div);
  });
}

renderMarketplaceStats();

const perfSeries = [3200,3800,3500,4600,4200,5100,5900,5400,6300,6900,7400,7100,7800,8200,8930];
let perfDates=[];

function getPerfDates(){
  switch(insightPeriod){
    case "Today":return["12AM","6AM","12PM","6PM","Now"];
    case "This Week":return["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    case "This Quarter":return["Apr","May","Jun"];
    case "This Year":return["Jan","Mar","May","Jul","Sep","Nov"];
    default:return["Week 1","Week 2","Week 3","Week 4"];
  }
}

(function renderLineChart(){
  const svg = $('perfLineChart');
  const W = 600, H = 160, padTop = 10, padBottom = 10;
  const max = Math.max(...perfSeries);
  const min = 0;

  const defs = svgEl('defs', {});
  const grad = svgEl('linearGradient', { id:'areaGradient', x1:'0%', y1:'0%', x2:'0%', y2:'100%' });
  grad.appendChild(svgEl('stop', { offset:'0%', 'stop-color':'#E6B800', 'stop-opacity':'0.5' }));
  grad.appendChild(svgEl('stop', { offset:'100%', 'stop-color':'#E6B800', 'stop-opacity':'0' }));
  defs.appendChild(grad);
  svg.appendChild(defs);

  // gridlines
  [0,1,2,3,4].forEach(i=>{
    const y = padTop + (H - padTop - padBottom) * (i/4);
    svg.appendChild(svgEl('line', { x1:0, x2:W, y1:y, y2:y, class:'chart-grid-line' }));
  });

  const points = perfSeries.map((v,i)=>{
    const x = (i/(perfSeries.length-1)) * W;
    const y = padTop + (H - padTop - padBottom) * (1 - (v-min)/(max-min));
    return [x,y];
  });

  const linePath = points.map((p,i)=> (i===0?'M':'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const areaPath = linePath + ` L${W},${H} L0,${H} Z`;

  svg.appendChild(svgEl('path', { d:areaPath, class:'chart-area' }));
  svg.appendChild(svgEl('path', { d:linePath, class:'chart-line' }));

  perfDates=getPerfDates();
$('perfXAxis').innerHTML=perfDates.map(d=>`<span>${d}</span>`).join("");

})();

// ---------- Lead Generation ----------
function getLeadChannels(){
  switch(insightPeriod){
    case "Today":
      return[
        {label:"WhatsApp Chats",icon:"fa-brands fa-whatsapp",cls:"lead-icon-whatsapp",value:24,growth:6,up:true},
        {label:"Phone Calls",icon:"fa-solid fa-phone",cls:"lead-icon-phone",value:3,growth:2,up:true},
        {label:"Directions",icon:"fa-solid fa-location-dot",cls:"lead-icon-direction",value:4,growth:1,up:true},
        {label:"External Visits",icon:"fa-solid fa-arrow-up-right-from-square",cls:"lead-icon-external",value:6,growth:3,up:true}
      ];

    case "This Week":
      return[
        {label:"WhatsApp Chats",icon:"fa-brands fa-whatsapp",cls:"lead-icon-whatsapp",value:124,growth:18,up:true},
        {label:"Phone Calls",icon:"fa-solid fa-phone",cls:"lead-icon-phone",value:14,growth:7,up:true},
        {label:"Directions",icon:"fa-solid fa-location-dot",cls:"lead-icon-direction",value:18,growth:5,up:true},
        {label:"Catalog Visits",icon:"fa-solid fa-book-open",cls:"lead-icon-catalog",value:91,growth:14,up:true},
        {label:"External Visits",icon:"fa-solid fa-arrow-up-right-from-square",cls:"lead-icon-external",value:22,growth:8,up:true}
      ];

    case "This Quarter":
      return[
        {label:"WhatsApp Chats",icon:"fa-brands fa-whatsapp",cls:"lead-icon-whatsapp",value:1450,growth:32,up:true},
        {label:"Phone Calls",icon:"fa-solid fa-phone",cls:"lead-icon-phone",value:126,growth:21,up:true},
        {label:"Directions",icon:"fa-solid fa-location-dot",cls:"lead-icon-direction",value:184,growth:16,up:true},
        {label:"Catalog Visits",icon:"fa-solid fa-book-open",cls:"lead-icon-catalog",value:91,growth:14,up:true},
        {label:"External Visits",icon:"fa-solid fa-arrow-up-right-from-square",cls:"lead-icon-external",value:212,growth:19,up:true}
      ];

    case "This Year":
      return[
        {label:"WhatsApp Chats",icon:"fa-brands fa-whatsapp",cls:"lead-icon-whatsapp",value:5820,growth:58,up:true},
        {label:"Phone Calls",icon:"fa-solid fa-phone",cls:"lead-icon-phone",value:624,growth:41,up:true},
        {label:"Directions",icon:"fa-solid fa-location-dot",cls:"lead-icon-direction",value:714,growth:37,up:true},
        {label:"Catalog Visits",icon:"fa-solid fa-book-open",cls:"lead-icon-catalog",value:91,growth:14,up:true},
        {label:"External Visits",icon:"fa-solid fa-arrow-up-right-from-square",cls:"lead-icon-external",value:986,growth:43,up:true}
      ];

    default:
      return[
        {label:"WhatsApp Chats",icon:"fa-brands fa-whatsapp",cls:"lead-icon-whatsapp",value:612,growth:23,up:true},
        {label:"Phone Calls",icon:"fa-solid fa-phone",cls:"lead-icon-phone",value:42,growth:12,up:true},
        {label:"Directions",icon:"fa-solid fa-location-dot",cls:"lead-icon-direction",value:62,growth:8,up:true},
        {label:"Catalog Visits",icon:"fa-solid fa-book-open",cls:"lead-icon-catalog",value:91,growth:14,up:true},
        {label:"External Visits",icon:"fa-solid fa-arrow-up-right-from-square",cls:"lead-icon-external",value:78,growth:11,up:true}
      ];
  }
}

function renderLeadGeneration(){
  const leadChannels=getLeadChannels();
  $("leadGrid").innerHTML=leadChannels.map(c=>`<div class="lead-card"><div class="lead-icon ${c.cls}"><i class="${c.icon}"></i></div><div class="lead-label">${c.label}</div><div class="lead-value">${fmt(c.value)}</div><div class="lead-trend ${c.up?"up":"down"}">${c.up?"▲":"▼"} ${c.growth}%</div></div>`).join("");
}

renderLeadGeneration();

// ---------- Catalog Performance ----------
const topProducts = [
  { name:'Laptop Bag', views:2304 },
  { name:'Executive Office Chair', views:1842 },
  { name:'Leather Laptop Bag', views:1256 },
];
const topServices = [
  { name:'Financial Modelling', views:1752 },
  { name:'Audit & Assurance', views:842 },
  { name:'Tax Advisory', views:615 },
];
function renderRankList(id, items){
  $(id).innerHTML = items.map((it,i)=>`
    <div class="rank-row">
      <div class="rank-num">${i+1}</div>
      <div class="rank-name">${it.name}</div>
      <div class="rank-views">${fmt(it.views)} views</div>
    </div>
  `).join('');
}
renderRankList("topProducts",topProducts.slice(0,5));
renderRankList("topServices",topServices.slice(0,5));

if(topProducts.length<=5)$("viewAllProductsLink").style.display="none";
if(topServices.length<=5)$("viewAllServicesLink").style.display="none";

// ---------- Marketplace Ranking slider ----------
(function renderRankSlider(){
  // scale: #50 (worst, left) -> Top 5 (best, right). Current rank #18 of 50.
  const worst = 50, best = 5, current = 18;
  const pct = (worst - current) / (worst - best) * 100;
  $('rankSliderDot').style.left = pct + '%';
})();

// ---------- Audience ----------
const audience = [
  { city:'Abuja', pct:45, cls:'dot-red' },
  { city:'Lagos', pct:18, cls:'dot-blue' },
  { city:'Port Harcourt', pct:12, cls:'dot-green' },
  { city:'Ibadan', pct:8, cls:'dot-gold' },
  { city:'Kano', pct:5, cls:'dot-purple' },
  { city:'Others', pct:12, cls:'dot-gray' },
];
$('audienceList').innerHTML = audience.map(a => `
  <div class="audience-row">
    <span class="audience-dot ${a.cls}"></span>
    <span class="audience-city">${a.city}</span>
    <span class="audience-pct">${a.pct}%</span>
  </div>
`).join('');

// ---------- Search Keywords ----------
const keywords = [
  { term:'Financial Modelling', pct:45 },
  { term:'Business Plan', pct:28 },
  { term:'Audit', pct:18 },
  { term:'Tax Advisory', pct:9 },
  { term:'Startup Valuation', pct:3 },
];
$('keywordList').innerHTML = keywords.map((k,i) => `
  <div class="kw-row">
    <div class="kw-top"><span>${k.term}</span><span>${k.pct}%</span></div>
    <div class="kw-bar-track"><div class="kw-bar-fill" id="kwBar${i}"></div></div>
  </div>
`).join('');
keywords.forEach((k,i) => { $('kwBar'+i).style.width = k.pct + '%'; });

// ---------- Growth Coach ----------
const coachItems = [
  { title:'Upload Business Video', done:true, impact:'', action:'', actionLabel:'' },
  { title:'Complete CAC Verification', done:true, impact:'', action:'', actionLabel:'' },
  { title:'Get 3 More Reviews', done:false, impact:'recommended', actionLabel:'Request Reviews' },
  { title:'Sponsor Your Business', done:false, impact:'high', actionLabel:'Sponsor Now' },
];
$('coachList').innerHTML = coachItems.map(c => `
  <div class="coach-item">
    <div class="coach-status ${c.done?'done':'todo'}">${c.done?'✓':'○'}</div>
    <div class="coach-body">
      <div class="coach-title">${c.title}</div>
      ${c.impact ? `<div class="coach-impact ${c.impact}">${c.impact==='high'?'High Impact':'Recommended'}</div>` : ''}
    </div>
    ${c.done ? '' : `<button class="coach-action ${c.impact==='recommended'?'secondary':''}">${c.actionLabel}</button>`}
  </div>
`).join('');

const completed = coachItems.filter(c=>c.done).length;
$('coachProgressLabel').textContent = `${completed} / ${coachItems.length} Completed`;
$('coachProgressFill').style.width = (completed / coachItems.length * 100) + '%';

/* ============================
   BACK TO DASHBOARD
============================ */

const backToDashboardBtn =
document.getElementById(
"backToDashboardBtn"
);

if (
backToDashboardBtn
) {

backToDashboardBtn
.addEventListener(

"click",

function(){

window.location.href =
"vendordashboard.html";

}

);

}

const healthDetailsBtn=$("healthDetailsBtn"),healthModal=$("healthModal"),closeHealthModal=$("closeHealthModal");

if(healthDetailsBtn)healthDetailsBtn.onclick=()=>healthModal.classList.add("show");
if(closeHealthModal)closeHealthModal.onclick=()=>healthModal.classList.remove("show");
if(healthModal)healthModal.onclick=e=>{if(e.target===healthModal)healthModal.classList.remove("show");};