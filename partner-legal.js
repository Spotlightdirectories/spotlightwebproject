document.addEventListener("DOMContentLoaded", () => {

  const tabs = document.querySelectorAll(".partner-tab");
  const contents = document.querySelectorAll(".partner-tab-content");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {

      // remove active from all tabs
      tabs.forEach(t => t.classList.remove("active"));

      // hide all content
      contents.forEach(c => c.classList.remove("active"));

      // activate clicked tab
      tab.classList.add("active");

      // show matching content
      const target = tab.getAttribute("data-tab");
      document.getElementById(target).classList.add("active");

    });
  });

  const faqItems = document.querySelectorAll(".partner-faq-item");

faqItems.forEach(item => {
  const question = item.querySelector(".partner-faq-question");

  question.addEventListener("click", () => {

    // close others (optional: remove if you want multiple open)
    faqItems.forEach(i => {
      if (i !== item) i.classList.remove("active");
    });

    // toggle current
    item.classList.toggle("active");

  });
});

});