// ---------- Helpers ----------
const fmt = n => n.toLocaleString();
const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';

const insightSupabase =
  window.supabaseClient;

const visitorId =
  window.visitorId;

console.log(
  "Insight Visitor ID:",
  visitorId
);

console.log(
  "Insight Supabase:",
  insightSupabase
);

let currentVendorId = null;

async function loadCurrentVendor() {

  const {
    data: { user }
  } = await insightSupabase
    .auth
    .getUser();

  if (!user) return;

  const {
    data: vendor,
    error
  } = await insightSupabase
    .from(
      "vendors"
    )
    .select(
      "id,name,plan_tier"
    )
    .eq(
      "auth_user_id",
      user.id
    )
    .single();

  currentVendorId =
    vendor?.id || null;

}

/* ===========================
GLOBAL PERIOD
=========================== */

let insightPeriod="This Month";

let showAllKeywords=false;

function syncPeriod(period){

insightPeriod=period;

document.querySelectorAll(".period-select").forEach(s=>s.value=period);

updateDateRange();
renderMarketplaceStats();
renderLineChart();
renderLeadGeneration();
renderAudience();
renderKeywords();
renderCatalog();
renderRanking();
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

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    document
      .querySelectorAll(
        ".period-select"
      )
      .forEach(select => {

        select.addEventListener(
          "change",
          e => syncPeriod(
            e.target.value
          )
        );

      });

    await loadCurrentVendor();

    syncPeriod(
      "This Month"
    );

  }
);

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

function getMarketplaceChart(){

switch(insightPeriod){

case "Today":
return{
labels:["6am","9am","12pm","3pm","6pm","9pm"],
values:[120,210,320,280,430,520]
};

case "This Week":
return{
labels:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
values:[820,940,860,1120,1260,1180,1420]
};

case "This Quarter":
return{
labels:["Apr","May","Jun"],
values:[14200,18400,23600]
};

case "This Year":
return{
labels:["Q1","Q2","Q3","Q4"],
values:[35200,48600,63400,81200]
};

default:

return{
labels:["Week 1","Week 2","Week 3","Week 4"],
values:[2140,4260,6390,8930]
};

}

}

function renderLineChart(){

const svg=$("perfLineChart");

if(!svg)return;

svg.innerHTML="";

const chart=getMarketplaceChart();

const labels=chart.labels;
const values=chart.values;

const W=600;
const H=160;
const PAD=20;

const max=Math.max(...values);

const defs=svgEl("defs",{});

const grad=svgEl("linearGradient",{
id:"areaGradient",
x1:"0%",
y1:"0%",
x2:"0%",
y2:"100%"
});

grad.appendChild(
svgEl("stop",{
offset:"0%",
"stop-color":"#E6B800",
"stop-opacity":"0.35"
})
);

grad.appendChild(
svgEl("stop",{
offset:"100%",
"stop-color":"#E6B800",
"stop-opacity":"0"
})
);

defs.appendChild(grad);

svg.appendChild(defs);

for(let i=0;i<5;i++){

const y=
PAD+
((H-PAD*2)/4)*i;

svg.appendChild(
svgEl("line",{
x1:0,
y1:y,
x2:W,
y2:y,
class:"chart-grid-line"
})
);

}

const points=values.map((v,i)=>{

const x=
PAD+
((W-PAD*2)/(values.length-1))*i;

const y=
H-PAD-
((v/max)*(H-PAD*2));

return [x,y];

});

const linePath=
points.map((p,i)=>
`${i===0?"M":"L"}${p[0]},${p[1]}`
).join(" ");

const areaPath=
linePath+
` L ${points[points.length-1][0]} ${H-PAD}
L ${points[0][0]} ${H-PAD}
Z`;

svg.appendChild(
svgEl("path",{
d:areaPath,
fill:"url(#areaGradient)"
})
);

svg.appendChild(
svgEl("path",{
d:linePath,
class:"chart-line"
})
);

$("perfXAxis").innerHTML=
labels.map(
l=>`<span>${l}</span>`
).join("");

}

renderLineChart();

