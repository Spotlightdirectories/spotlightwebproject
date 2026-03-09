document.addEventListener("DOMContentLoaded", async () => {

  const supabase = window.supabaseClient;

  const params = new URLSearchParams(window.location.search);
  const mediaId = params.get("media_id");
  console.log("Media ID:", mediaId);

  if (!mediaId) return;

  const { data, error } = await supabase
     .from("vendor_media")
     .select("*, vendors(whatsapp, slug)")
     .eq("id", mediaId)
     .single();

  if (error) {
    console.error("Product load error:", error.message);
    return;
  }

  const imageEl = document.getElementById("productImage");
  const titleEl = document.getElementById("productTitle");
  const priceEl = document.getElementById("productPrice");
  const descEl = document.getElementById("productDescription");

  const contactBtn = document.getElementById("contactVendorBtn");
  const backLink = document.getElementById("backToVendor");

  if (imageEl) imageEl.src = data.file_url;
  if (titleEl) titleEl.textContent = data.title || "";
  if (descEl) descEl.textContent = data.description || "";

  if (priceEl && data.price) {
    priceEl.textContent = "₦ " + Number(data.price).toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  if (contactBtn && data.vendors?.whatsapp) {
  contactBtn.href = `https://wa.me/${data.vendors.whatsapp}`;
}

if (backLink && data.vendors?.slug) {
  backLink.href = `vendor-profile.html?slug=${data.vendors.slug}`;
}

});