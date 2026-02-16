/**
 * User preferences and session state for Late Night Vibes.
 * localStorage keys: lnv_onboarding_prefs, lnv_excluded_vibes, lnv_plan_seed, lnv_anchor_area
 */
(function (exports) {
  var PREFS_KEY = "lnv_onboarding_prefs";
  var EXCLUDED_VIBES_KEY = "lnv_excluded_vibes";
  var PLAN_SEED_KEY = "lnv_plan_seed";
  var ANCHOR_AREA_KEY = "lnv_anchor_area";

  function loadOnboardingPrefs() {
    try {
      var raw = localStorage.getItem(PREFS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function saveOnboardingPrefs(prefs) {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
      return true;
    } catch (_) {
      return false;
    }
  }

  function loadExcludedVibes() {
    try {
      var raw = localStorage.getItem(EXCLUDED_VIBES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  function saveExcludedVibes(vibes) {
    try {
      localStorage.setItem(EXCLUDED_VIBES_KEY, JSON.stringify(vibes));
      return true;
    } catch (_) {
      return false;
    }
  }

  function excludeVibe(vibe) {
    var vibes = loadExcludedVibes();
    var v = (vibe || "").toString().toLowerCase().trim();
    if (!v || vibes.includes(v)) return vibes;
    vibes.push(v);
    saveExcludedVibes(vibes);
    return vibes;
  }

  function unexcludeVibe(vibe) {
    var vibes = loadExcludedVibes().filter(function (x) { return x !== ((vibe || "").toString().toLowerCase().trim()); });
    saveExcludedVibes(vibes);
    return vibes;
  }

  function isVibeExcluded(vibe) {
    return loadExcludedVibes().includes((vibe || "").toString().toLowerCase().trim());
  }

  function loadPlanSeed() {
    try {
      var raw = localStorage.getItem(PLAN_SEED_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function savePlanSeed(venue) {
    try {
      if (!venue) {
        localStorage.removeItem(PLAN_SEED_KEY);
        return true;
      }
      var seed = {
        n: (venue.Name || "").toString().trim(),
        a: (venue.Area || "").toString().trim(),
        c: (venue.Category || "").toString().trim(),
        t: (venue["Typical Closing Time"] || "").toString().trim(),
        l: (venue["Google Maps Driving Link"] || "").toString().trim(),
        v: (venue["Vibe Tags"] || "").toString().trim(),
        d: (venue["Driving Distance"] || "").toString().trim(),
      };
      localStorage.setItem(PLAN_SEED_KEY, JSON.stringify(seed));
      return true;
    } catch (_) {
      return false;
    }
  }

  function clearPlanSeed() {
    try {
      localStorage.removeItem(PLAN_SEED_KEY);
      return true;
    } catch (_) {
      return false;
    }
  }

  function loadAnchorArea() {
    try {
      return localStorage.getItem(ANCHOR_AREA_KEY) || null;
    } catch (_) {
      return null;
    }
  }

  function saveAnchorArea(area) {
    try {
      if (area) {
        localStorage.setItem(ANCHOR_AREA_KEY, area);
      } else {
        localStorage.removeItem(ANCHOR_AREA_KEY);
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  exports.loadOnboardingPrefs = loadOnboardingPrefs;
  exports.saveOnboardingPrefs = saveOnboardingPrefs;
  exports.loadExcludedVibes = loadExcludedVibes;
  exports.saveExcludedVibes = saveExcludedVibes;
  exports.excludeVibe = excludeVibe;
  exports.unexcludeVibe = unexcludeVibe;
  exports.isVibeExcluded = isVibeExcluded;
  exports.loadPlanSeed = loadPlanSeed;
  exports.savePlanSeed = savePlanSeed;
  exports.clearPlanSeed = clearPlanSeed;
  exports.loadAnchorArea = loadAnchorArea;
  exports.saveAnchorArea = saveAnchorArea;
})(typeof module !== "undefined" ? module.exports : (window.LNVUserPrefs = window.LNVUserPrefs || {}));
