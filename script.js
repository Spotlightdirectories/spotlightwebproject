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

// AUTO RESPOND POPUP

document.addEventListener('DOMContentLoaded', () => {
  const MOBILE_MAX = 767; // same breakpoint as CSS
  const btns = Array.from(document.querySelectorAll('.learn-more-btn'));
  const overlay = createOverlay();
  let currentlyModal = null; // the detail element currently moved to body
  let savedPlacement = new WeakMap(); // store original parent/nextSibling per detail

  function isMobile() {
    return window.matchMedia(`(max-width: ${MOBILE_MAX}px)`).matches;
  }

  function createOverlay() {
    const ov = document.createElement('div');
    ov.className = 'modal-overlay';
    document.body.appendChild(ov);
    ov.addEventListener('click', closeActiveModal);
    return ov;
  }

  function closeAllAccordions() {
    document.querySelectorAll('.addon-card.active').forEach(c => c.classList.remove('active'));
  }

  function ensureCloseButton(detail) {
    if (!detail.querySelector('.modal-close')) {
      const btn = document.createElement('button');
      btn.className = 'modal-close';
      btn.setAttribute('aria-label', 'Close details');
      btn.innerHTML = '✕';
      btn.addEventListener('click', closeActiveModal);
      // make it visually on top by inserting at start
      detail.style.position = detail.style.position || 'relative';
      detail.appendChild(btn);
    }
  }

  function openAccordion(card, detail) {
    // close other accordions for a cleaner UX
    document.querySelectorAll('.addon-card.active').forEach(c => {
      if (c !== card) c.classList.remove('active');
    });
    card.classList.toggle('active');
    // scroll into view when opening
    if (card.classList.contains('active')) {
      detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function openModal(detail) {
    if (currentlyModal) closeActiveModal();

    // save original place
    if (!savedPlacement.has(detail)) {
      savedPlacement.set(detail, {
        parent: detail.parentNode,
        nextSibling: detail.nextElementSibling
      });
    }

    ensureCloseButton(detail);

    // move into body and style as modal
    document.body.appendChild(detail);
    detail.classList.add('modal');
    detail.setAttribute('role', 'dialog');
    detail.setAttribute('aria-modal', 'true');
    detail.tabIndex = -1;
    overlay.classList.add('active');
    document.body.classList.add('modal-open');

    // focus management
    currentlyModal = detail;
    // allow some time for animation then focus
    requestAnimationFrame(() => detail.focus());

    // ESC key handler
    document.addEventListener('keydown', escHandler);
  }

  function escHandler(e) {
    if (e.key === 'Escape') closeActiveModal();
  }

  function closeActiveModal() {
    if (!currentlyModal) return;
    const detail = currentlyModal;
    // restore to original place
    const saved = savedPlacement.get(detail);
    if (saved && saved.parent) {
      if (saved.nextSibling) saved.parent.insertBefore(detail, saved.nextSibling);
      else saved.parent.appendChild(detail);
    }
    detail.classList.remove('modal');
    detail.removeAttribute('role');
    detail.removeAttribute('aria-modal');
    detail.tabIndex = 0; // keep focusable if needed
    overlay.classList.remove('active');
    document.body.classList.remove('modal-open');
    currentlyModal = null;
    document.removeEventListener('keydown', escHandler);
  }

  // Attach click handlers
  btns.forEach(btn => {
    btn.addEventListener('click', (ev) => {
      const targetId = btn.dataset.target;
      if (!targetId) return;
      const detail = document.getElementById(targetId);
      if (!detail) return;

      const card = btn.closest('.addon-card') || detail.closest('.addon-card');

      if (isMobile()) {
        // Accordion behavior
        openAccordion(card, detail);
      } else {
        // Modal behavior
        openModal(detail);
      }
    });
  });

  // If window resizes from desktop to mobile while modal is open, restore it
  window.addEventListener('resize', () => {
    if (currentlyModal && isMobile()) {
      closeActiveModal();
      // optionally open as accordion — find its card and set active
      const detail = currentlyModal;
      const placement = savedPlacement.get(detail);
      if (placement && placement.parent) {
        const card = placement.parent.closest('.addon-card') || placement.parent.querySelector('.addon-card');
        if (card) card.classList.add('active');
      }
    }
  });

  // Expose for debugging (optional)
  window._addonsUI = {
    openModalForId: id => {
      const d = document.getElementById(id); if (d) openModal(d);
    },
    closeModal: closeActiveModal
  };
});

