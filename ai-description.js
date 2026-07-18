// -----------------------------------------------------------------
// AI DESCRIPTION GENERATOR (item 56)
//
// Shared by all three "Generate with AI" buttons (business, product,
// service descriptions) on vendordashboard.html. Collects 3 short
// guided hints (produces far more specific output than a blank box
// or generating from category alone), calls the generate-description
// Edge Function, inserts the result into the right field, and shows
// a plan-aware toast that fades on its own.
//
// The 3 hint questions AND their guiding nudge text are type-specific
// — a whole business, a physical product, and a service are different
// enough that the same 3 questions don't fit all three naturally.
// Nudge wording is Cyril's own, chosen deliberately simple and clear
// for a mixed-literacy audience (semi-literate, literate, and
// professional vendors all using this).
// -----------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {

  const supabase = window.supabaseClient;

  const HINT_CONFIG = {
    business: {
      q1: {
        label: "What makes your business different?",
        nudge: "Think: something a competitor in your category can't easily copy. Or something special about your business",
        placeholder: "e.g. family-owned since 2015, same-day delivery"
      },
      q2: {
        label: "What you're known for",
        nudge: "The one thing customers always compliment or like that make them come back to patronize your business.",
        placeholder: "e.g. reliable customer service, quality products"
      },
      q3: {
        label: "Typical customer (optional)",
        nudge: "Who are your customers? Eg Schools? Businesses? Adults? Mothers? etc.",
        placeholder: "e.g. small businesses, young professionals"
      }
    },
    product: {
      q1: {
        label: "Key features or what's included",
        nudge: "List what\u2019s special about your product \u2014 material, size, what's in the pack, carton.",
        placeholder: "e.g. genuine leather, adjustable straps, 1-year warranty"
      },
      q2: {
        label: "What problem it solves / why buy it",
        nudge: "Finish the sentence: 'Why do customers buy your product?'",
        placeholder: "e.g. built to last for daily use, great for gifting"
      },
      q3: {
        label: "Who it's for (optional)",
        nudge: "Who are your customers? Ladies? Men, Unisex? Car owners? Builders? etc",
        placeholder: "e.g. professionals, students"
      }
    },
    service: {
      q1: {
        label: "What's included / how you deliver it",
        nudge: "How do you render your services? What is the process?",
        placeholder: "e.g. free consultation, same-day turnaround, on-site visits"
      },
      q2: {
        label: "What outcome customers get",
        nudge: "What do customers get after you have finished rendering the service? Why are you different?",
        placeholder: "e.g. spotless home, fully repaired AC"
      },
      q3: {
        label: "Ideal client (optional)",
        nudge: "Who books this most, or who should?",
        placeholder: "e.g. busy families, small offices"
      }
    }
  };

  function buildModal() {

    if (document.getElementById("aiDescModal")) return;

    const modal = document.createElement("div");
    modal.id = "aiDescModal";
    modal.className = "ai-desc-modal hidden";

    modal.innerHTML = `
      <div class="ai-desc-modal-content">
        <button type="button" class="ai-desc-close" id="aiDescClose">&times;</button>
        <h3 id="aiDescTitle">Generate Description with AI</h3>
        <p class="ai-desc-subtext">A few short details help Claude write something specific to you, not generic filler.</p>

        <label id="aiDescLabel1">What makes it different?</label>
        <p class="ai-desc-nudge" id="aiDescNudge1"></p>
        <input type="text" id="aiDescDifferentiator" placeholder="" />

        <label id="aiDescLabel2">What it's known for / specialty</label>
        <p class="ai-desc-nudge" id="aiDescNudge2"></p>
        <input type="text" id="aiDescSpecialty" placeholder="" />

        <label id="aiDescLabel3">Typical customer (optional)</label>
        <p class="ai-desc-nudge" id="aiDescNudge3"></p>
        <input type="text" id="aiDescCustomer" placeholder="" />

        <div id="aiDescError" class="ai-desc-error hidden"></div>

        <button type="button" id="aiDescSubmit" class="vd-primary-btn">Generate</button>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById("aiDescClose").addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

  }

  function closeModal() {
    document.getElementById("aiDescModal")?.classList.add("hidden");
  }

  function showToast(message) {

    let toast = document.getElementById("aiDescToast");

    if (!toast) {
      toast = document.createElement("div");
      toast.id = "aiDescToast";
      toast.className = "ai-desc-toast";
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 3500);

  }

  let currentTargetId = null;
  let currentItemNameId = null;
  let currentType = null;

  function openModal(type, targetId, itemNameId) {

    buildModal();

    currentType = type;
    currentTargetId = targetId;
    currentItemNameId = itemNameId || null;

    const titleMap = {
      business: "Generate Business Description",
      product: "Generate Product Description",
      service: "Generate Service Description"
    };

    const config = HINT_CONFIG[type] || HINT_CONFIG.business;

    document.getElementById("aiDescTitle").textContent = titleMap[type] || "Generate Description";

    document.getElementById("aiDescLabel1").textContent = config.q1.label;
    document.getElementById("aiDescNudge1").textContent = config.q1.nudge;
    document.getElementById("aiDescDifferentiator").placeholder = config.q1.placeholder;
    document.getElementById("aiDescDifferentiator").value = "";

    document.getElementById("aiDescLabel2").textContent = config.q2.label;
    document.getElementById("aiDescNudge2").textContent = config.q2.nudge;
    document.getElementById("aiDescSpecialty").placeholder = config.q2.placeholder;
    document.getElementById("aiDescSpecialty").value = "";

    document.getElementById("aiDescLabel3").textContent = config.q3.label;
    document.getElementById("aiDescNudge3").textContent = config.q3.nudge;
    document.getElementById("aiDescCustomer").placeholder = config.q3.placeholder;
    document.getElementById("aiDescCustomer").value = "";

    document.getElementById("aiDescError").classList.add("hidden");

    document.getElementById("aiDescModal").classList.remove("hidden");

  }

  document.addEventListener("click", (e) => {

    const btn = e.target.closest(".vd-ai-generate-btn");
    if (!btn) return;

    const type = btn.dataset.aiType;
    const targetId = btn.dataset.aiTarget;
    const itemNameId = btn.dataset.aiItemName;

    openModal(type, targetId, itemNameId);

  });

  document.addEventListener("click", async (e) => {

    if (e.target.id !== "aiDescSubmit") return;

    const submitBtn = e.target;
    const errorEl = document.getElementById("aiDescError");

    errorEl.classList.add("hidden");
    submitBtn.disabled = true;
    submitBtn.textContent = "Generating...";

    // Field IDs stay generic (differentiator/specialty/targetCustomer)
    // even though their on-screen labels/nudges are type-specific —
    // the Edge Function's prompt-building logic labels them correctly
    // server-side based on `type`.
    const hints = {
      differentiator: document.getElementById("aiDescDifferentiator").value.trim(),
      specialty: document.getElementById("aiDescSpecialty").value.trim(),
      targetCustomer: document.getElementById("aiDescCustomer").value.trim()
    };

    let itemName = null;
    if (currentItemNameId) {
      const itemNameField = document.getElementById(currentItemNameId);
      itemName = itemNameField ? itemNameField.value.trim() : null;
    }

    try {

      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        "https://gyvzmktavyrevfxnwsay.supabase.co/functions/v1/generate-description",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": window.SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${session?.access_token || ""}`
          },
          body: JSON.stringify({ type: currentType, hints, itemName })
        }
      );

      const result = await response.json();

      if (!response.ok || result.error) {
        errorEl.textContent = result.error || "Generation failed. Please try again.";
        errorEl.classList.remove("hidden");
        submitBtn.disabled = false;
        submitBtn.textContent = "Generate";
        return;
      }

      const targetEl = document.getElementById(currentTargetId);

      if (targetEl) {
        if (targetEl.tagName === "TEXTAREA" || targetEl.tagName === "INPUT") {
          targetEl.value = result.text;
        } else {
          // contenteditable business description field
          targetEl.textContent = result.text;
        }
      }

      closeModal();

      // Toast wording matches what's ACTUALLY enforced per type —
      // only business description is plan-based; product/service
      // have their own fixed constraints unrelated to plan tier (see
      // the Edge Function for why).
      if (result.type === "business") {
        showToast(`Generated within your ${(result.planTier || "").charAt(0).toUpperCase() + (result.planTier || "").slice(1)} plan's ${result.limit}-word limit`);
      } else if (result.type === "service") {
        showToast(`Generated within the required 280–500 character range for service descriptions`);
      } else {
        showToast(`Generated to stay under the 200-character display limit for product descriptions`);
      }

    } catch (err) {
      console.error("AI description generation error:", err);
      errorEl.textContent = "Something went wrong. Please try again.";
      errorEl.classList.remove("hidden");
    }

    submitBtn.disabled = false;
    submitBtn.textContent = "Generate";

  });

});