// ---------- Lead Generation ----------
async function getLeadChannels(){

  if (!currentVendorId) {

    return [];

  }

  let startDate =
    new Date();

  switch (insightPeriod) {

    case "Today":

      startDate.setHours(
        0,0,0,0
      );

      break;

    case "This Week":

      startDate.setDate(
        startDate.getDate() - 6
      );

      break;

    case "This Quarter":

      const quarter =
        Math.floor(
          startDate.getMonth() / 3
        );

      startDate =
        new Date(
          startDate.getFullYear(),
          quarter * 3,
          1
        );

      break;

    case "This Year":

      startDate =
        new Date(
          startDate.getFullYear(),
          0,
          1
        );

      break;

    default:

      startDate =
        new Date(
          startDate.getFullYear(),
          startDate.getMonth(),
          1
        );

  }

  const {
    data,
    error
  } = await insightSupabase
    .from(
      "analytics_events"
    )
    .select(
      "event_type"
    )
    .eq(
      "vendor_id",
      currentVendorId
    )
    .gte(
      "created_at",
      startDate.toISOString()
    );

  if (error) {

    return [];

  }

  const count =
    eventType =>
      data.filter(
        row =>
          row.event_type ===
          eventType
      ).length;

  return [

    {
      label:"WhatsApp Chats",
      icon:"fa-brands fa-whatsapp",
      cls:"lead-icon-whatsapp",
      value:count(
        "whatsapp_click"
      ),
      growth:0,
      up:true
    },

    {
      label:"Phone Calls",
      icon:"fa-solid fa-phone",
      cls:"lead-icon-phone",
      value:count(
        "phone_click"
      ),
      growth:0,
      up:true
    },

    {
      label:"Directions",
      icon:"fa-solid fa-location-dot",
      cls:"lead-icon-direction",
      value:count(
        "direction_click"
      ),
      growth:0,
      up:true
    },

    {
      label:"Catalog Visits",
      icon:"fa-solid fa-book-open",
      cls:"lead-icon-catalog",
      value:count(
        "catalog_visit"
      ),
      growth:0,
      up:true
    },

    {
      label:"External Visits",
      icon:"fa-solid fa-arrow-up-right-from-square",
      cls:"lead-icon-external",
      value:count(
        "external_visit"
      ),
      growth:0,
      up:true
    }

  ];

}

async function renderLeadGeneration(){

  const leadChannels =
    await getLeadChannels();

  $("leadGrid").innerHTML =
    leadChannels.map(c => `
      <div class="lead-card">
        <div class="lead-icon ${c.cls}">
          <i class="${c.icon}"></i>
        </div>
        <div class="lead-label">
          ${c.label}
        </div>
        <div class="lead-value">
          ${fmt(c.value)}
        </div>
        <div class="lead-trend ${c.up ? "up" : "down"}">
          ${c.up ? "▲" : "▼"} ${c.growth}%
        </div>
      </div>
    `).join("");

}

renderLeadGeneration();

// ---------- Catalog Performance ----------
function getCatalogData(){

switch(insightPeriod){

case "Today":
return{
products:[
{name:"Laptop Bag",views:34},
{name:"Executive Office Chair",views:27},
{name:"Leather Laptop Bag",views:18},
{name:"Executive Office Table",views:12},
{name:"Laptop Shield",views:8}
],
services:[
{name:"Audit & Assurance",views:21},
{name:"Financial Modelling",views:17},
{name:"Tax Advisory",views:9}
]
};

case "This Week":
return{
products:[
{name:"Laptop Bag",views:284},
{name:"Executive Office Chair",views:236},
{name:"Leather Laptop Bag",views:194},
{name:"Executive Office Table",views:122},
{name:"Laptop Shield",views:84}
],
services:[
{name:"Financial Modelling",views:175},
{name:"Audit & Assurance",views:142},
{name:"Tax Advisory",views:95}
]
};

case "This Quarter":
return{
products:[
{name:"Laptop Bag",views:6412},
{name:"Executive Office Chair",views:5328},
{name:"Leather Laptop Bag",views:4210},
{name:"Executive Office Table",views:3102},
{name:"Laptop Shield",views:2140}
],
services:[
{name:"Financial Modelling",views:3721},
{name:"Audit & Assurance",views:2842},
{name:"Tax Advisory",views:1518}
]
};

case "This Year":
return{
products:[
{name:"Laptop Bag",views:28410},
{name:"Executive Office Chair",views:24180},
{name:"Leather Laptop Bag",views:19842},
{name:"Executive Office Table",views:14225},
{name:"Laptop Shield",views:10842}
],
services:[
{name:"Financial Modelling",views:9172},
{name:"Audit & Assurance",views:6840},
{name:"Tax Advisory",views:4128}
]
};

default:
return{
products:[
{name:"Laptop Bag",views:2304},
{name:"Executive Office Chair",views:1842},
{name:"Leather Laptop Bag",views:1256},
{name:"Laptop Shield",views:304},
{name:"Executive Office Table",views:842}
],
services:[
{name:"Financial Modelling",views:1752},
{name:"Audit & Assurance",views:842},
{name:"Tax Advisory",views:615}
]
};

}

}

