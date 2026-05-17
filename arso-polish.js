(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduceMotion || !("IntersectionObserver" in window)) {
    document.documentElement.classList.add("arso-reveal-complete");
    return;
  }

  const revealSelector = [
    ".section",
    ".project-card",
    ".service-offering",
    ".project-example-card",
    ".case-study-card",
    ".crm-capability-grid article",
    ".crm-variant",
    ".homepage-capability-grid article",
    ".services-fit-cards article",
    ".crm-friction-card",
    ".crm-process-steps article"
  ].join(",");

  const revealItems = Array.from(document.querySelectorAll(revealSelector))
    .filter((item) => !item.closest(".site-header") && !item.closest(".site-footer"));

  revealItems.forEach((item, index) => {
    item.classList.add("arso-reveal");
    item.style.setProperty("--reveal-delay", `${Math.min(index % 6, 5) * 45}ms`);
  });

  document.documentElement.classList.add("arso-reveal-ready");

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    {
      rootMargin: "0px 0px -8% 0px",
      threshold: 0.08
    }
  );

  revealItems.forEach((item) => observer.observe(item));
})();
