/**
 * Shared high-impact feature logic for Late Night Vibes Seattle.
 * Used by app.js, recommend.js, planner.js, and index.html.
 *
 * Depends on lib/core.js (window.LNVCore in the browser, require in Node).
 */
(function (exports) {
  /* ─── Import helpers from core ─── */
  /* eslint-disable-next-line no-undef */
  var core = (typeof require !== "undefined") ? require("./core") : (typeof window !== "undefined" && window.LNVCore ? window.LNVCore : {});
  var normalizeValue = core.normalizeValue || function (v) { return (v || "").toString().trim(); };
  var parseTimeToMinutes = core.parseTimeToMinutes || function () { return null; };
  var getVibeSet = core.getVibeSet || function () { return new Set(); };
  var parseDistanceMiles = core.parseDistanceMiles || function () { return null; };

  /* ─── 1. Live viability badges ─── */
  function getViabilityBadges(venue) {
    var badges = [];
    var cat = normalizeValue(venue.Category).toLowerCase();
    var tags = getVibeSet(venue);
    var closingMin = parseTimeToMinutes(venue["Typical Closing Time"]);
    var now = new Date();
    var nowMin = now.getHours() * 60 + now.getMinutes();
    var nowAdj = nowMin < 540 ? nowMin + 1440 : nowMin;

    if (cat.includes("nightclub") || cat.includes("club")) {
      badges.push({ label: "Cover likely", class: "viability-cover" });
    }
    if (tags.has("late-eats") || tags.has("food-focused")) {
      var kitchenOpen = false;
      if (closingMin !== null) {
        var closeAdj = closingMin <= 360 ? closingMin + 1440 : closingMin;
        kitchenOpen = nowAdj >= 21 * 60 && nowAdj < closeAdj - 30;
      }
      if (kitchenOpen) badges.push({ label: "Kitchen open", class: "viability-kitchen" });
    }
    if (cat.includes("nightclub") || (tags.has("dancey") && tags.has("high-energy"))) {
      if (nowAdj >= 22 * 60 && nowAdj <= 2 * 60 + 1440) {
        badges.push({ label: "Likely busy", class: "viability-busy" });
      }
    }
    if (cat.includes("nightclub") && nowAdj >= 23 * 60) {
      badges.push({ label: "Line risk", class: "viability-line" });
    }
    return badges;
  }

  /* ─── 7. Trust signals ─── */
  var DATASET_VERIFIED = "Feb 2026";

  function getTrustBadge() {
    return { label: "Verified " + DATASET_VERIFIED, class: "trust-verified" };
  }

  /* ─── 5. Route realism: travel estimate ─── */
  function estimateTravelMinutes(venueA, venueB) {
    var areaA = normalizeValue(venueA.Area);
    var areaB = normalizeValue(venueB.Area);
    if (areaA === areaB) return 5;
    return 15;
  }

  function estimateTravelFromDistance(distA, distB) {
    if (distA == null || distB == null) return 12;
    var delta = Math.abs(distA - distB);
    return Math.ceil(5 + delta * 4);
  }

  exports.getViabilityBadges = getViabilityBadges;
  exports.getTrustBadge = getTrustBadge;
  exports.estimateTravelMinutes = estimateTravelMinutes;
  exports.estimateTravelFromDistance = estimateTravelFromDistance;
  exports.DATASET_VERIFIED = DATASET_VERIFIED;

  /* Re-export core helpers so existing code that reads them from LNVFeatures still works */
  exports.normalizeValue = normalizeValue;
  exports.parseTimeToMinutes = parseTimeToMinutes;
  exports.getVibeSet = getVibeSet;
  exports.parseDistanceMiles = parseDistanceMiles;

})(typeof module !== "undefined" ? module.exports : (window.LNVFeatures = window.LNVFeatures || {}));
