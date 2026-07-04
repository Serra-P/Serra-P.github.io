(function () {
  const root = document.documentElement;
  root.classList.add("js-enabled");

  const navToggle = document.querySelector(".nav-toggle");
  const navLinks = document.querySelector("#site-nav");
  const navItems = Array.from(document.querySelectorAll(".nav-links a[href^='#']"));
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const closeNavigation = () => {
    if (!navToggle || !navLinks) return;
    navToggle.setAttribute("aria-expanded", "false");
    navLinks.classList.remove("is-open");
    document.body.classList.remove("nav-open");
  };

  if (navToggle && navLinks) {
    navToggle.addEventListener("click", () => {
      const isOpen = navToggle.getAttribute("aria-expanded") === "true";
      navToggle.setAttribute("aria-expanded", String(!isOpen));
      navLinks.classList.toggle("is-open", !isOpen);
      document.body.classList.toggle("nav-open", !isOpen);
    });

    navItems.forEach((link) => {
      link.addEventListener("click", closeNavigation);
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeNavigation();
    });
  }

  const year = document.querySelector("#current-year");
  if (year) {
    year.textContent = String(new Date().getFullYear());
  }

  const filterButtons = Array.from(document.querySelectorAll("[data-filter]"));
  const labCards = Array.from(document.querySelectorAll("[data-lab-card]"));

  if (filterButtons.length > 0 && labCards.length > 0) {
    filterButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const filter = button.dataset.filter || "all";

        filterButtons.forEach((item) => {
          const isActive = item === button;
          item.classList.toggle("is-active", isActive);
          item.setAttribute("aria-pressed", String(isActive));
        });

        labCards.forEach((card) => {
          const categories = (card.dataset.category || "").split(/\s+/);
          const isVisible = filter === "all" || categories.includes(filter);
          card.classList.toggle("is-filtered-out", !isVisible);
        });
      });
    });

    filterButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.classList.contains("is-active")));
    });
  }

  if ("IntersectionObserver" in window) {
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.getAttribute("id");
          navItems.forEach((link) => {
            const isActive = link.getAttribute("href") === `#${id}`;
            link.classList.toggle("is-active", isActive);
            if (isActive) {
              link.setAttribute("aria-current", "page");
            } else {
              link.removeAttribute("aria-current");
            }
          });
        });
      },
      {
        rootMargin: "-42% 0px -50% 0px",
        threshold: 0.01,
      },
    );

    document.querySelectorAll(".section-anchor[id]").forEach((section) => {
      sectionObserver.observe(section);
    });
  }

  const revealItems = document.querySelectorAll(".reveal");
  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    {
      rootMargin: "0px 0px -12% 0px",
      threshold: 0.12,
    },
  );

  revealItems.forEach((item) => revealObserver.observe(item));
})();