function renderCatalog(){

const catalog=getCatalogData();

renderRankList(
"topProducts",
catalog.products.slice(0,5)
);

renderRankList(
"topServices",
catalog.services.slice(0,5)
);

if(
$("viewAllProductsLink") &&
catalog.products.length<=5
){
$("viewAllProductsLink").style.display="none";
}

if(
$("viewAllServicesLink") &&
catalog.services.length<=5
){
$("viewAllServicesLink").style.display="none";
}

}

renderCatalog();


// ---------- Marketplace Ranking ----------


function renderRankList(id, items){
  $(id).innerHTML = items.map((it,i)=>`
    <div class="rank-row">
      <div class="rank-num">${i+1}</div>
      <div class="rank-name">${it.name}</div>
      <div class="rank-views">${fmt(it.views)} views</div>
    </div>
  `).join('');
}

let selectedRankingCategory="Professional Services";
let selectedRankingSubcategory="Accountant";

function getRankingData(){

switch(insightPeriod){

case "Today":
return{
current:22,
sponsored:8,
category:`${selectedRankingCategory} / ${selectedRankingSubcategory}`
};

case "This Week":
return{
current:20,
sponsored:6,
category:`${selectedRankingCategory} / ${selectedRankingSubcategory}`
};

case "This Quarter":
return{
current:14,
sponsored:4,
category:`${selectedRankingCategory} / ${selectedRankingSubcategory}`
};

case "This Year":
return{
current:9,
sponsored:3,
category:`${selectedRankingCategory} / ${selectedRankingSubcategory}`
};

default:
return{
current:18,
sponsored:5,
category:`${selectedRankingCategory} / ${selectedRankingSubcategory}`
};

}

}

function renderRanking(){

const r=getRankingData();

const numbers=
document.querySelectorAll(".rank-number");

if(numbers.length>=2){

numbers[0].textContent=`#${r.current}`;

numbers[1].textContent=
r.sponsored<=5
?`Top ${r.sponsored}`
:`#${r.sponsored}`;

}

const subs=
document.querySelectorAll(".rank-sub");

if(subs.length){

subs[0].textContent=r.category;

}

const currentLabel=
document.querySelector(".rank-current-label");

if(currentLabel){

currentLabel.textContent=`#${r.current}`;

}

const rightLabel=
document.querySelector(".rank-right-label");

if(rightLabel){

rightLabel.textContent=`🏆 Top ${r.sponsored}`;

}

const dot=$("rankCurrentDot");

if(dot){

const maxRank=50;

const pct=
Math.min(
100,
(r.current/maxRank)*100
);

dot.style.left=`${pct}%`;

}

}


