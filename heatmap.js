/**
 * Late Night Vibes — Heatmap page controller.
 * Wires the heatmap UI to the LNVVibeHeatmap lib module.
 */
(function () {
  "use strict";

  var Heatmap = window.LNVVibeHeatmap;
  var Core = window.LNVCore;

  var REFRESH_INTERVAL_MS = 60 * 1000; // 60 seconds
  var refreshTimer = null;

  /* ─── Heat level helpers ─── */

  function heatLevel(score) {
    if (score >= 80) return "hot";
    if (score >= 60) return "warm";
    if (score >= 40) return "medium";
    if (score >= 20) return "cool";
    return "cold";
  }

  function trendArrow(trend) {
    var arrows = {
      "up": "\u2191",
      "rising": "\u2197",
      "steady": "\u2192",
      "cooling": "\u2198",
      "down": "\u2193"
    };
    return arrows[trend] || "\u2192";
  }

  function trendLabel(trend) {
    var labels = {
      "up": "Heating up",
      "rising": "Rising",
      "steady": "Steady",
      "cooling": "Cooling off",
      "down": "Cooling down"
    };
    return labels[trend] || "Steady";
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  /* ─── Render hero section ─── */

  function renderHero(neighborhoods) {
    var heroEl = document.getElementById("heatmapHero");
    if (!heroEl) return;

    var top = neighborhoods.slice(0, 3);
    if (top.length === 0) {
      heroEl.style.display = "none";
      return;
    }

    heroEl.style.display = "";
    var html = '<div class="heatmap-hero-label">Hottest Right Now</div>';
    html += '<div class="heatmap-hero-cards">';

    for (var i = 0; i < top.length; i++) {
      var h = top[i];
      var level = heatLevel(h.score);
      html += '<div class="heatmap-hero-card">';
      html += '<div class="heatmap-hero-name">' + escapeHtml(h.name) + '</div>';
      html += '<div class="heatmap-hero-score heat-color-' + level + '">' + h.score + '</div>';
      html += '<div class="heatmap-hero-details">';
      html += '<span>' + h.venueCount + ' venue' + (h.venueCount !== 1 ? 's' : '') + '</span>';
      html += '<span>' + escapeHtml(h.topVibe) + '</span>';
      html += '<span class="heat-trend heat-trend-' + h.trend + '">' + trendArrow(h.trend) + ' ' + trendLabel(h.trend) + '</span>';
      html += '</div></div>';
    }

    html += '</div>';
    heroEl.innerHTML = html;
  }

  /* ─── Render neighborhood grid ─── */

  function renderGrid(neighborhoods) {
    var gridEl = document.getElementById("heatmapGrid");
    if (!gridEl) return;

    if (neighborhoods.length === 0) {
      gridEl.innerHTML =
        '<div class="heatmap-empty">' +
        '<div class="heatmap-empty-icon">&#x1F30C;</div>' +
        '<div class="heatmap-empty-title">No activity yet</div>' +
        '<p>Check back later when people start checking in, reporting music, and sharing vibes. The heatmap updates in real time.</p>' +
        '</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < neighborhoods.length; i++) {
      var h = neighborhoods[i];
      var level = heatLevel(h.score);

      html += '<div class="heat-card">';

      // Top row: name + score
      html += '<div class="heat-card-top">';
      html += '<div class="heat-card-info">';
      html += '<div class="heat-card-name">' + escapeHtml(h.name) + '</div>';
      html += '<div class="heat-card-vibe">' + escapeHtml(h.topVibe) + '</div>';
      html += '</div>';
      html += '<div class="heat-card-score">';
      html += '<div class="heat-score-value heat-color-' + level + '">' + h.score + '</div>';
      html += '<div class="heat-score-label">heat</div>';
      html += '</div>';
      html += '</div>';

      // Heat bar
      html += '<div class="heat-bar-container">';
      html += '<div class="heat-bar">';
      html += '<div class="heat-bar-fill heat-bar-' + level + '" style="width:' + h.score + '%"></div>';
      html += '</div></div>';

      // Details row
      html += '<div class="heat-card-details">';
      html += '<div class="heat-card-detail">' + h.venueCount + ' venue' + (h.venueCount !== 1 ? 's' : '') + '</div>';
      html += '<div class="heat-card-detail heat-trend heat-trend-' + h.trend + '">' + trendArrow(h.trend) + ' ' + trendLabel(h.trend) + '</div>';
      html += '</div>';

      html += '</div>';
    }

    gridEl.innerHTML = html;
  }

  /* ─── Refresh logic ─── */

  function refresh() {
    if (!Heatmap) return;
    Heatmap.refreshHeatData();
    var data = Heatmap.getNeighborhoodHeat();
    renderHero(data);
    renderGrid(data);

    // Update status timestamp
    var statusEl = document.getElementById("heatmapStatus");
    if (statusEl) {
      var now = new Date();
      var h = now.getHours();
      var m = now.getMinutes();
      var ampm = h >= 12 ? "PM" : "AM";
      if (h === 0) h = 12;
      else if (h > 12) h -= 12;
      statusEl.textContent = "Updated " + h + ":" + (m < 10 ? "0" : "") + m + " " + ampm;
    }
  }

  /* ─── Init ─── */

  function init() {
    refresh();
    refreshTimer = setInterval(refresh, REFRESH_INTERVAL_MS);
  }

  // Clean up on page unload
  window.addEventListener("beforeunload", function () {
    if (refreshTimer) clearInterval(refreshTimer);
  });

  // Wait for data to be available
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
