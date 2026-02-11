/**
 * Shared high-impact feature logic for Late Night Vibes Seattle.
 * Used by app.js, recommend.js, planner.js, and index.html.
 */
(function (exports) {
  function normalizeValue(value) {
    return (value || "").toString().trim();
  }

  function parseTimeToMinutes(value) {
    const text = normalizeValue(value).toLowerCase();
    const match = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
    if (!match) return null;
    let hour = parseInt(match[1], 10);
    const minute = match[2] ? parseInt(match[2], 10) : 0;
    const meridiem = match[3];
    if (meridiem === "pm" && hour !== 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
    return hour * 60 + minute;
  }

  function getVibeSet(venue) {
    return new Set(
      normalizeValue(venue["Vibe Tags"]).split(",")
        .map((t) => normalizeValue(t).toLowerCase()).filter(Boolean)
    );
  }

  /* ─── 1. Live viability badges ─── */
  function getViabilityBadges(venue) {
    const badges = [];
    const cat = normalizeValue(venue.Category).toLowerCase();
    const tags = getVibeSet(venue);
    const closingMin = parseTimeToMinutes(venue["Typical Closing Time"]);
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const nowAdj = nowMin < 540 ? nowMin + 1440 : nowMin;

    if (cat.includes("nightclub") || cat.includes("club")) {
      badges.push({ label: "Cover likely", class: "viability-cover" });
    }
    if (tags.has("late-eats") || tags.has("food-focused")) {
      let kitchenOpen = false;
      if (closingMin !== null) {
        const closeAdj = closingMin <= 360 ? closingMin + 1440 : closingMin;
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
  const DATASET_VERIFIED = "Feb 2026";

  function getTrustBadge() {
    return { label: "Verified " + DATASET_VERIFIED, class: "trust-verified" };
  }

  /* ─── 5. Route realism: travel estimate ─── */
  function estimateTravelMinutes(venueA, venueB) {
    const areaA = normalizeValue(venueA.Area);
    const areaB = normalizeValue(venueB.Area);
    if (areaA === areaB) return 5;
    return 15;
  }

  function parseDistanceMiles(value) {
    const m = normalizeValue(value).toLowerCase().match(/([\d.]+)\s*mi/);
    return m ? parseFloat(m[1]) : null;
  }

  function estimateTravelFromDistance(distA, distB) {
    if (distA == null || distB == null) return 12;
    const delta = Math.abs(distA - distB);
    return Math.ceil(5 + delta * 4);
  }

  exports.getViabilityBadges = getViabilityBadges;
  exports.getTrustBadge = getTrustBadge;
  exports.estimateTravelMinutes = estimateTravelMinutes;
  exports.estimateTravelFromDistance = estimateTravelFromDistance;
  exports.normalizeValue = normalizeValue;
  exports.parseTimeToMinutes = parseTimeToMinutes;
  exports.getVibeSet = getVibeSet;
  exports.DATASET_VERIFIED = DATASET_VERIFIED;

})(typeof module !== "undefined" ? module.exports : (window.LNVFeatures = window.LNVFeatures || {}));