// ---------- Audience ----------
function getAudienceData(){

switch(insightPeriod){

case "Today":
return{
total:312,
rows:[
{city:"Abuja",pct:35,cls:"dot-red"},
{city:"Lagos",pct:25,cls:"dot-blue"},
{city:"Port Harcourt",pct:15,cls:"dot-green"},
{city:"Ibadan",pct:10,cls:"dot-gold"},
{city:"Kano",pct:5,cls:"dot-purple"},
{city:"Others",pct:10,cls:"dot-gray"}
]
};

case "This Week":
return{
total:2140,
rows:[
{city:"Abuja",pct:42,cls:"dot-red"},
{city:"Lagos",pct:21,cls:"dot-blue"},
{city:"Port Harcourt",pct:13,cls:"dot-green"},
{city:"Ibadan",pct:9,cls:"dot-gold"},
{city:"Kano",pct:4,cls:"dot-purple"},
{city:"Others",pct:11,cls:"dot-gray"}
]
};

case "This Quarter":
return{
total:24650,
rows:[
{city:"Abuja",pct:40,cls:"dot-red"},
{city:"Lagos",pct:24,cls:"dot-blue"},
{city:"Port Harcourt",pct:14,cls:"dot-green"},
{city:"Ibadan",pct:8,cls:"dot-gold"},
{city:"Kano",pct:5,cls:"dot-purple"},
{city:"Others",pct:9,cls:"dot-gray"}
]
};

case "This Year":
return{
total:108420,
rows:[
{city:"Abuja",pct:38,cls:"dot-red"},
{city:"Lagos",pct:27,cls:"dot-blue"},
{city:"Port Harcourt",pct:15,cls:"dot-green"},
{city:"Ibadan",pct:8,cls:"dot-gold"},
{city:"Kano",pct:4,cls:"dot-purple"},
{city:"Others",pct:8,cls:"dot-gray"}
]
};

default:
return{
total:8930,
rows:[
{city:"Abuja",pct:45,cls:"dot-red"},
{city:"Lagos",pct:18,cls:"dot-blue"},
{city:"Port Harcourt",pct:12,cls:"dot-green"},
{city:"Ibadan",pct:8,cls:"dot-gold"},
{city:"Kano",pct:5,cls:"dot-purple"},
{city:"Others",pct:12,cls:"dot-gray"}
]
};

}

}

function renderAudience(){

const data=getAudienceData();

const audienceList=$("audienceList");

const totalEl=document.querySelector(".audience-total");

if(totalEl){
totalEl.textContent=fmt(data.total);
}

data.rows.forEach(
a=>a.count=Math.round(data.total*a.pct/100)
);

if(audienceList){

audienceList.innerHTML=data.rows.map(a=>`
<div class="audience-row">
<span class="audience-dot ${a.cls}"></span>
<span class="audience-city">${a.city}</span>
<span class="audience-count">${fmt(a.count)}</span>
<span class="audience-pct">${a.pct}%</span>
</div>
`).join("");

}

}

// ---------- Search Keywords ----------
function getKeywordData(){

switch(insightPeriod){

case "Today":
return[
{term:"Audit",searches:18,pct:32},
{term:"Financial Modelling",searches:14,pct:25},
{term:"Business Plan",searches:10,pct:18},
{term:"Tax Advisory",searches:8,pct:14},
{term:"Startup Valuation",searches:6,pct:11}
];

case "This Week":
return[
{term:"Financial Modelling",searches:82,pct:35},
{term:"Audit",searches:58,pct:25},
{term:"Business Plan",searches:42,pct:18},
{term:"Tax Advisory",searches:31,pct:13},
{term:"Startup Valuation",searches:20,pct:9}
];

case "This Quarter":
return[
{term:"Financial Modelling",searches:842,pct:42},
{term:"Business Plan",searches:521,pct:26},
{term:"Audit",searches:334,pct:17},
{term:"Tax Advisory",searches:203,pct:10},
{term:"Startup Valuation",searches:102,pct:5}
];

case "This Year":
return[
{term:"Financial Modelling",searches:3621,pct:39},
{term:"Business Plan",searches:2482,pct:27},
{term:"Audit",searches:1710,pct:18},
{term:"Tax Advisory",searches:942,pct:10},
{term:"Startup Valuation",searches:521,pct:6}
];

default:
return[
{term:"Financial Modelling",searches:312,pct:45},
{term:"Business Plan",searches:194,pct:28},
{term:"Audit",searches:125,pct:18},
{term:"Tax Advisory",searches:63,pct:9},
{term:"Startup Valuation",searches:21,pct:3},
{term:"Bookkeeping",searches:19,pct:3},
{term:"Payroll Services",searches:17,pct:2},
{term:"Financial Reporting",searches:15,pct:2},
{term:"Internal Controls",searches:12,pct:2},
{term:"Due Diligence",searches:10,pct:1}
];

}

}

