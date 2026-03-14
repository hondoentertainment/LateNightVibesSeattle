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
      var kitchenCutoff = null;
      if (closingMin !== null) {
        var closeAdj = closingMin <= 360 ? closingMin + 1440 : closingMin;
        kitchenOpen = nowAdj >= 21 * 60 && nowAdj < closeAdj - 30;
        if (nowAdj >= 21 * 60 && nowAdj < closeAdj && nowAdj >= closeAdj - 45) {
          kitchenCutoff = Math.max(0, closeAdj - 30 - nowAdj);
        }
      }
      if (kitchenOpen) badges.push({ label: "Kitchen open", class: "viability-kitchen" });
      if (kitchenCutoff !== null && kitchenCutoff <= 30 && kitchenCutoff > 0) {
        badges.push({ label: "Kitchen closes in ~" + kitchenCutoff + " min", class: "viability-kitchen-cutoff" });
      }
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

  /* ─── Time-of-night intelligence ─── */
  function isLateArrivalHour() {
    var now = new Date();
    var h = now.getHours();
    var m = now.getMinutes();
    var nowMin = h * 60 + m;
    if (nowMin < 540) nowMin += 1440;
    return nowMin >= 22 * 60;
  }

  /* ─── City peak-time data ─── */
  var CITY_PEAK_DATA = {
    "seattle": {
      "capitol hill": "Peak 10:30 PM–12:30 AM",
      "belltown": "Peak 10:30 PM–12:30 AM",
      "downtown": "Peak 10 PM–1 AM",
      "fremont": "Peak 10 PM–12 AM",
    },
    "new-york": {
      "east village": "Peak 11 PM–2 AM",
      "west village": "Peak 11 PM–2 AM",
      "williamsburg": "Peak 11 PM–2 AM",
      "lower east side": "Peak 11 PM–2 AM",
      "manhattan": "Peak 11 PM–2 AM",
      "brooklyn": "Peak 11 PM–2 AM",
      "bushwick": "Peak 11:30 PM–2:30 AM",
      "harlem": "Peak 11 PM–1:30 AM",
    },
    "los-angeles": {
      "hollywood": "Peak 10:30 PM–1:30 AM",
      "west hollywood": "Peak 10:30 PM–1:30 AM",
      "silver lake": "Peak 10:30 PM–1:30 AM",
      "downtown la": "Peak 10:30 PM–1:30 AM",
      "echo park": "Peak 10 PM–1 AM",
      "koreatown": "Peak 11 PM–2 AM",
      "venice": "Peak 10 PM–12:30 AM",
      "santa monica": "Peak 10 PM–12:30 AM",
    },
    "chicago": {
      "wicker park": "Peak 10 PM–1 AM",
      "logan square": "Peak 10 PM–1 AM",
      "lincoln park": "Peak 10 PM–1 AM",
      "lakeview": "Peak 10 PM–1 AM",
      "river north": "Peak 10:30 PM–1:30 AM",
      "wrigleyville": "Peak 10 PM–12:30 AM",
      "pilsen": "Peak 10 PM–12:30 AM",
    },
    "san-francisco": {
      "mission": "Peak 10 PM–1 AM",
      "north beach": "Peak 10 PM–1 AM",
      "soma": "Peak 10:30 PM–1:30 AM",
      "castro": "Peak 10 PM–12:30 AM",
      "marina": "Peak 10 PM–12:30 AM",
      "lower haight": "Peak 10 PM–1 AM",
    },
    "austin": {
      "sixth street": "Peak 10:30 PM–1:30 AM",
      "rainey street": "Peak 10 PM–1 AM",
      "east austin": "Peak 10 PM–12:30 AM",
      "red river cultural district": "Peak 11 PM–2 AM",
      "south congress": "Peak 10 PM–12 AM",
    },
    "nashville": {
      "broadway": "Peak 10 PM–1:30 AM",
      "east nashville": "Peak 10 PM–12:30 AM",
      "midtown": "Peak 10 PM–1 AM",
      "the gulch": "Peak 10 PM–12:30 AM",
    },
    "denver": {
      "lodo": "Peak 10 PM–1 AM",
      "capitol hill": "Peak 10 PM–1 AM",
      "rino": "Peak 10 PM–12:30 AM",
      "south broadway": "Peak 10 PM–12:30 AM",
      "colfax": "Peak 10 PM–1 AM",
    },
    "portland": {
      "alberta arts district": "Peak 10 PM–12:30 AM",
      "hawthorne": "Peak 10 PM–12:30 AM",
      "pearl district": "Peak 10 PM–12:30 AM",
      "downtown": "Peak 10 PM–1 AM",
      "division": "Peak 10 PM–12 AM",
    },
    "las-vegas": {
      "the strip": "Peak 11 PM–3 AM",
      "fremont east": "Peak 10:30 PM–2 AM",
      "downtown": "Peak 10:30 PM–2 AM",
      "arts district": "Peak 10 PM–1 AM",
    },
  };

  function getPeakHintForArea(areaName, citySlug) {
    var cities = (typeof require !== "undefined") ? require("./cities") : (typeof window !== "undefined" && window.LNVCities ? window.LNVCities : null);
    var slug = citySlug || (cities && cities.getCurrentCitySlug ? cities.getCurrentCitySlug() : "seattle");
    var peakMap = CITY_PEAK_DATA[slug] || null;
    if (!peakMap) return null;
    var area = normalizeValue(areaName).toLowerCase();
    for (var key in peakMap) {
      if (area.includes(key)) return peakMap[key];
    }
    return null;
  }

  /* ─── Best-for verdict (neighborhood comparison) ─── */
  function getBestForVerdict(topVibes, topCategories) {
    var verdicts = [];
    var vibeSet = new Set((topVibes || []).map(function (v) { return v[0].toLowerCase(); }));
    var catSet = new Set((topCategories || []).map(function (c) { return c[0].toLowerCase(); }));
    if (vibeSet.has("late-eats") || vibeSet.has("food-focused") || catSet.has("restaurant") || catSet.has("diner")) {
      verdicts.push("late eats");
    }
    if (vibeSet.has("divey") || vibeSet.has("casual")) verdicts.push("dive bars");
    if (vibeSet.has("upscale") || vibeSet.has("date-friendly")) verdicts.push("date night");
    if (vibeSet.has("dancey") || vibeSet.has("high-energy")) verdicts.push("dancing");
    if (vibeSet.has("live-music")) verdicts.push("live music");
    if (vibeSet.has("sports")) verdicts.push("sports viewing");
    if (vibeSet.has("chill") && vibeSet.size <= 3) verdicts.push("low-key");
    return verdicts.length ? verdicts.slice(0, 4).join(", ") : "varied vibes";
  }

  exports.getViabilityBadges = getViabilityBadges;
  exports.getTrustBadge = getTrustBadge;
  exports.estimateTravelMinutes = estimateTravelMinutes;
  exports.estimateTravelFromDistance = estimateTravelFromDistance;
  exports.isLateArrivalHour = isLateArrivalHour;
  exports.getPeakHintForArea = getPeakHintForArea;
  exports.getBestForVerdict = getBestForVerdict;
  exports.DATASET_VERIFIED = DATASET_VERIFIED;

  /* Re-export core helpers so existing code that reads them from LNVFeatures still works */
  exports.normalizeValue = normalizeValue;
  exports.parseTimeToMinutes = parseTimeToMinutes;
  exports.getVibeSet = getVibeSet;
  exports.parseDistanceMiles = parseDistanceMiles;

})(typeof module !== "undefined" ? module.exports : (window.LNVFeatures = window.LNVFeatures || {}));
