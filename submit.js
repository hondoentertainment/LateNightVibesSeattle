/* ─── Submit a Venue ─── */
(function () {
  "use strict";

  var STORAGE_KEY = "lnv_pending_submissions";

  var VIBE_OPTIONS = [
    "chill", "dancey", "date-friendly", "divey", "drinks",
    "food-focused", "high-energy", "karaoke", "late-eats",
    "late-night", "live-music", "rooftop", "social", "sports",
    "sweet", "upscale",
  ];

  var cities = window.LNVCities || {};

  /* ─── Populate city dropdown ─── */
  var citySelect = document.getElementById("citySelect");
  var neighborhoodSelect = document.getElementById("neighborhoodSelect");

  var allCities = cities.getAllCities ? cities.getAllCities() : [];
  allCities.forEach(function (city) {
    var opt = document.createElement("option");
    opt.value = city.slug;
    opt.textContent = city.label || city.name;
    citySelect.appendChild(opt);
  });

  /* ─── Update neighborhood on city change ─── */
  citySelect.addEventListener("change", function () {
    var slug = citySelect.value;
    neighborhoodSelect.innerHTML = "";

    if (!slug) {
      neighborhoodSelect.disabled = true;
      var placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Select a city first";
      neighborhoodSelect.appendChild(placeholder);
      return;
    }

    neighborhoodSelect.disabled = false;
    var defaultOpt = document.createElement("option");
    defaultOpt.value = "";
    defaultOpt.textContent = "Select a neighborhood";
    neighborhoodSelect.appendChild(defaultOpt);

    var city = cities.getCityBySlug ? cities.getCityBySlug(slug) : null;
    var neighborhoods = city ? city.neighborhoods : [];
    neighborhoods.forEach(function (n) {
      var opt = document.createElement("option");
      opt.value = n;
      opt.textContent = n.replace(/_/g, " / ");
      neighborhoodSelect.appendChild(opt);
    });
  });

  /* ─── Render vibe tag toggles ─── */
  var vibeContainer = document.getElementById("vibeTagsContainer");
  var selectedVibes = new Set();

  VIBE_OPTIONS.forEach(function (vibe) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "vibe-tag-btn";
    btn.textContent = vibe;
    btn.setAttribute("aria-pressed", "false");
    btn.addEventListener("click", function () {
      if (selectedVibes.has(vibe)) {
        selectedVibes.delete(vibe);
        btn.classList.remove("active");
        btn.setAttribute("aria-pressed", "false");
      } else {
        selectedVibes.add(vibe);
        btn.classList.add("active");
        btn.setAttribute("aria-pressed", "true");
      }
    });
    vibeContainer.appendChild(btn);
  });

  /* ─── Form validation & submission ─── */
  var form = document.getElementById("submitForm");
  var errorsEl = document.getElementById("formErrors");
  var confirmationEl = document.getElementById("submitConfirmation");

  function validateForm() {
    var errors = [];

    if (!citySelect.value) errors.push("City is required.");
    if (!neighborhoodSelect.value) errors.push("Neighborhood is required.");
    if (!document.getElementById("venueName").value.trim()) errors.push("Venue name is required.");
    if (!document.getElementById("venueCategory").value) errors.push("Venue type is required.");
    if (!document.getElementById("venueClosing").value.trim()) errors.push("Closing time is required.");
    if (selectedVibes.size === 0) errors.push("Select at least one vibe tag.");

    var rating = document.getElementById("venueRating").value;
    if (rating !== "" && (parseFloat(rating) < 1 || parseFloat(rating) > 5)) {
      errors.push("Rating must be between 1 and 5.");
    }

    var website = document.getElementById("venueWebsite").value.trim();
    if (website && !/^https?:\/\/.+/.test(website)) {
      errors.push("Website must start with http:// or https://.");
    }

    return errors;
  }

  function getSubmissions() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (_e) {
      return [];
    }
  }

  function saveSubmission(submission) {
    var list = getSubmissions();
    list.push(submission);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    errorsEl.textContent = "";
    errorsEl.className = "form-errors";

    var errors = validateForm();
    if (errors.length) {
      errorsEl.innerHTML = errors.map(function (msg) {
        return "<div>" + escapeHtml(msg) + "</div>";
      }).join("");
      errorsEl.className = "form-errors form-errors-visible";
      errorsEl.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    var submission = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      city: citySelect.value,
      area: neighborhoodSelect.value,
      name: document.getElementById("venueName").value.trim(),
      category: document.getElementById("venueCategory").value,
      closingTime: document.getElementById("venueClosing").value.trim(),
      address: document.getElementById("venueAddress").value.trim(),
      website: document.getElementById("venueWebsite").value.trim(),
      rating: document.getElementById("venueRating").value || "",
      vibeTags: Array.from(selectedVibes).join(", "),
      submittedAt: new Date().toISOString(),
      status: "pending",
    };

    saveSubmission(submission);

    form.closest(".submit-card").style.display = "none";
    confirmationEl.style.display = "";
    confirmationEl.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  /* ─── Submit another ─── */
  document.getElementById("submitAnother").addEventListener("click", function () {
    form.reset();
    selectedVibes.clear();
    vibeContainer.querySelectorAll(".vibe-tag-btn").forEach(function (btn) {
      btn.classList.remove("active");
      btn.setAttribute("aria-pressed", "false");
    });
    neighborhoodSelect.innerHTML = '<option value="">Select a city first</option>';
    neighborhoodSelect.disabled = true;
    errorsEl.textContent = "";
    errorsEl.className = "form-errors";
    confirmationEl.style.display = "none";
    form.closest(".submit-card").style.display = "";
    form.closest(".submit-card").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  /* ─── Escape HTML helper ─── */
  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }
})();