function renderKeywords(){

const allKeywords=getKeywordData();

const keywords=
showAllKeywords
? allKeywords
: allKeywords.slice(0,5);

$("keywordList").innerHTML=keywords.map((k,i)=>`
<div class="kw-row">
<div class="kw-top">
<span>${k.term}</span>
<span class="kw-metrics">
<span>${fmt(k.searches)}</span>
<span>${k.pct}%</span>
</span>
</div>
<div class="kw-bar-track">
<div class="kw-bar-fill" id="kwBar${i}"></div>
</div>
</div>
`).join("");

keywords.forEach((k,i)=>{
$("kwBar"+i).style.width=k.pct+"%";
});

const toggleLink=
$("toggleKeywordsLink");

if(toggleLink){

toggleLink.textContent=
showAllKeywords
? "View Less Keywords ↑"
: "View All Keywords →";

toggleLink.onclick=(e)=>{

e.preventDefault();

showAllKeywords=
!showAllKeywords;

renderKeywords();

};

}

}


const growthCoachTargets={

free:{
listings:1,
reviews:20
},

standard:{
listings:6,
reviews:50
},

enterprise:{
listings:12,
reviews:100
},

elite:{
listings:24,
reviews:200
}

};

// ---------- Growth Coach ----------
const growthCoachData={

profile:{
description:true,
logo:true,
coverImage:true,
businessVideo:false,
contactInformation:true,
businessHours:true,
socialLinks:false
},

verification:{
score:20,
maxScore:20,
emailVerified:true,
businessVerified:true
},

catalog:{
score:12,
maxScore:20,
plan:"standard",
businessType:"hybrid",
products:3,
services:1,
current:4,
required:growthCoachTargets.standard.listings
},

reviews:{
score:8,
maxScore:20,
thisMonth:4,
targetThisMonth:10
},

sponsorship:{
score:10,
maxScore:20,
businessType:"hybrid",

business:false,

products:true,
services:false,

businessSponsoredText:"No",
productsSponsoredText:"Yes",
servicesSponsoredText:"No"
}

};
// ---------- Growth Coach ----------
const coachItems = [

{
title:'Complete Profile',
done:false,
score:14,
maxScore:20,
impact:'recommended',
actionLabel:'See Details'
},

{
title:'Complete Business Verification',
done:true,
score:20,
maxScore:20,
impact:'high',
actionLabel:'See Details'
},

{
title:'Add & Complete Products / Services',
done:false,
score:12,
maxScore:20,
impact:'high',
actionLabel:'See Details'
},

{
title:'Get More Reviews',
done:false,
score:8,
maxScore:20,
impact:'recommended',
actionLabel:'See Details'
},

{
title:'Sponsor Business / Products / Services',
done:false,
score:10,
maxScore:20,
impact:'high',
actionLabel:'See Details',
secondaryAction:'Sponsor Now'
}

];

$('coachList').innerHTML = coachItems.map((c,index) => `
  
<div class="coach-item-wrap">

<div class="coach-item">

  <div class="coach-status ${c.done?'done':'todo'}">${c.done?'✓':'○'}</div>

  <div class="coach-body">
    <div class="coach-title">${c.title}</div>
    ${c.impact ? `<div class="coach-impact ${c.impact}">${c.impact==='high'?'High Impact':'Recommended'}</div>` : ''}
  </div>

  ${c.secondaryAction
? `
<div class="coach-action-group">
<button class="coach-action" data-index="${index}">
${c.actionLabel}
</button>

<button
class="coach-action sponsor-action"
data-action="sponsor">
${c.secondaryAction}
</button>
</div>
`
: c.actionLabel
? `<button class="coach-action" data-index="${index}">${c.actionLabel}</button>`
: ''
}

</div>

<div
class="coach-details"
id="coachDetails${index}"
style="display:none;">
</div>

</div>

`).join('');

const growthScore =
coachItems.reduce(
(total,item)=>total+item.score,
0
);

$("coachProgressLabel").textContent =
growthScore + "%";

$("coachProgressFill").style.width =
growthScore + "%";

const coachBreakdownToggle =
$("coachBreakdownToggle");

const coachBreakdown =
$("coachBreakdown");

if(coachBreakdownToggle){

coachBreakdownToggle.onclick=()=>{

const isHidden =
coachBreakdown.style.display==="none";

coachBreakdown.style.display =
isHidden ? "block" : "none";

coachBreakdownToggle.textContent =
isHidden
? "Breakdown ▲"
: "Breakdown ▼";

};

}

