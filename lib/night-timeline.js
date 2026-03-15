/**
 * Late Night Vibes — Night Timeline (auto-assembled night-out recap/story).
 * UMD-style export: works in Node (tests) and browser
 * (<script src="lib/night-timeline.js"> → window.LNVNightTimeline).
 */
(function (exports) {
  "use strict";

  var STORAGE_KEY = "lnv_night_timeline";
  var VALID_MOODS = ["amazing", "great", "good", "meh", "rough"];

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

  /* ─── Persistence ─── */

  function _loadNights() {
    try {
      _migrate();
      var raw = (typeof localStorage !== "undefined") ? localStorage.getItem(_scopedKey()) : null;
      if (raw) return JSON.parse(raw);
    } catch (_) { /* ignore */ }
    return [];
  }

  function _saveNights(nights) {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(_scopedKey(), JSON.stringify(nights));
      }
    } catch (_) { /* ignore */ }
  }

  /* ─── Helpers ─── */

  function _formatDate(ts) {
    var d = new Date(ts);
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months[d.getMonth()] + " " + d.getDate();
  }

  function _formatFullDate(ts) {
    var d = new Date(ts);
    return d.toLocaleDateString();
  }

  /* ─── 1. Night Sessions ─── */

  /**
   * Start a new night out session.
   * @param {string} [name] — Optional name; defaults to "Night Out - Mon DD"
   * @returns {object|null} The new session, or null if one is already active.
   */
  function startNight(name) {
    var nights = _loadNights();
    // Check for active night
    for (var i = 0; i < nights.length; i++) {
      if (!nights[i].endTime) return null;
    }
    var now = Date.now();
    var session = {
      id: now,
      name: name || ("Night Out - " + _formatDate(now)),
      startTime: now,
      stops: [],
      photos: [],
      notes: [],
      mood: null,
      endTime: null
    };
    nights.push(session);
    _saveNights(nights);
    return session;
  }

  /**
   * End the current active night session.
   * @returns {object|null} The completed session, or null if none active.
   */
  function endNight() {
    var nights = _loadNights();
    for (var i = 0; i < nights.length; i++) {
      if (!nights[i].endTime) {
        nights[i].endTime = Date.now();
        _saveNights(nights);
        return nights[i];
      }
    }
    return null;
  }

  /**
   * Get the current active night session.
   * @returns {object|null}
   */
  function getActiveNight() {
    var nights = _loadNights();
    for (var i = 0; i < nights.length; i++) {
      if (!nights[i].endTime) return nights[i];
    }
    return null;
  }

  /* ─── 2. Check-ins (Stops) ─── */

  /**
   * Add a venue stop to the active night.
   * @param {string} venueName — Required venue name.
   * @param {object} [details] — { rating, vibes, drink, spend }
   * @returns {object|null} The stop object, or null if invalid.
   */
  function checkIn(venueName, details) {
    if (!venueName || typeof venueName !== "string" || !venueName.trim()) return null;
    var nights = _loadNights();
    var active = null;
    var idx = -1;
    for (var i = 0; i < nights.length; i++) {
      if (!nights[i].endTime) { active = nights[i]; idx = i; break; }
    }
    if (!active) return null;

    var d = details || {};
    var stop = {
      venueName: venueName.trim(),
      arrivalTime: Date.now(),
      departureTime: null,
      rating: (typeof d.rating === "number" && d.rating >= 1 && d.rating <= 5) ? d.rating : null,
      vibes: (typeof d.vibes === "string") ? d.vibes : null,
      drink: (typeof d.drink === "string") ? d.drink : null,
      spend: (typeof d.spend === "number" && d.spend >= 0) ? d.spend : null
    };
    nights[idx].stops.push(stop);
    _saveNights(nights);
    return stop;
  }

  /**
   * Mark departure from a venue in the active night.
   * @param {string} venueName
   * @returns {object|null} The updated stop, or null if not found.
   */
  function checkOut(venueName) {
    if (!venueName || typeof venueName !== "string") return null;
    var nights = _loadNights();
    for (var i = 0; i < nights.length; i++) {
      if (!nights[i].endTime) {
        var stops = nights[i].stops;
        for (var j = stops.length - 1; j >= 0; j--) {
          if (stops[j].venueName === venueName.trim() && !stops[j].departureTime) {
            stops[j].departureTime = Date.now();
            _saveNights(nights);
            return stops[j];
          }
        }
        return null;
      }
    }
    return null;
  }

  /* ─── 3. Photo Memories ─── */

  /**
   * Add a photo to the active night.
   * @param {string} url — Required.
   * @param {string} [caption]
   * @param {string} [venueName]
   * @returns {object|null}
   */
  function addPhoto(url, caption, venueName) {
    if (!url || typeof url !== "string") return null;
    var nights = _loadNights();
    var idx = -1;
    for (var i = 0; i < nights.length; i++) {
      if (!nights[i].endTime) { idx = i; break; }
    }
    if (idx === -1) return null;

    var photo = {
      url: url,
      caption: caption || null,
      venueName: venueName || null,
      timestamp: Date.now()
    };
    nights[idx].photos.push(photo);
    _saveNights(nights);
    return photo;
  }

  /* ─── 4. Night Notes ─── */

  /**
   * Add a text note/memory to the active night.
   * @param {string} text — Required.
   * @param {string} [venueName]
   * @returns {object|null}
   */
  function addNote(text, venueName) {
    if (!text || typeof text !== "string") return null;
    var nights = _loadNights();
    var idx = -1;
    for (var i = 0; i < nights.length; i++) {
      if (!nights[i].endTime) { idx = i; break; }
    }
    if (idx === -1) return null;

    var note = {
      text: text,
      venueName: venueName || null,
      timestamp: Date.now()
    };
    nights[idx].notes.push(note);
    _saveNights(nights);
    return note;
  }

  /* ─── 5. Night Recap / Summary ─── */

  /**
   * Generate a summary recap of a past night.
   * @param {number} nightId
   * @returns {object|null}
   */
  function getNightRecap(nightId) {
    var nights = _loadNights();
    var night = null;
    for (var i = 0; i < nights.length; i++) {
      if (nights[i].id === nightId) { night = nights[i]; break; }
    }
    if (!night) return null;

    var totalSpend = 0;
    var ratingSum = 0;
    var ratingCount = 0;
    var venues = [];
    var topRatedVenue = null;
    var topRating = 0;

    for (var j = 0; j < night.stops.length; j++) {
      var stop = night.stops[j];
      venues.push(stop.venueName);
      if (typeof stop.spend === "number" && stop.spend !== null) {
        totalSpend += stop.spend;
      }
      if (typeof stop.rating === "number" && stop.rating !== null) {
        ratingSum += stop.rating;
        ratingCount++;
        if (stop.rating > topRating) {
          topRating = stop.rating;
          topRatedVenue = stop.venueName;
        }
      }
    }

    var duration = night.endTime ? (night.endTime - night.startTime) : (Date.now() - night.startTime);

    return {
      name: night.name,
      date: _formatFullDate(night.startTime),
      duration: duration,
      totalStops: night.stops.length,
      totalSpend: totalSpend,
      venues: venues,
      topRatedVenue: topRatedVenue,
      photoCount: night.photos.length,
      noteCount: night.notes.length,
      avgRating: ratingCount > 0 ? (ratingSum / ratingCount) : 0,
      moodSummary: night.mood
    };
  }

  /**
   * Set overall mood for the active night.
   * @param {string} mood
   * @returns {boolean}
   */
  function setNightMood(mood) {
    if (typeof mood !== "string" || VALID_MOODS.indexOf(mood) === -1) return false;
    var nights = _loadNights();
    for (var i = 0; i < nights.length; i++) {
      if (!nights[i].endTime) {
        nights[i].mood = mood;
        _saveNights(nights);
        return true;
      }
    }
    return false;
  }

  /* ─── 6. Night History ─── */

  /**
   * Get past completed nights, newest first.
   * @param {number} [limit=10]
   * @returns {Array}
   */
  function getNightHistory(limit) {
    var lim = (typeof limit === "number" && limit > 0) ? limit : 10;
    var nights = _loadNights();
    var completed = [];
    for (var i = 0; i < nights.length; i++) {
      if (nights[i].endTime) completed.push(nights[i]);
    }
    completed.sort(function (a, b) { return b.startTime - a.startTime; });
    return completed.slice(0, lim);
  }

  /**
   * Get a specific night by ID.
   * @param {number} nightId
   * @returns {object|null}
   */
  function getNightById(nightId) {
    var nights = _loadNights();
    for (var i = 0; i < nights.length; i++) {
      if (nights[i].id === nightId) return nights[i];
    }
    return null;
  }

  /**
   * Delete a specific night from history.
   * @param {number} nightId
   * @returns {boolean}
   */
  function deleteNight(nightId) {
    var nights = _loadNights();
    for (var i = 0; i < nights.length; i++) {
      if (nights[i].id === nightId) {
        nights.splice(i, 1);
        _saveNights(nights);
        return true;
      }
    }
    return false;
  }

  /**
   * Aggregate stats across all completed nights.
   * @returns {object}
   */
  function getNightStats() {
    var nights = _loadNights();
    var completed = [];
    for (var i = 0; i < nights.length; i++) {
      if (nights[i].endTime) completed.push(nights[i]);
    }

    var totalVenuesVisited = 0;
    var totalSpend = 0;
    var totalStops = 0;
    var ratingSum = 0;
    var ratingCount = 0;
    var venueCounts = {};

    for (var n = 0; n < completed.length; n++) {
      var night = completed[n];
      totalStops += night.stops.length;
      for (var s = 0; s < night.stops.length; s++) {
        var stop = night.stops[s];
        totalVenuesVisited++;
        if (typeof stop.spend === "number" && stop.spend !== null) {
          totalSpend += stop.spend;
        }
        if (typeof stop.rating === "number" && stop.rating !== null) {
          ratingSum += stop.rating;
          ratingCount++;
        }
        venueCounts[stop.venueName] = (venueCounts[stop.venueName] || 0) + 1;
      }
    }

    var favoriteVenue = null;
    var maxCount = 0;
    for (var venue in venueCounts) {
      if (venueCounts[venue] > maxCount) {
        maxCount = venueCounts[venue];
        favoriteVenue = venue;
      }
    }

    return {
      totalNights: completed.length,
      totalVenuesVisited: totalVenuesVisited,
      totalSpend: totalSpend,
      avgStopsPerNight: completed.length > 0 ? (totalStops / completed.length) : 0,
      favoriteVenue: favoriteVenue,
      avgRating: ratingCount > 0 ? (ratingSum / ratingCount) : 0
    };
  }

  /* ─── 7. Share & Export ─── */

  /**
   * Export a night as a shareable JSON string.
   * @param {number} nightId
   * @returns {string|null}
   */
  function exportNight(nightId) {
    var night = getNightById(nightId);
    if (!night) return null;
    return JSON.stringify(night);
  }

  /**
   * Import a shared night into history.
   * @param {string} jsonString
   * @returns {object|null}
   */
  function importNight(jsonString) {
    if (typeof jsonString !== "string") return null;
    try {
      var night = JSON.parse(jsonString);
      if (!night || typeof night !== "object") return null;
      if (!night.id || !night.name || !night.startTime) return null;
      if (!Array.isArray(night.stops)) return null;
      if (!Array.isArray(night.photos)) return null;
      if (!Array.isArray(night.notes)) return null;

      var nights = _loadNights();
      // Avoid duplicate IDs
      for (var i = 0; i < nights.length; i++) {
        if (nights[i].id === night.id) return null;
      }
      nights.push(night);
      _saveNights(nights);
      return night;
    } catch (_) {
      return null;
    }
  }

  /**
   * Generate a human-readable text summary of a night.
   * @param {number} nightId
   * @returns {string|null}
   */
  function generateShareText(nightId) {
    var night = getNightById(nightId);
    if (!night) return null;

    var lines = [];
    lines.push("\uD83C\uDF19 " + night.name);
    lines.push(_formatFullDate(night.startTime));
    lines.push("");
    lines.push("Stops:");
    for (var i = 0; i < night.stops.length; i++) {
      var stop = night.stops[i];
      var line = (i + 1) + ". " + stop.venueName;
      if (typeof stop.rating === "number" && stop.rating !== null) {
        line += " - " + stop.rating + "\u2B50";
      }
      lines.push(line);
    }
    if (night.mood) {
      lines.push("");
      lines.push("Mood: " + night.mood);
    }
    return lines.join("\n");
  }

  /* ─── Public API ─── */

  exports.STORAGE_KEY = STORAGE_KEY;
  exports.startNight = startNight;
  exports.endNight = endNight;
  exports.getActiveNight = getActiveNight;
  exports.checkIn = checkIn;
  exports.checkOut = checkOut;
  exports.addPhoto = addPhoto;
  exports.addNote = addNote;
  exports.getNightRecap = getNightRecap;
  exports.setNightMood = setNightMood;
  exports.getNightHistory = getNightHistory;
  exports.getNightById = getNightById;
  exports.deleteNight = deleteNight;
  exports.getNightStats = getNightStats;
  exports.exportNight = exportNight;
  exports.importNight = importNight;
  exports.generateShareText = generateShareText;

})(typeof module !== "undefined" ? module.exports : (window.LNVNightTimeline = {}));
