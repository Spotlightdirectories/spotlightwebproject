document.addEventListener("DOMContentLoaded", async () => {

const supabase = window.supabaseClient;


// ===============================
// RESOLVE CURRENT USER
// ===============================

const {
data: { session }
} = await supabase.auth.getSession();

const currentUser = session?.user || null;

if (!currentUser) {
console.error("User not logged in");
return;
}


// ===============================
// LOAD VENDOR
// ===============================

const { data: vendor } = await supabase
.from("vendors")
.select("*")
.eq("auth_user_id", currentUser.id)
.maybeSingle();

if (!vendor) {
console.error("Vendor not found");
return;
}

// ===============================
// PLACEHOLDER
// ===============================

window.vendorData = vendor;

// ===============================
// PLAN LIMITS
// ===============================

// ===============================
// BUSINESS NAME GUARD
// Uses word-boundary matching (not plain substring) so a short
// business name like "AB" doesn't false-positive on unrelated
// words like "Cabin". Still catches real duplication like
// vendor name "ABC Traders" appearing in "ABC Traders Ikeja".
// ===============================
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsBusinessName(text, businessName) {
  if (!businessName) return false;
  const pattern = new RegExp(`\\b${escapeRegex(businessName)}\\b`, "i");
  return pattern.test(text);
}

const BRANCH_LIMITS = {
free: 0,
standard: 0,
enterprise: 10,
elite: 30,
custom: Infinity
};


// ===============================
// CREATE BRANCH
// ===============================

const branchForm = document.getElementById("branchForm");

const branchWhatsappInput = document.getElementById("branchWhatsapp");
const branchStateSelect = document.getElementById("branchState");
const branchLgaSelect = document.getElementById("branchLga");

// ===============================
// STATE / LGA CASCADING SELECT
// Same source of truth (window.nigeriaData) already used for the
// vendor's own address on vendordashboard.html.
// ===============================
if (branchStateSelect) {
  Object.keys(window.nigeriaData || {}).sort().forEach(stateName => {
    const opt = document.createElement("option");
    opt.value = stateName;
    opt.textContent = stateName;
    branchStateSelect.appendChild(opt);
  });

  branchStateSelect.addEventListener("change", () => {
    populateLgaOptions(branchStateSelect.value);
  });
}

function populateLgaOptions(stateName, selectedLga) {
  if (!branchLgaSelect) return;
  branchLgaSelect.innerHTML = '<option value="">Select LGA</option>';
  const lgas = (window.nigeriaData || {})[stateName] || [];
  lgas.forEach(lgaName => {
    const opt = document.createElement("option");
    opt.value = lgaName;
    opt.textContent = lgaName;
    if (lgaName === selectedLga) opt.selected = true;
    branchLgaSelect.appendChild(opt);
  });
}

// FORCE +234 PREFIX
branchWhatsappInput.value = "+234";

branchWhatsappInput.addEventListener("input", () => {
  let raw = branchWhatsappInput.value.replace("+234", "");

  raw = raw.replace(/\D/g, "");

  if (raw.startsWith("0")) {
    raw = raw.slice(1);
  }

  raw = raw.slice(0, 10);

  branchWhatsappInput.value = "+234" + raw;
});

if (branchForm) {

branchForm.addEventListener("submit", async (e) => {

e.preventDefault();

const branchInput = document.getElementById("branchName").value.trim();

if (!branchInput) {
  alert("Branch name and address are required.");
  return;
}

// Block vendor name usage
if (containsBusinessName(branchInput, vendor.name)) {
  alert("Do not include your business name. Enter only the branch identifier (e.g. 'Isolo').");
  return;
}

// Block formatted input
if (branchInput.includes(" - ")) {
  alert("Enter only branch identifier without '-' formatting.");
  return;
}

const name = `${vendor.name} - ${branchInput}`;

const address = document.getElementById("branchAddress").value.trim();
const phone = document.getElementById("branchPhone").value.trim();
const whatsapp = document.getElementById("branchWhatsapp").value.trim();
const state = document.getElementById("branchState").value;
const lga = document.getElementById("branchLga").value;
const latitude = document.getElementById("branchLatitude").value.trim();
const longitude = document.getElementById("branchLongitude").value.trim();

if (!branchInput || !address) {
  alert("Branch name and address are required.");
  return;
}

if (!state || !lga) {
  alert("Please select the branch's state and LGA.");
  return;
}

// check plan limit (only applies when creating a NEW branch —
// editing an existing branch must never be blocked by the limit,
// since you're not adding a row, just changing one you already have)
if (!window.editingBranchId) {

const limit = BRANCH_LIMITS[vendor.plan_tier] ?? 0;

const { data: existingBranches } = await supabase
.from("branches")
.select("id")
.eq("vendor_id", vendor.id);

if (existingBranches && existingBranches.length >= limit) {

alert("You have reached the maximum number of branches allowed for your plan.");
return;

}

}

// insert branch
let error;

if (window.editingBranchId) {

  const result = await supabase
  .from("branches")
  .update({
  branch_name: name,
  address: address,
  phone: phone,
  whatsapp: whatsapp,
  state: state,
  lga: lga,
  latitude: latitude || null,
  longitude: longitude || null
})
  .eq("id", window.editingBranchId);

  error = result.error;

} else {

  const result = await supabase
  .from("branches")
  .insert({
  vendor_id: vendor.id,
  branch_name: name,
  address: address,
  phone: phone,
  whatsapp: whatsapp,
  state: state,
  lga: lga,
  latitude: latitude || null,
  longitude: longitude || null
});

  error = result.error;

}

if (error) {
console.error("Branch insert error:", error.message);
alert("Could not create branch.");
return;
}

location.reload();

});

}

// ===============================
// LOAD BRANCHES
// ===============================

async function loadBranches() {

const container = document.getElementById("branchesContainer");

if (!container) return;

container.innerHTML = "";

const { data: branches } = await supabase
.from("branches")
.select("*")
.eq("vendor_id", vendor.id)
.order("created_at", { ascending: true });

if (!branches || branches.length === 0) {

container.innerHTML = "<p>No branches created yet.</p>";
return;

}

branches.forEach(branch => {

const item = document.createElement("div");
item.className = "branch-row";

const name = document.createElement("div");
name.textContent = branch.branch_name;

const address = document.createElement("div");
address.textContent = branch.address;

const region = document.createElement("div");
region.textContent = (branch.state || branch.lga) ? `${branch.lga || "—"}, ${branch.state || "—"}` : "—";

const editBtn = document.createElement("button");
editBtn.textContent = "Edit";

editBtn.addEventListener("click", () => {

document.getElementById("branchName").value = branch.branch_name || "";
document.getElementById("branchAddress").value = branch.address || "";
document.getElementById("branchPhone").value = branch.phone || "";
document.getElementById("branchWhatsapp").value = branch.whatsapp || "";
document.getElementById("branchLatitude").value = branch.latitude || "";
document.getElementById("branchLongitude").value = branch.longitude || "";

if (branchStateSelect) branchStateSelect.value = branch.state || "";
populateLgaOptions(branch.state, branch.lga);

window.editingBranchId = branch.id;

});

const deleteBtn = document.createElement("button");
deleteBtn.textContent = "Delete";

deleteBtn.addEventListener("click", async () => {

const confirmDelete = confirm("Delete this branch?");
if (!confirmDelete) return;

const { error } = await supabase
.from("branches")
.delete()
.eq("id", branch.id);

if (error) {
console.error("Delete error:", error.message);
alert("Could not delete branch.");
return;
}

location.reload();

});

item.appendChild(name);
item.appendChild(address);
item.appendChild(region);
item.appendChild(editBtn);
item.appendChild(deleteBtn);

container.appendChild(item);

});

}

loadBranches();

});