$("coachBreakdown").innerHTML=`

<div class="coach-breakdown-row">
<span>Profile Completion</span>
<span>${coachItems[0].score}/${coachItems[0].maxScore}</span>
</div>

<div class="coach-breakdown-row">
<span>Verification</span>
<span>${coachItems[1].score}/${coachItems[1].maxScore}</span>
</div>

<div class="coach-breakdown-row">
<span>Products & Services</span>
<span>${coachItems[2].score}/${coachItems[2].maxScore}</span>
</div>

<div class="coach-breakdown-row">
<span>Reviews</span>
<span>${coachItems[3].score}/${coachItems[3].maxScore}</span>
</div>

<div class="coach-breakdown-row">
<span>Sponsorship</span>
<span>${coachItems[4].score}/${coachItems[4].maxScore}</span>
</div>

<div class="coach-breakdown-total">
<span>Growth Score</span>
<span>${growthScore}/100</span>
</div>

`;

document
.querySelectorAll(".coach-action")
.forEach(btn=>{

btn.onclick=()=>{

const index =
btn.dataset.index;

if(index==="0"){

const details =
$("coachDetails0");

const isHidden =
details.style.display==="none";

details.style.display =
isHidden ? "block" : "none";

btn.textContent =
isHidden
? "Hide Details"
: "See Details";

details.innerHTML=`

<div class="coach-detail-score">
Current Score: ${coachItems[0].score}/${coachItems[0].maxScore}
</div>

<div>${growthCoachData.profile.description?"✓":"✗"} Description</div>

<div>${growthCoachData.profile.logo?"✓":"✗"} Logo</div>

<div>${growthCoachData.profile.coverImage?"✓":"✗"} Cover Image</div>

<div>${growthCoachData.profile.businessVideo?"✓":"✗"} Business Video</div>

<div>${growthCoachData.profile.contactInformation?"✓":"✗"} Contact Information</div>

<div>${growthCoachData.profile.businessHours?"✓":"✗"} Business Hours</div>

<div>${growthCoachData.profile.socialLinks?"✓":"✗"} Social Links</div>

`;

}

else if(index==="1"){

const details =
$("coachDetails1");

const isHidden =
details.style.display==="none";

details.style.display =
isHidden ? "block" : "none";

btn.textContent =
isHidden
? "Hide Details"
: "See Details";

details.innerHTML=`

<div class="coach-detail-score">
Current Score: ${growthCoachData.verification.score}/${growthCoachData.verification.maxScore}
</div>

<div>${growthCoachData.verification.emailVerified?"✓":"✗"} Email Verified</div>

<div>${growthCoachData.verification.businessVerified?"✓":"✗"} Business Verified</div>

`;

}

else if(index==="2"){

const details =
$("coachDetails2");

const isHidden =
details.style.display==="none";

details.style.display =
isHidden ? "block" : "none";

btn.textContent =
isHidden
? "Hide Details"
: "See Details";

details.innerHTML=`

<div class="coach-detail-score">
Current Score: ${growthCoachData.catalog.score}/${growthCoachData.catalog.maxScore}
</div>

<div>
Current Plan:
${growthCoachData.catalog.plan.charAt(0).toUpperCase() + growthCoachData.catalog.plan.slice(1)}
</div>

<div>
Business Type:
${growthCoachData.catalog.businessType.charAt(0).toUpperCase() + growthCoachData.catalog.businessType.slice(1)}
</div>

<div>
Products:
${growthCoachData.catalog.products}
</div>

<div>
Services:
${growthCoachData.catalog.services}
</div>

<div>
Current Listings:
${growthCoachData.catalog.current}
</div>

<div>
Required Listings:
${growthCoachData.catalog.required}
</div>

<div>
${growthCoachData.catalog.required-growthCoachData.catalog.current}
more listing(s) required
</div>

`;

}

else if(index==="3"){

const details =
$("coachDetails3");

const isHidden =
details.style.display==="none";

details.style.display =
isHidden ? "block" : "none";

btn.textContent =
isHidden
? "Hide Details"
: "See Details";

details.innerHTML=`

<div class="coach-detail-score">
Current Score: ${growthCoachData.reviews.score}/${growthCoachData.reviews.maxScore}
</div>

<div>This Month: ${growthCoachData.reviews.thisMonth}</div>

<div>Target This Month: ${growthCoachData.reviews.targetThisMonth}</div>

<div>
${growthCoachData.reviews.targetThisMonth-growthCoachData.reviews.thisMonth}
more reviews required
</div>

`;

}

else if(index==="4"){

const details =
$("coachDetails4");

const isHidden =
details.style.display==="none";

details.style.display =
isHidden ? "block" : "none";

btn.textContent =
isHidden
? "Hide Details"
: "See Details";

details.innerHTML=`

<div class="coach-detail-score">
Current Score: ${growthCoachData.sponsorship.score}/${growthCoachData.sponsorship.maxScore}
</div>

<div>
Business Type:
${growthCoachData.sponsorship.businessType.charAt(0).toUpperCase() + growthCoachData.sponsorship.businessType.slice(1)}
</div>

<div>
Business Sponsored:
${growthCoachData.sponsorship.businessSponsoredText}
</div>

<div>
Products Sponsored:
${growthCoachData.sponsorship.productsSponsoredText}
</div>

<div>
Services Sponsored:
${growthCoachData.sponsorship.servicesSponsoredText}
</div>

`;

}

};

});

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

