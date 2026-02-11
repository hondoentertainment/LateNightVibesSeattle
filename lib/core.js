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

  /* ─── Exports ─── */

  exports.normalizeValue = normalizeValue;
  exports.parseCSV = parseCSV;
  exports.loadDataFromCSV = loadDataFromCSV;
  exports.parseTimeToMinutes = parseTimeToMinutes;
  exports.parseHHMM = parseHHMM;
  exports.minutesToLabel = minutesToLabel;
  exports.parseDistanceMiles = parseDistanceMiles;
  exports.getVibeSet = getVibeSet;
  exports.collectVibes = collectVibes;
  exports.computeRecommendations = computeRecommendations;

})(typeof module !== "undefined" ? module.exports : (window.LNVCore = {}));
