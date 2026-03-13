/**
 * Late Night Vibes Seattle — Vibe Check (crowd-sourced energy meter).
 *
 * Stores and aggregates quick pulse checks submitted by users at venues.
 * Data persists in localStorage under `lnv_vibe_checks`.
 *
 * UMD-style export: works in Node (tests) and in the browser
 * (<script src="lib/vibe-check.js"> → window.LNVVibeCheck).
 */
(function (exports) {
  "use strict";

  var STORAGE_KEY = "lnv_vibe_checks";
  var EXPIRY_MS = 4 * 60 * 60 * 1000; // 4 hours
  var COOLDOWN_MS = 30 * 60 * 1000;   // 30 minutes

  /* ─── Storage helpers ─── */

  function _readAll() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch (_) {
      return [];
    }
  }

  function _writeAll(checks) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(checks));
    } catch (_) { /* quota exceeded — silently fail */ }
  }

  function _pruneExpired(checks) {
    var now = Date.now();
    return checks.filter(function (c) {
      return (now - c.timestamp) < EXPIRY_MS;
    });
  }

  /* ─── Public API ─── */

  /**
   * submitVibeCheck(venueName, data)
   * data: { energy: 1-5, crowdLevel: "empty"|"moderate"|"packed",
   *         musicVolume: "quiet"|"medium"|"loud", vibes: string[] }
   */
  function submitVibeCheck(venueName, data) {
    if (!venueName || !data) return null;
    var check = {
      venue: venueName,
      energy: Math.max(1, Math.min(5, parseInt(data.energy, 10) || 3)),
      crowdLevel: data.crowdLevel || "moderate",
      musicVolume: data.musicVolume || "medium",
      vibes: Array.isArray(data.vibes) ? data.vibes : [],
      timestamp: Date.now()
    };
    var all = _pruneExpired(_readAll());
    all.push(check);
    _writeAll(all);
    return check;
  }

  /**
   * getVibeChecks(venueName) — returns non-expired checks for a venue.
   */
  function getVibeChecks(venueName) {
    var all = _pruneExpired(_readAll());
    return all.filter(function (c) {
      return c.venue === venueName;
    });
  }

  /**
   * getAggregatedVibe(venueName) — returns aggregated stats or null.
   */
  function getAggregatedVibe(venueName) {
    var checks = getVibeChecks(venueName);
    if (!checks.length) return null;

    // Average energy
    var totalEnergy = 0;
    checks.forEach(function (c) { totalEnergy += c.energy; });
    var avgEnergy = Math.round((totalEnergy / checks.length) * 10) / 10;

    // Dominant crowd level
    var crowdCounts = {};
    checks.forEach(function (c) {
      crowdCounts[c.crowdLevel] = (crowdCounts[c.crowdLevel] || 0) + 1;
    });
    var dominantCrowd = _dominant(crowdCounts);

    // Dominant volume
    var volumeCounts = {};
    checks.forEach(function (c) {
      volumeCounts[c.musicVolume] = (volumeCounts[c.musicVolume] || 0) + 1;
    });
    var dominantVolume = _dominant(volumeCounts);

    // Top 3 vibes
    var vibeCounts = {};
    checks.forEach(function (c) {
      (c.vibes || []).forEach(function (v) {
        vibeCounts[v] = (vibeCounts[v] || 0) + 1;
      });
    });
    var topVibes = Object.keys(vibeCounts)
      .sort(function (a, b) { return vibeCounts[b] - vibeCounts[a]; })
      .slice(0, 3);

    // Freshness — based on most recent check
    var latest = 0;
    checks.forEach(function (c) {
      if (c.timestamp > latest) latest = c.timestamp;
    });
    var freshness = _formatFreshness(latest);

    return {
      avgEnergy: avgEnergy,
      dominantCrowd: dominantCrowd,
      dominantVolume: dominantVolume,
      topVibes: topVibes,
      checkCount: checks.length,
      freshness: freshness
    };
  }

  /**
   * hasRecentCheck(venueName) — true if user submitted within last 30 min.
   */
  function hasRecentCheck(venueName) {
    var checks = getVibeChecks(venueName);
    if (!checks.length) return false;
    var now = Date.now();
    return checks.some(function (c) {
      return (now - c.timestamp) < COOLDOWN_MS;
    });
  }

  /* ─── Internal helpers ─── */

  function _dominant(counts) {
    var best = null;
    var bestCount = 0;
    for (var key in counts) {
      if (counts[key] > bestCount) {
        bestCount = counts[key];
        best = key;
      }
    }
    return best;
  }

  function _formatFreshness(timestamp) {
    var diff = Date.now() - timestamp;
    var mins = Math.floor(diff / 60000);
    if (mins < 2) return "just now";
    if (mins < 60) return mins + " min ago";
    var hours = Math.floor(mins / 60);
    return hours + "h ago";
  }

  /* ─── Exports ─── */

  exports.submitVibeCheck = submitVibeCheck;
  exports.getVibeChecks = getVibeChecks;
  exports.getAggregatedVibe = getAggregatedVibe;
  exports.hasRecentCheck = hasRecentCheck;

})(typeof module !== "undefined" ? module.exports : (window.LNVVibeCheck = {}));