document.addEventListener("DOMContentLoaded",()=>{

const rankingFactorsBtn=$("rankingFactorsBtn");
const rankingFactorsModal=$("rankingFactorsModal");
const closeRankingFactorsModal=$("closeRankingFactorsModal");
const rankingModal=$("rankingCategoryModal");
const changeRankingCategoryBtn=$("changeRankingCategoryBtn");
const closeRankingCategoryModal=$("closeRankingCategoryModal");
const rankingCategorySelect=$("rankingCategorySelect");
const rankingSubcategorySelect=$("rankingSubcategorySelect");

rankingCategorySelect.onchange=()=>{

const subs=
rankingCategoryMap[
rankingCategorySelect.value
] || [];

rankingSubcategorySelect.innerHTML=
subs.map(
sub=>
`<option value="${sub}">${sub}</option>`
).join("");

};

if(changeRankingCategoryBtn){

changeRankingCategoryBtn.onclick=()=>{

rankingModal.classList.add("show");

};

}

if(closeRankingCategoryModal){

closeRankingCategoryModal.onclick=()=>{

rankingModal.classList.remove("show");

};

}

if(rankingModal){

rankingModal.onclick=e=>{

if(e.target===rankingModal){

rankingModal.classList.remove("show");

}

};

}

if(rankingFactorsBtn){

rankingFactorsBtn.onclick=()=>{

rankingFactorsModal.classList.add("show");

};

}

if(closeRankingFactorsModal){

closeRankingFactorsModal.onclick=()=>{

rankingFactorsModal.classList.remove("show");

};

}

if(rankingFactorsModal){

rankingFactorsModal.onclick=e=>{

if(e.target===rankingFactorsModal){

rankingFactorsModal.classList.remove("show");

}

};

}

const applyRankingCategoryBtn=$("applyRankingCategoryBtn");

if(applyRankingCategoryBtn){

applyRankingCategoryBtn.onclick=()=>{

selectedRankingCategory=
$("rankingCategorySelect").value;

selectedRankingSubcategory=
$("rankingSubcategorySelect").value;

console.log(selectedRankingCategory);
console.log(selectedRankingSubcategory);

renderRanking();

$("rankingCategoryModal").classList.remove("show");

};

}

});

const rankingCategoryMap={

"Professional Services":[
"Accountant/Auditor",
"Tax Consultant",
"Lawyer",
"Architect"
],

"Fashion & Tailoring":[
"Fashion Designer",
"Tailor",
"Makeup Artist",
"Barber"
],

"Local Food & Canteens":[
"Restaurant",
"Caterer",
"Bakery",
"Food Vendor"
],

"Digital & Tech Services":[
"Web Designer",
"Graphic Designer",
"Software Developer",
"Digital Marketer"
],

"Home Services":[
"Plumber",
"Electrician",
"Painter",
"Cleaner"
]

};