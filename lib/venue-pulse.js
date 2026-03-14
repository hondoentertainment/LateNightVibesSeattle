/**
 * Late Night Vibes — Venue Pulse (real-time crowdsourced venue status).
 *
 * Lets users submit live pulse reports (wait time, crowd level, cover charge,
 * line length, mood) and aggregates them into a real-time venue snapshot.
 * Data persists in localStorage under `lnv_venue_pulse`.
 *
 * UMD-style export: works in Node (tests) and in the browser
 * (<script src="lib/venue-pulse.js"> → window.LNVVenuePulse).
 */
(function (exports) {
  "use strict";

  var STORAGE_KEY = "lnv_venue_pulse";
  var PREFS_KEY = "lnv_venue_pulse_prefs";
  var EXPIRY_MS = 2 * 60 * 60 * 1000;   // 2 hours
  var COOLDOWN_MS = 15 * 60 * 1000;      // 15 minutes
  var TRENDING_THRESHOLD = 3;

  var VALID_CROWD_LEVELS = ["empty", "sparse", "moderate", "busy", "packed"];
  var VALID_LINE_LENGTHS = ["none", "short", "long", "around-block"];

  /* ─── City-scoped key helpers ─── */

  function _cities() {
    if (typeof module !== "undefined") return require("./cities");
    return (typeof window !== "undefined" && window.LNVCities) || null;
  }

  function _scopedKey(baseKey) {
    var c = _cities();
    var key = baseKey || STORAGE_KEY;
    return c && c.getCityKey ? c.getCityKey(key) : key;
  }

  function _migrate(baseKey) {
    var c = _cities();
    var key = baseKey || STORAGE_KEY;
    if (c && c.migrateKeyIfNeeded) c.migrateKeyIfNeeded(key);
  }

  /* ─── Storage helpers ─── */

  function _readAll() {
    try {
      _migrate();
      return JSON.parse(localStorage.getItem(_scopedKey()) || "[]");
    } catch (_) {
      return [];
    }
  }

  function _writeAll(reports) {
    try {
      localStorage.setItem(_scopedKey(), JSON.stringify(reports));
    } catch (_) { /* quota exceeded — silently fail */ }
  }

  function _pruneExpired(reports) {
    var now = Date.now();
    return reports.filter(function (r) {
      return (now - r.timestamp) < EXPIRY_MS;
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

  function _clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function _indexOf(arr, val) {
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] === val) return i;
    }
    return -1;
  }

  /* ─── Public API ─── */

  /**
   * submitPulseReport(venueName, data)
   * data: { waitTime: 0-60, crowdLevel: string, coverCharge: number|null,
   *         lineLength: string, mood: string[] }
   * Returns the created report object, or null on invalid input.
   */
  function submitPulseReport(venueName, data) {
    if (!venueName || !data) return null;

    var waitTime = parseInt(data.waitTime, 10);
    if (isNaN(waitTime)) waitTime = 0;
    waitTime = _clamp(waitTime, 0, 60);

    var crowdLevel = data.crowdLevel || "moderate";
    if (_indexOf(VALID_CROWD_LEVELS, crowdLevel) === -1) {
      crowdLevel = "moderate";
    }

    var coverCharge = null;
    if (data.coverCharge !== null && data.coverCharge !== undefined) {
      var parsed = parseFloat(data.coverCharge);
      if (!isNaN(parsed) && parsed >= 0) {
        coverCharge = parsed;
      }
    }

    var lineLength = data.lineLength || "none";
    if (_indexOf(VALID_LINE_LENGTHS, lineLength) === -1) {
      lineLength = "none";
    }

    var mood = Array.isArray(data.mood) ? data.mood : [];

    var report = {
      venue: venueName,
      waitTime: waitTime,
      crowdLevel: crowdLevel,
      coverCharge: coverCharge,
      lineLength: lineLength,
      mood: mood,
      timestamp: Date.now()
    };

    var all = _pruneExpired(_readAll());
    all.push(report);
    _writeAll(all);
    return report;
  }

  /**
   * getVenuePulse(venueName) — returns aggregated pulse data or null.
   */
  function getVenuePulse(venueName) {
    var all = _pruneExpired(_readAll());
    var reports = all.filter(function (r) {
      return r.venue === venueName;
    });
    if (!reports.length) return null;

    // Average wait time
    var totalWait = 0;
    reports.forEach(function (r) { totalWait += r.waitTime; });
    var avgWaitTime = Math.round((totalWait / reports.length) * 10) / 10;

    // Dominant crowd level
    var crowdCounts = {};
    reports.forEach(function (r) {
      crowdCounts[r.crowdLevel] = (crowdCounts[r.crowdLevel] || 0) + 1;
    });
    var dominantCrowdLevel = _dominant(crowdCounts);

    // Average cover charge (only non-null values)
    var coverTotal = 0;
    var coverCount = 0;
    reports.forEach(function (r) {
      if (r.coverCharge !== null && r.coverCharge !== undefined) {
        coverTotal += r.coverCharge;
        coverCount++;
      }
    });
    var avgCoverCharge = coverCount > 0
      ? Math.round((coverTotal / coverCount) * 100) / 100
      : null;

    // Dominant line length
    var lineCounts = {};
    reports.forEach(function (r) {
      lineCounts[r.lineLength] = (lineCounts[r.lineLength] || 0) + 1;
    });
    var dominantLineLength = _dominant(lineCounts);

    // Top 3 moods
    var moodCounts = {};
    reports.forEach(function (r) {
      (r.mood || []).forEach(function (m) {
        moodCounts[m] = (moodCounts[m] || 0) + 1;
      });
    });
    var topMoods = Object.keys(moodCounts)
      .sort(function (a, b) { return moodCounts[b] - moodCounts[a]; })
      .slice(0, 3);

    // Freshness — based on most recent report
    var latest = 0;
    reports.forEach(function (r) {
      if (r.timestamp > latest) latest = r.timestamp;
    });
    var freshness = _formatFreshness(latest);

    return {
      avgWaitTime: avgWaitTime,
      dominantCrowdLevel: dominantCrowdLevel,
      avgCoverCharge: avgCoverCharge,
      dominantLineLength: dominantLineLength,
      topMoods: topMoods,
      reportCount: reports.length,
      freshness: freshness
    };
  }

  /**
   * canSubmitReport(venueName) — false if user submitted within last 15 min
   * for the same venue.
   */
  function canSubmitReport(venueName) {
    var all = _pruneExpired(_readAll());
    var venueReports = all.filter(function (r) {
      return r.venue === venueName;
    });
    if (!venueReports.length) return true;
    var now = Date.now();
    var recent = venueReports.some(function (r) {
      return (now - r.timestamp) < COOLDOWN_MS;
    });
    return !recent;
  }

  /**
   * getTrendingVenues(allVenueNames) — returns venues with 3+ recent reports,
   * sorted by report count descending, each with a "trending" flag.
   */
  function getTrendingVenues(allVenueNames) {
    if (!Array.isArray(allVenueNames)) return [];
    var all = _pruneExpired(_readAll());

    var venueCounts = {};
    all.forEach(function (r) {
      venueCounts[r.venue] = (venueCounts[r.venue] || 0) + 1;
    });

    var trending = [];
    allVenueNames.forEach(function (name) {
      var count = venueCounts[name] || 0;
      if (count >= TRENDING_THRESHOLD) {
        trending.push({
          venue: name,
          reportCount: count,
          trending: true
        });
      }
    });

    trending.sort(function (a, b) {
      return b.reportCount - a.reportCount;
    });

    return trending;
  }

  /**
   * saveNotificationPrefs(prefs) — save notification preferences to localStorage.
   * prefs: { favoriteVenues: string[], alerts: boolean }
   */
  function saveNotificationPrefs(prefs) {
    if (!prefs) return;
    var data = {
      favoriteVenues: Array.isArray(prefs.favoriteVenues) ? prefs.favoriteVenues : [],
      alerts: prefs.alerts === true
    };
    try {
      localStorage.setItem(_scopedKey(PREFS_KEY), JSON.stringify(data));
    } catch (_) { /* quota exceeded */ }
  }

  /**
   * getNotificationPrefs() — load notification preferences from localStorage.
   */
  function getNotificationPrefs() {
    try {
      _migrate(PREFS_KEY);
      var raw = localStorage.getItem(_scopedKey(PREFS_KEY));
      if (!raw) return { favoriteVenues: [], alerts: false };
      return JSON.parse(raw);
    } catch (_) {
      return { favoriteVenues: [], alerts: false };
    }
  }

  /**
   * getCapacityAlert(venueName) — returns null or { level, message } based on
   * aggregated crowd level.
   */
  function getCapacityAlert(venueName) {
    var pulse = getVenuePulse(venueName);
    if (!pulse) return null;

    if (pulse.dominantCrowdLevel === "packed") {
      return {
        level: "full",
        message: venueName + " is at full capacity — expect long waits"
      };
    }
    if (pulse.dominantCrowdLevel === "busy") {
      return {
        level: "warning",
        message: venueName + " is getting busy — consider arriving soon"
      };
    }
    return null;
  }

  /* ─── Exports ─── */

  exports.submitPulseReport = submitPulseReport;
  exports.getVenuePulse = getVenuePulse;
  exports.canSubmitReport = canSubmitReport;
  exports.getTrendingVenues = getTrendingVenues;
  exports.saveNotificationPrefs = saveNotificationPrefs;
  exports.getNotificationPrefs = getNotificationPrefs;
  exports.getCapacityAlert = getCapacityAlert;

})(typeof module !== "undefined" ? module.exports : (window.LNVVenuePulse = {}));
