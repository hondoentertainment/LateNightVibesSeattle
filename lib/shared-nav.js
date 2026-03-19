/* ─── Shared navigation component ───
 * Injects consistent desktop top-nav and mobile bottom-nav across all pages.
 * Usage: Include this script, then call LNVNav.init({ page: "browse" })
 * Pages: "browse", "recommend", "planner", "neighborhoods"
 */
(function () {
  "use strict";

  var Cities = window.LNVCities;

  function cityLink(href) {
    return Cities ? Cities.cityLink(href) : href;
  }

  const NAV_LINKS = [
    { href: "index.html", label: "Browse Venues", page: "browse" },
    { href: "recommend.html", label: "Recommendations", page: "recommend" },
    { href: "planner.html", label: "Night Plan", page: "planner" },
    { href: "neighborhoods.html", label: "Compare", page: "neighborhoods" },
    { href: "index.html?view=saved", label: "Saved", page: "saved" },
    { href: "submit.html", label: "Submit a Venue", page: "submit" },
    { href: "mood.html", label: "Mood Match", page: "mood" },
    { href: "squad.html", label: "Squad Sync", page: "squad" },
    { href: "replay.html", label: "Night Replay", page: "replay" },
    { href: "safety.html", label: "Safe Night", page: "safety" },
    { href: "admin.html", label: "Admin", page: "admin", adminOnly: true },
  ];

  const BOTTOM_NAV_ITEMS = [
    {
      href: "index.html", label: "Browse", page: "browse", ariaLabel: "Browse venues",
      icon: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    },
    {
      href: "recommend.html", label: "For You", page: "recommend", ariaLabel: "For You recommendations",
      icon: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01z"/>',
    },
    {
      href: "planner.html", label: "Plan", page: "planner", ariaLabel: "Night plan builder",
      icon: '<path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/><path d="M12 6v6l4 2"/>',
    },
    {
      href: "index.html?view=saved", label: "Saved", page: "saved", ariaLabel: "Saved venues",
      icon: '<path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>',
    },
    {
      href: "submit.html", label: "Submit", page: "submit", ariaLabel: "Submit a venue",
      icon: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>',
    },
    {
      href: "safety.html", label: "Safety", page: "safety", ariaLabel: "Safe night toolkit",
      icon: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    },
  ];

  function buildDesktopNav(currentPage, options) {
    const nav = document.querySelector(".top-actions.desktop-only");
    if (!nav) return;

    // Preserve search wrapper if it exists (Browse page)
    const searchWrapper = nav.querySelector(".search-wrapper");
    nav.innerHTML = "";

    // Add city indicator before nav pills
    if (Cities) {
      const city = Cities.getCurrentCity();
      const cityLabel = document.createElement("a");
      cityLabel.href = "cities.html";
      cityLabel.className = "nav-city-label";
      cityLabel.textContent = "\uD83D\uDCCD" + city.name;
      cityLabel.title = "Switch city";
      cityLabel.setAttribute("aria-label", "Current city: " + city.name + ". Click to switch city");
      nav.appendChild(cityLabel);
    }

    if (searchWrapper) nav.appendChild(searchWrapper);

    NAV_LINKS.forEach((link) => {
      if (link.page === currentPage) return; // skip current page
      const a = document.createElement("a");
      a.href = cityLink(link.href);
      a.className = "nav-pill" + (link.adminOnly ? " nav-admin" : "");
      a.textContent = link.label;
      if (link.page === "saved") a.id = "savedLink";
      if (link.page === "admin" && options && options.adminId) a.id = options.adminId;
      nav.appendChild(a);
    });
  }

  function buildBottomNav(currentPage) {
    const nav = document.querySelector(".bottom-nav.mobile-only");
    if (!nav) return;

    nav.innerHTML = "";
    BOTTOM_NAV_ITEMS.forEach((item) => {
      const a = document.createElement("a");
      a.href = cityLink(item.href);
      a.className = "bottom-nav-item" + (item.page === currentPage ? " active" : "");
      a.setAttribute("aria-label", item.ariaLabel);
      if (item.page === currentPage) a.setAttribute("aria-current", "page");
      if (item.page === "saved") a.id = "savedNavItem";
      a.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">${item.icon}</svg><span>${item.label}</span>`;
      nav.appendChild(a);
    });
  }

  function updateBrandLink() {
    var brand = document.querySelector(".brand");
    if (!brand) return;
    var existing = brand.querySelector("a.brand-link");
    if (existing) return;
    // Wrap brand contents in a link to cities.html
    var link = document.createElement("a");
    link.href = "cities.html";
    link.className = "brand-link";
    link.style.textDecoration = "none";
    while (brand.firstChild) link.appendChild(brand.firstChild);
    brand.appendChild(link);
  }

  window.LNVNav = {
    init: function (opts) {
      const page = (opts && opts.page) || "browse";
      buildDesktopNav(page, opts);
      buildBottomNav(page);
      updateBrandLink();
    },
  };
})();
