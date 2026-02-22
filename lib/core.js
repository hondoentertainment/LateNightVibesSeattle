/**
 * Late Night Vibes Seattle — Core pure logic functions.
 *
 * These functions are shared across multiple pages (app.js, recommend.js,
 * planner.js). Extracting them here makes them testable via Vitest and avoids
 * duplication over time.
 *
 * UMD-style export: works in Node (tests) and in the browser
 * (<script src="lib/core.js"> → window.LNVCore).
 */
(function (exports) {
  /* ─── String helpers ─── */

  function normalizeValue(value) {
    return (value || "").toString().trim();
  }

  /* ─── CSV parsing ─── */

  function parseCSV(text) {
    const rows = [];
    let current = "";
    let inQuotes = false;
    const cells = [];
    function pushCell() { cells.push(current); current = ""; }
    function pushRow() { rows.push(cells.splice(0)); }
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === "\"") {
        const next = text[i + 1];
        if (inQuotes && next === "\"") { current += "\""; i++; }
        else inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        pushCell();
      } else if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && text[i + 1] === "\n") i++;
        pushCell(); pushRow();
      } else {
        current += char;
      }
    }
    if (current.length > 0 || cells.length > 0) { pushCell(); pushRow(); }
    return rows;
  }

  function loadDataFromCSV(text) {
    const rows = parseCSV(text);
    if (!rows.length) return [];
    const headers = rows[0].map((h) => normalizeValue(h));
    return rows.slice(1)
      .filter((row) => row.some((c) => c && c.trim()))
      .map((row) => {
        const r = {};
        headers.forEach((h, i) => { r[h] = normalizeValue(row[i]); });
        return r;
      });
  }

  /* ─── Time helpers ─── */

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

  function parseHHMM(val) {
    const [h, m] = val.split(":").map(Number);
    return h * 60 + m;
  }

  function minutesToLabel(mins) {
    if (mins >= 1440) mins -= 1440;
    if (mins < 0) mins += 1440;
    let h = Math.floor(mins / 60);
    const m = mins % 60;
    const meridiem = h >= 12 ? "PM" : "AM";
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return `${h}:${m.toString().padStart(2, "0")} ${meridiem}`;
  }

  /* ─── Distance helpers ─── */

  function parseDistanceMiles(value) {
    const m = normalizeValue(value).toLowerCase().match(/([\d.]+)\s*mi/);
    return m ? parseFloat(m[1]) : null;
  }

  /**
   * Haversine formula: distance in miles between two lat/lng points.
   */
  function haversineMiles(lat1, lng1, lat2, lng2) {
    const R = 3959; // Earth radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Walkable threshold: under 0.5 miles (~10 min walk).
   */
  const WALKABLE_MILES = 0.5;

  /* ─── Vibe helpers ─── */

  function getVibeSet(venue) {
    return new Set(
      normalizeValue(venue["Vibe Tags"]).split(",")
        .map((t) => normalizeValue(t).toLowerCase()).filter(Boolean)
    );
  }

  function collectVibes(venues) {
    const vibeSet = new Set();
    venues.forEach((venue) => {
      normalizeValue(venue["Vibe Tags"]).split(",")
        .map((t) => normalizeValue(t)).filter(Boolean)
        .forEach((t) => vibeSet.add(t));
    });
    return vibeSet;
  }

  /* ─── Recommendation engine (pure logic) ─── */

  function computeRecommendations(allVenues, base, maxDist, maxResults) {
    const baseDist = parseDistanceMiles(base["Driving Distance"]);
    const baseVibes = getVibeSet(base);

    return allVenues
      .filter((v) => v.Name && v.Name !== base.Name)
      .map((venue) => {
        const dist = parseDistanceMiles(venue["Driving Distance"]);
        if (maxDist !== null && dist !== null && dist > maxDist) return null;

        const candidateVibes = getVibeSet(venue);
        const intersection = Array.from(candidateVibes).filter((t) => baseVibes.has(t));
        const union = new Set([...candidateVibes, ...baseVibes]);
        const vibeScore = union.size ? intersection.length / union.size : 0;
        const catScore = normalizeValue(venue.Category).toLowerCase() === normalizeValue(base.Category).toLowerCase() ? 1 : 0;
        const areaScore = normalizeValue(venue.Area).toLowerCase() === normalizeValue(base.Area).toLowerCase() ? 1 : 0;
        let distScore = 0.4;
        if (dist !== null && baseDist !== null && maxDist) {
          distScore = 1 - Math.min(Math.abs(dist - baseDist) / maxDist, 1);
        }
        const score = vibeScore * 0.5 + catScore * 0.2 + areaScore * 0.2 + distScore * 0.1;
        const sharedVibes = intersection.length ? intersection.join(", ") : "new vibe twist";
        const reason = [
          intersection.length ? `${intersection.length} shared vibe${intersection.length > 1 ? "s" : ""}: ${sharedVibes}` : "Different vibe mix",
          catScore ? "Same category" : "Different category",
          areaScore ? "Same neighborhood" : normalizeValue(venue.Area),
        ].join(" · ");
        const breakdown = {
          vibe: Math.round(vibeScore * 100),
          category: Math.round(catScore * 100),
          area: Math.round(areaScore * 100),
          distance: Math.round(distScore * 100),
          total: Math.round(score * 100),
        };
        return { venue, score, reason, breakdown };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  }

  /* ─── Toast UI (shared across app, recommend, planner) ─── */

  function showToast(msg, type) {
    if (typeof document === "undefined") return;
    const className = type === "error" ? "error-toast" : "share-toast";
    const existing = document.querySelector("." + className);
    if (existing) existing.remove();
    const toast = document.createElement("div");
    toast.className = className;
    toast.textContent = msg;
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), type === "error" ? 3500 : 2000);
  }

  function showErrorToast(msg) {
    showToast(msg, "error");
  }

  /* ─── DOM helpers (shared across app, recommend, planner) ─── */

  function syncSelect(source, target) {
    if (target) target.value = source.value;
  }

  function addListener(el, event, fn) {
    if (el) el.addEventListener(event, fn);
  }

  /* ─── Mobile: scroll focused input into view when keyboard opens ─── */
  function initMobileInputScroll() {
    if (typeof document === "undefined" || typeof window === "undefined") return;
    document.addEventListener("focusin", function (e) {
      const el = e.target;
      if (!el || !el.closest) return;
      const tag = (el.tagName || "").toLowerCase();
      if (tag !== "input" && tag !== "select" && tag !== "textarea") return;
      if (window.innerWidth >= 860) return; // Desktop: no need
      setTimeout(function () {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    });
  }

  if (typeof document !== "undefined" && document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMobileInputScroll);
  } else if (typeof document !== "undefined") {
    initMobileInputScroll();
  }

  /* ─── Offline/online toast feedback ─── */
  function initNetworkStatusToasts() {
    if (typeof window === "undefined") return;
    window.addEventListener("offline", function () {
      showToast("You're offline. Some features may not work.", "error");
    });
    window.addEventListener("online", function () {
      showToast("Back online!");
    });
  }

  if (typeof window !== "undefined") {
    initNetworkStatusToasts();
  }

  /* ─── Exports ─── */

  exports.normalizeValue = normalizeValue;
  exports.parseCSV = parseCSV;
  exports.loadDataFromCSV = loadDataFromCSV;
  exports.parseTimeToMinutes = parseTimeToMinutes;
  exports.parseHHMM = parseHHMM;
  exports.minutesToLabel = minutesToLabel;
  exports.parseDistanceMiles = parseDistanceMiles;
  exports.haversineMiles = haversineMiles;
  exports.WALKABLE_MILES = WALKABLE_MILES;
  exports.getVibeSet = getVibeSet;
  exports.collectVibes = collectVibes;
  exports.computeRecommendations = computeRecommendations;
  exports.showToast = showToast;
  exports.showErrorToast = showErrorToast;
  exports.syncSelect = syncSelect;
  exports.addListener = addListener;

})(typeof module !== "undefined" ? module.exports : (window.LNVCore = {}));
