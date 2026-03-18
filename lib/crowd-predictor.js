/**
 * Late Night Vibes — Crowd & Wait Time Predictor.
 *
 * Uses historical check-in data and crowd reports to predict busyness
 * levels and wait times by venue, hour, and day-of-week.
 *
 * UMD-style export: works in Node (tests) and browser
 * (<script src="lib/crowd-predictor.js"> -> window.LNVCrowdPredictor).
 */
(function (exports) {
  "use strict";

  var STORAGE_KEY = "lnv_crowd_reports";
  var REPORT_EXPIRY_MS = 2 * 60 * 60 * 1000;  // 2 hours
  var COOLDOWN_MS = 10 * 60 * 1000;            // 10 minutes

  var LEVELS = ["Dead", "Quiet", "Moderate", "Busy", "Packed"];
  var HOURS = [18, 19, 20, 21, 22, 23, 0, 1, 2, 3];

  /* Day-of-week names matching Date.getDay() */
  var DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  /* Category-based default busyness profiles (1-5 per hour slot) */
  var CATEGORY_DEFAULTS = {
    "Bar":        { base: [1, 1, 2, 2, 3, 3, 3, 2, 2, 1] },
    "Club":       { base: [1, 1, 1, 2, 3, 4, 4, 3, 3, 2] },
    "Lounge":     { base: [1, 2, 2, 3, 3, 3, 2, 2, 1, 1] },
    "Restaurant": { base: [2, 3, 3, 2, 2, 1, 1, 1, 1, 1] },
    "Brewery":    { base: [2, 2, 3, 3, 2, 2, 1, 1, 1, 1] },
    "default":    { base: [1, 1, 2, 2, 3, 3, 2, 2, 1, 1] },
  };

  /* Wait time multipliers by busyness level (minutes) */
  var WAIT_BASE = { 1: 0, 2: 0, 3: 5, 4: 15, 5: 30 };
  var WAIT_CATEGORY_MULT = {
    "Club": 1.5,
    "Bar": 1.0,
    "Lounge": 0.8,
    "Restaurant": 1.2,
    "Brewery": 0.6,
    "default": 1.0,
  };

  /* Day-of-week multipliers */
  var DAY_MULTIPLIERS = {
    0: 0.7,   // Sunday
    1: 0.5,   // Monday
    2: 0.6,   // Tuesday
    3: 0.7,   // Wednesday
    4: 0.8,   // Thursday
    5: 1.3,   // Friday
    6: 1.4,   // Saturday
  };

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
    } catch (_) { /* quota exceeded -- silently fail */ }
  }

  function _isExpired(report) {
    return (Date.now() - report.timestamp) >= REPORT_EXPIRY_MS;
  }

  function _pruneExpired(reports) {
    return reports.filter(function (r) {
      return !_isExpired(r);
    });
  }

  /* ─── Internal helpers ─── */

  function _hourIndex(hour) {
    for (var i = 0; i < HOURS.length; i++) {
      if (HOURS[i] === hour) return i;
    }
    return -1;
  }

  function _clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function _getDefaultProfile(category) {
    var cat = category || "default";
    var profile = CATEGORY_DEFAULTS[cat] || CATEGORY_DEFAULTS["default"];
    return profile.base.slice();
  }

  function _getReportsForVenue(venueName) {
    var all = _readAll();
    return all.filter(function (r) {
      return r.venueName === venueName;
    });
  }

  function _getActiveReportsForVenue(venueName) {
    var all = _readAll();
    var active = _pruneExpired(all);
    return active.filter(function (r) {
      return r.venueName === venueName;
    });
  }

  /**
   * Build crowd pattern from historical check-in data (crawl-history, social-feed).
   * Returns object keyed by dayOfWeek (0-6), each with an array of avg levels per hour slot.
   */
  function _buildHistoricalPattern(venueName) {
    var reports = _getReportsForVenue(venueName);
    if (!reports.length) return null;

    /* Accumulate levels per (day, hourIndex) */
    var buckets = {};
    for (var d = 0; d < 7; d++) {
      buckets[d] = {};
      for (var h = 0; h < HOURS.length; h++) {
        buckets[d][h] = [];
      }
    }

    reports.forEach(function (r) {
      var date = new Date(r.timestamp);
      var day = date.getDay();
      var hour = date.getHours();
      var idx = _hourIndex(hour);
      if (idx !== -1 && r.level >= 1 && r.level <= 5) {
        buckets[day][idx].push(r.level);
      }
    });

    var pattern = {};
    for (var dd = 0; dd < 7; dd++) {
      pattern[dd] = [];
      for (var hh = 0; hh < HOURS.length; hh++) {
        var vals = buckets[dd][hh];
        if (vals.length > 0) {
          var sum = 0;
          for (var i = 0; i < vals.length; i++) sum += vals[i];
          pattern[dd].push(Math.round(sum / vals.length));
        } else {
          pattern[dd].push(null);
        }
      }
    }
    return pattern;
  }

  /* ─── Public API ─── */

  /**
   * predictCrowdLevel(venueName, dayOfWeek, hour, category)
   * Returns { level: 1-5, label: string }
   * dayOfWeek: 0 (Sun) - 6 (Sat), hour: 0-23
   * category: optional venue category for default profiles
   */
  function predictCrowdLevel(venueName, dayOfWeek, hour, category) {
    if (!venueName || typeof venueName !== "string") {
      return { level: 1, label: LEVELS[0] };
    }

    var day = (dayOfWeek !== undefined && dayOfWeek !== null) ? dayOfWeek : new Date().getDay();
    var h = (hour !== undefined && hour !== null) ? hour : new Date().getHours();
    var idx = _hourIndex(h);
    if (idx === -1) return { level: 1, label: LEVELS[0] };

    var level = null;

    /* Try historical pattern first */
    var pattern = _buildHistoricalPattern(venueName);
    if (pattern && pattern[day] && pattern[day][idx] !== null) {
      level = pattern[day][idx];
    }

    /* Fall back to category defaults with day-of-week adjustment */
    if (level === null) {
      var defaults = _getDefaultProfile(category);
      var baseLevel = defaults[idx];
      var mult = DAY_MULTIPLIERS[day] !== undefined ? DAY_MULTIPLIERS[day] : 1.0;
      level = Math.round(baseLevel * mult);
    }

    /* Factor in recent live reports */
    var activeReports = _getActiveReportsForVenue(venueName);
    if (activeReports.length > 0) {
      var liveSum = 0;
      for (var i = 0; i < activeReports.length; i++) {
        liveSum += activeReports[i].level;
      }
      var liveAvg = liveSum / activeReports.length;
      /* Weight live data more heavily */
      level = Math.round((level + liveAvg * 2) / 3);
    }

    level = _clamp(level, 1, 5);
    return { level: level, label: LEVELS[level - 1] };
  }

  /**
   * estimateWaitTime(venueName, dayOfWeek, hour, category)
   * Returns { minutes: number, label: string }
   */
  function estimateWaitTime(venueName, dayOfWeek, hour, category) {
    var prediction = predictCrowdLevel(venueName, dayOfWeek, hour, category);
    var baseWait = WAIT_BASE[prediction.level] || 0;
    var catMult = WAIT_CATEGORY_MULT[category] || WAIT_CATEGORY_MULT["default"];
    var minutes = Math.round(baseWait * catMult);

    var label;
    if (minutes === 0) {
      label = "No wait";
    } else if (minutes <= 5) {
      label = "~" + minutes + " min";
    } else {
      label = minutes + "+ min";
    }

    return { minutes: minutes, label: label };
  }

  /**
   * reportCrowdLevel(venueName, level)
   * level: 1-5
   * Returns the report object, or null on invalid/cooldown.
   */
  function reportCrowdLevel(venueName, level) {
    if (!venueName || typeof venueName !== "string") return null;
    var lvl = Number(level);
    if (isNaN(lvl) || lvl < 1 || lvl > 5) return null;
    lvl = Math.round(lvl);

    /* Check cooldown */
    var all = _readAll();
    var now = Date.now();
    var recentForVenue = all.filter(function (r) {
      return r.venueName === venueName && (now - r.timestamp) < COOLDOWN_MS;
    });
    if (recentForVenue.length > 0) return null;

    var report = {
      venueName: venueName,
      level: lvl,
      label: LEVELS[lvl - 1],
      timestamp: now,
    };

    all.push(report);
    _writeAll(all);
    return report;
  }

  /**
   * getCrowdHistory(venueName, limit)
   * Returns array of reports for venue, newest first. Includes expired.
   */
  function getCrowdHistory(venueName, limit) {
    if (!venueName) return [];
    var maxItems = (limit !== undefined && limit !== null) ? limit : 20;
    var all = _readAll();
    var venueReports = all.filter(function (r) {
      return r.venueName === venueName;
    });
    venueReports.sort(function (a, b) { return b.timestamp - a.timestamp; });
    return venueReports.slice(0, maxItems);
  }

  /**
   * getBestTimeToVisit(venueName, category)
   * Returns { hour: number, dayOfWeek: number, dayName: string, label: string, level: number }
   * Finds the hour slot with lowest predicted busyness across the week.
   */
  function getBestTimeToVisit(venueName, category) {
    if (!venueName) return null;

    var bestHour = HOURS[0];
    var bestDay = 0;
    var bestLevel = 6;

    for (var d = 0; d < 7; d++) {
      for (var hi = 0; hi < HOURS.length; hi++) {
        var prediction = predictCrowdLevel(venueName, d, HOURS[hi], category);
        if (prediction.level < bestLevel) {
          bestLevel = prediction.level;
          bestHour = HOURS[hi];
          bestDay = d;
        }
      }
    }

    var hourLabel = bestHour === 0 ? "12 AM" :
                    bestHour <= 12 ? bestHour + (bestHour === 12 ? " PM" : " AM") :
                    (bestHour - 12) + " PM";
    if (bestHour >= 13) hourLabel = (bestHour - 12) + " PM";
    if (bestHour === 0) hourLabel = "12 AM";
    if (bestHour === 12) hourLabel = "12 PM";
    if (bestHour < 12 && bestHour > 0) hourLabel = bestHour + " AM";

    return {
      hour: bestHour,
      dayOfWeek: bestDay,
      dayName: DAY_NAMES[bestDay],
      label: DAY_NAMES[bestDay] + " at " + hourLabel,
      level: bestLevel,
    };
  }

  /**
   * getCurrentPrediction(venueName, category)
   * Returns { level, label, hour, dayOfWeek, hasLiveData, reportCount }
   */
  function getCurrentPrediction(venueName, category) {
    if (!venueName) return null;

    var now = new Date();
    var day = now.getDay();
    var hour = now.getHours();
    var prediction = predictCrowdLevel(venueName, day, hour, category);

    var activeReports = _getActiveReportsForVenue(venueName);

    return {
      level: prediction.level,
      label: prediction.label,
      hour: hour,
      dayOfWeek: day,
      hasLiveData: activeReports.length > 0,
      reportCount: activeReports.length,
    };
  }

  /**
   * getQuietVenuesNow(venues)
   * venues: array of { Name, Category } objects
   * Returns array of { venueName, level, label } sorted by level ascending.
   */
  function getQuietVenuesNow(venues) {
    if (!Array.isArray(venues)) return [];

    var now = new Date();
    var day = now.getDay();
    var hour = now.getHours();
    var results = [];

    for (var i = 0; i < venues.length; i++) {
      var v = venues[i];
      var name = v.Name || v.name;
      if (!name) continue;
      var prediction = predictCrowdLevel(name, day, hour, v.Category || v.category);
      results.push({
        venueName: name,
        level: prediction.level,
        label: prediction.label,
      });
    }

    results.sort(function (a, b) { return a.level - b.level; });
    return results;
  }

  /**
   * getPeakHours(venueName, dayOfWeek, category)
   * Returns array of { hour, level, label } for hours with level >= 4, sorted by level desc.
   * If dayOfWeek is omitted, uses the current day.
   */
  function getPeakHours(venueName, dayOfWeek, category) {
    if (!venueName) return [];

    var day = (dayOfWeek !== undefined && dayOfWeek !== null) ? dayOfWeek : new Date().getDay();
    var peaks = [];

    for (var i = 0; i < HOURS.length; i++) {
      var prediction = predictCrowdLevel(venueName, day, HOURS[i], category);
      if (prediction.level >= 4) {
        peaks.push({
          hour: HOURS[i],
          level: prediction.level,
          label: prediction.label,
        });
      }
    }

    peaks.sort(function (a, b) { return b.level - a.level; });
    return peaks;
  }

  /* ─── Exports ─── */

  exports.predictCrowdLevel = predictCrowdLevel;
  exports.estimateWaitTime = estimateWaitTime;
  exports.reportCrowdLevel = reportCrowdLevel;
  exports.getCrowdHistory = getCrowdHistory;
  exports.getBestTimeToVisit = getBestTimeToVisit;
  exports.getCurrentPrediction = getCurrentPrediction;
  exports.getQuietVenuesNow = getQuietVenuesNow;
  exports.getPeakHours = getPeakHours;

  /* Expose constants for tests */
  exports.LEVELS = LEVELS;
  exports.HOURS = HOURS;
  exports.DAY_NAMES = DAY_NAMES;

})(typeof module !== "undefined" ? module.exports : (window.LNVCrowdPredictor = {}));
