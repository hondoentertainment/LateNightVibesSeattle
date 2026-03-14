/**
 * Vibe Check UI — wires the vibe check feature into the detail drawer.
 *
 * Browser-only (not UMD). Depends on:
 *   - window.LNVVibeCheck  (lib/vibe-check.js)
 *   - window.LNVCore       (lib/core.js — showToast)
 *
 * Does NOT modify app.js. Hooks into the detail drawer by observing when it
 * opens and injecting the vibe check button + strip.
 */
(function () {
  "use strict";

  /* ─── Common vibe tags for the modal picker ─── */
  var VIBE_TAGS = [
    "chill", "dancey", "divey", "upscale", "high-energy",
    "live-music", "date-friendly", "late-eats", "casual", "sports"
  ];

  var _currentVenueName = null;

  /* ─── Render helpers ─── */

  /**
   * renderVibeCheckBadge(venueName)
   * Returns HTML string for a small badge shown on venue cards.
   */
  function renderVibeCheckBadge(venueName) {
    var vc = window.LNVVibeCheck;
    if (!vc) return "";
    var agg = vc.getAggregatedVibe(venueName);
    if (!agg) return "";
    return '<span class="vibe-check-badge">' +
      '<span class="vibe-check-badge-pulse"></span>' +
      '<span>' + agg.checkCount + ' vibe ' + (agg.checkCount === 1 ? 'check' : 'checks') + '</span>' +
    '</span>';
  }

  /**
   * renderVibeCheckStrip(venueName)
   * Returns HTML string for a summary strip shown in the detail drawer.
   */
  function renderVibeCheckStrip(venueName) {
    var vc = window.LNVVibeCheck;
    if (!vc) return "";
    var agg = vc.getAggregatedVibe(venueName);
    if (!agg) return "";

    var energyBars = "";
    for (var i = 1; i <= 5; i++) {
      energyBars += '<span class="vibe-check-energy-bar-segment' +
        (i <= Math.round(agg.avgEnergy) ? ' filled' : '') + '"></span>';
    }

    var vibeChips = "";
    if (agg.topVibes && agg.topVibes.length) {
      vibeChips = '<div class="vibe-check-strip-vibes">' +
        agg.topVibes.map(function (v) { return '<span class="pill">' + v + '</span>'; }).join("") +
        '</div>';
    }

    return '<div class="vibe-check-strip">' +
      '<div class="vibe-check-strip-header">' +
        '<span class="vibe-check-strip-title">' +
          '<span class="vibe-check-badge-pulse"></span> Live Vibe' +
        '</span>' +
        '<span class="vibe-check-strip-freshness">' + agg.freshness + ' &middot; ' + agg.checkCount + ' check' + (agg.checkCount === 1 ? '' : 's') + '</span>' +
      '</div>' +
      '<div class="vibe-check-strip-stats">' +
        '<span class="vibe-check-strip-stat">' +
          '<span class="vibe-check-strip-stat-label">Energy</span>' +
          '<span class="vibe-check-energy-bar">' + energyBars + '</span>' +
        '</span>' +
        '<span class="vibe-check-strip-stat">' +
          '<span class="vibe-check-strip-stat-label">Crowd</span> ' + agg.dominantCrowd +
        '</span>' +
        '<span class="vibe-check-strip-stat">' +
          '<span class="vibe-check-strip-stat-label">Volume</span> ' + agg.dominantVolume +
        '</span>' +
      '</div>' +
      vibeChips +
    '</div>';
  }

  /* ─── Modal management ─── */

  function _getOverlay() { return document.getElementById("vibeCheckOverlay"); }
  function _getModal() { return document.getElementById("vibeCheckModal"); }

  function _populateModal(venueName) {
    var modal = _getModal();
    if (!modal) return;
    _currentVenueName = venueName;
    var vc = window.LNVVibeCheck;
    var onCooldown = vc && vc.hasRecentCheck(venueName);

    var html = '<div class="drawer-handle"></div>' +
      '<h3 class="vibe-check-modal-title" id="vibeCheckTitle">Vibe Check</h3>' +
      '<p class="vibe-check-modal-venue">' + _escapeHtml(venueName) + '</p>';

    if (onCooldown) {
      html += '<p class="vibe-check-cooldown-msg">You submitted a vibe check recently. Check back in a bit!</p>';
    } else {
      // Energy
      html += '<div class="vibe-check-section-label">Energy level</div>' +
        '<div class="vibe-check-energy-slider" id="vcEnergySlider">';
      for (var i = 1; i <= 5; i++) {
        html += '<button type="button" class="vibe-check-energy-dot" data-energy="' + i + '">' + i + '</button>';
      }
      html += '</div>' +
        '<div class="vibe-check-energy-labels"><span>Mellow</span><span>Electric</span></div>';

      // Crowd level
      html += '<div class="vibe-check-section-label">Crowd level</div>' +
        '<div class="vibe-check-options" id="vcCrowdOptions">' +
          '<button type="button" class="vibe-check-chip" data-crowd="empty">Empty</button>' +
          '<button type="button" class="vibe-check-chip" data-crowd="moderate">Moderate</button>' +
          '<button type="button" class="vibe-check-chip" data-crowd="packed">Packed</button>' +
        '</div>';

      // Music volume
      html += '<div class="vibe-check-section-label">Music volume</div>' +
        '<div class="vibe-check-options" id="vcVolumeOptions">' +
          '<button type="button" class="vibe-check-chip" data-volume="quiet">Quiet</button>' +
          '<button type="button" class="vibe-check-chip" data-volume="medium">Medium</button>' +
          '<button type="button" class="vibe-check-chip" data-volume="loud">Loud</button>' +
        '</div>';

      // Vibe tags
      html += '<div class="vibe-check-section-label">Vibes (optional)</div>' +
        '<div class="vibe-check-vibe-tags" id="vcVibeTags">';
      VIBE_TAGS.forEach(function (tag) {
        html += '<button type="button" class="vibe-check-vibe-tag" data-vibe="' + tag + '">' + tag + '</button>';
      });
      html += '</div>';

      // Submit
      html += '<button type="button" class="vibe-check-submit" id="vcSubmitBtn">Submit Vibe Check</button>';
    }

    modal.innerHTML = html;

    // Bind interactions (only if not on cooldown)
    if (!onCooldown) {
      _bindModalInteractions();
    }
  }

  function _bindModalInteractions() {
    var modal = _getModal();
    if (!modal) return;

    // Energy dots
    var energySlider = modal.querySelector("#vcEnergySlider");
    if (energySlider) {
      energySlider.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-energy]");
        if (!btn) return;
        var dots = energySlider.querySelectorAll(".vibe-check-energy-dot");
        dots.forEach(function (d) { d.classList.remove("active"); });
        btn.classList.add("active");
        if (window.LNV_HAPTICS) window.LNV_HAPTICS.light();
      });
    }

    // Crowd chips (single select)
    var crowdOptions = modal.querySelector("#vcCrowdOptions");
    if (crowdOptions) {
      crowdOptions.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-crowd]");
        if (!btn) return;
        crowdOptions.querySelectorAll(".vibe-check-chip").forEach(function (c) { c.classList.remove("active"); });
        btn.classList.add("active");
        if (window.LNV_HAPTICS) window.LNV_HAPTICS.light();
      });
    }

    // Volume chips (single select)
    var volumeOptions = modal.querySelector("#vcVolumeOptions");
    if (volumeOptions) {
      volumeOptions.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-volume]");
        if (!btn) return;
        volumeOptions.querySelectorAll(".vibe-check-chip").forEach(function (c) { c.classList.remove("active"); });
        btn.classList.add("active");
        if (window.LNV_HAPTICS) window.LNV_HAPTICS.light();
      });
    }

    // Vibe tags (multi-select)
    var vibeTags = modal.querySelector("#vcVibeTags");
    if (vibeTags) {
      vibeTags.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-vibe]");
        if (!btn) return;
        btn.classList.toggle("active");
        if (window.LNV_HAPTICS) window.LNV_HAPTICS.light();
      });
    }

    // Submit
    var submitBtn = modal.querySelector("#vcSubmitBtn");
    if (submitBtn) {
      submitBtn.addEventListener("click", _handleSubmit);
    }
  }

  function _handleSubmit() {
    var modal = _getModal();
    if (!modal || !_currentVenueName) return;

    var energyDot = modal.querySelector(".vibe-check-energy-dot.active");
    var crowdChip = modal.querySelector("[data-crowd].active");
    var volumeChip = modal.querySelector("[data-volume].active");

    // Energy is required
    if (!energyDot) {
      if (window.LNVCore && window.LNVCore.showErrorToast) {
        window.LNVCore.showErrorToast("Please select an energy level");
      }
      return;
    }

    var selectedVibes = [];
    modal.querySelectorAll(".vibe-check-vibe-tag.active").forEach(function (el) {
      selectedVibes.push(el.getAttribute("data-vibe"));
    });

    var data = {
      energy: parseInt(energyDot.getAttribute("data-energy"), 10),
      crowdLevel: crowdChip ? crowdChip.getAttribute("data-crowd") : "moderate",
      musicVolume: volumeChip ? volumeChip.getAttribute("data-volume") : "medium",
      vibes: selectedVibes
    };

    var vc = window.LNVVibeCheck;
    if (vc) vc.submitVibeCheck(_currentVenueName, data);

    _closeModal();

    if (window.LNVCore && window.LNVCore.showToast) {
      window.LNVCore.showToast("Vibe check submitted!");
    }
    if (window.LNV_HAPTICS) window.LNV_HAPTICS.confirm();

    // Refresh the strip in the detail drawer if it is still open
    _refreshDrawerStrip(_currentVenueName);
  }

  function _openModal(venueName) {
    var overlay = _getOverlay();
    var modal = _getModal();
    if (!overlay || !modal) return;

    _populateModal(venueName);

    overlay.style.display = "";
    modal.style.display = "";
    // Force reflow to enable CSS transition
    void modal.offsetHeight;
    overlay.classList.add("open");
    modal.classList.add("open");
  }

  function _closeModal() {
    var overlay = _getOverlay();
    var modal = _getModal();
    if (!overlay || !modal) return;

    overlay.classList.remove("open");
    modal.classList.remove("open");

    // Wait for transition then hide
    setTimeout(function () {
      overlay.style.display = "none";
      modal.style.display = "none";
    }, 300);
  }

  /* ─── Inject into detail drawer ─── */

  function _refreshDrawerStrip(venueName) {
    var body = document.getElementById("detailBody");
    if (!body) return;

    // Remove old strip & button
    var oldStrip = body.querySelector(".vibe-check-strip");
    if (oldStrip) oldStrip.remove();
    var oldBtn = body.querySelector(".vibe-check-btn");
    if (oldBtn) oldBtn.remove();

    // Find insertion point: after detail-vibes
    var vibesEl = body.querySelector(".detail-vibes");
    var insertAfter = vibesEl || body.querySelector(".detail-actions");
    if (!insertAfter) return;

    // Build strip + button
    var fragment = document.createElement("div");
    var stripHtml = renderVibeCheckStrip(venueName);
    var btnHtml = '<button type="button" class="vibe-check-btn" id="vcOpenBtn">' +
      '<span class="vibe-check-badge-pulse"></span> Vibe Check' +
    '</button>';
    fragment.innerHTML = stripHtml + btnHtml;

    // Insert each child after the vibes section
    var ref = insertAfter.nextSibling;
    while (fragment.firstChild) {
      insertAfter.parentNode.insertBefore(fragment.firstChild, ref);
    }

    // Bind the button
    var btn = body.querySelector("#vcOpenBtn");
    if (btn) {
      btn.addEventListener("click", function () {
        _openModal(venueName);
      });
    }
  }

  function _onDrawerOpen() {
    var titleEl = document.getElementById("detailTitle");
    if (!titleEl) return;
    var venueName = titleEl.textContent.trim();
    if (!venueName) return;

    // Small delay so the drawer body is populated first
    setTimeout(function () {
      _refreshDrawerStrip(venueName);
    }, 50);
  }

  /* ─── Observe detail drawer opening ─── */

  function _observeDrawer() {
    var drawer = document.getElementById("detailDrawer");
    if (!drawer) return;

    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        if (m.type === "attributes" && m.attributeName === "class") {
          if (drawer.classList.contains("open")) {
            _onDrawerOpen();
          }
        }
      });
    });

    observer.observe(drawer, { attributes: true, attributeFilter: ["class"] });
  }

  /* ─── Overlay / modal dismiss ─── */

  function _bindDismiss() {
    var overlay = _getOverlay();
    if (overlay) {
      overlay.addEventListener("click", _closeModal);
    }
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        var modal = _getModal();
        if (modal && modal.classList.contains("open")) {
          _closeModal();
        }
      }
    });
  }

  /* ─── Escape utility ─── */

  function _escapeHtml(text) {
    var el = document.createElement("span");
    el.textContent = text;
    return el.innerHTML;
  }

  /* ─── Init ─── */

  function initVibeCheckUI() {
    _observeDrawer();
    _bindDismiss();
  }

  /* ─── Expose to window ─── */
  window.VibeCheckUI = {
    init: initVibeCheckUI,
    renderVibeCheckBadge: renderVibeCheckBadge,
    renderVibeCheckStrip: renderVibeCheckStrip
  };

  /* Auto-init on DOMContentLoaded */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initVibeCheckUI);
  } else {
    initVibeCheckUI();
  }
})();
