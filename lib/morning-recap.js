/**
 * Late Night Vibes — Morning-After Recap & Sharing.
 *
 * Automatically generates a polished night summary from the previous night's
 * data by pulling from night-timeline, crawl-history, music-tracker,
 * social-feed, and gamification modules.
 *
 * UMD-style export: works in Node (tests) and browser
 * (<script src="lib/morning-recap.js"> -> window.LNVMorningRecap).
 */
(function (exports) {
  "use strict";

  var STORAGE_KEY = "lnv_recaps";

  /* ─── Dependency accessors ─── */

  function _timeline() {
    if (typeof module !== "undefined") return require("./night-timeline");
    return (typeof window !== "undefined" && window.LNVNightTimeline) || null;
  }

  function _crawl() {
    if (typeof module !== "undefined") return require("./crawl-history");
    return (typeof window !== "undefined" && window.LNVCrawl) || null;
  }

  function _music() {
    if (typeof module !== "undefined") return require("./music-tracker");
    return (typeof window !== "undefined" && window.LNVMusicTracker) || null;
  }

  function _social() {
    if (typeof module !== "undefined") return require("./social-feed");
    return (typeof window !== "undefined" && window.LNVSocialFeed) || null;
  }

  function _gamification() {
    if (typeof module !== "undefined") return require("./gamification");
    return (typeof window !== "undefined" && window.LNVGamification) || null;
  }

  function _cities() {
    if (typeof module !== "undefined") {
      try { return require("./cities"); } catch (_e) { return null; }
    }
    return (typeof window !== "undefined" && window.LNVCities) || null;
  }

  /* ─── City-scoped key helpers ─── */

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

  function _readRecaps() {
    try {
      _migrate();
      var raw = (typeof localStorage !== "undefined") ? localStorage.getItem(_scopedKey()) : null;
      return raw ? JSON.parse(raw) : [];
    } catch (_e) {
      return [];
    }
  }

  function _writeRecaps(recaps) {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(_scopedKey(), JSON.stringify(recaps));
      }
    } catch (_e) { /* quota exceeded */ }
  }

  /* ─── Now helper (overridable for tests) ─── */

  var _nowFn = function () { return Date.now(); };

  function _setNowFn(fn) {
    _nowFn = fn;
  }

  function _resetNowFn() {
    _nowFn = function () { return Date.now(); };
  }

  /* ─── Date helpers ─── */

  /**
   * Convert a YYYY-MM-DD string to a date key, or default to "last night".
   * "Last night" = yesterday if current time >= 6 AM, otherwise two days ago.
   */
  function _resolveDate(date) {
    if (date && typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    var now = new Date(_nowFn());
    // If before 6 AM, the "night" is the previous calendar day's night
    if (now.getHours() < 6) {
      now.setDate(now.getDate() - 1);
    }
    // Go back one more day to get "last night"
    now.setDate(now.getDate() - 1);
    return _dateKey(now.getTime());
  }

  function _dateKey(timestamp) {
    var d = new Date(timestamp);
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1);
    if (m.length < 2) m = "0" + m;
    var day = String(d.getDate());
    if (day.length < 2) day = "0" + day;
    return y + "-" + m + "-" + day;
  }

  /**
   * Check if a timestamp belongs to a given night (date string YYYY-MM-DD).
   * A night spans from 6 PM on the date to 6 AM the next day.
   */
  function _isOnNight(timestamp, dateStr) {
    var parts = dateStr.split("-");
    var year = parseInt(parts[0], 10);
    var month = parseInt(parts[1], 10) - 1;
    var day = parseInt(parts[2], 10);

    // Night starts at 6 PM on the date
    var nightStart = new Date(year, month, day, 18, 0, 0).getTime();
    // Night ends at 6 AM the next day
    var nightEnd = new Date(year, month, day + 1, 6, 0, 0).getTime();

    return timestamp >= nightStart && timestamp < nightEnd;
  }

  /**
   * Check if an ISO date string or timestamp belongs to a night.
   * For crawl history, visitedAt is an ISO string; hours 0-5 belong to previous night.
   */
  function _visitMatchesNight(visitedAt, dateStr) {
    if (!visitedAt || !dateStr) return false;
    var d = new Date(visitedAt);
    var ts = d.getTime();
    if (isNaN(ts)) return false;

    var hour = d.getHours();
    // If visit was between midnight and 6 AM, it belongs to previous calendar day's night
    var visitDate = new Date(d);
    if (hour < 6) {
      visitDate.setDate(visitDate.getDate() - 1);
    }
    var y = visitDate.getFullYear();
    var m = String(visitDate.getMonth() + 1);
    if (m.length < 2) m = "0" + m;
    var dd = String(visitDate.getDate());
    if (dd.length < 2) dd = "0" + dd;
    return (y + "-" + m + "-" + dd) === dateStr;
  }

  /* ─── Data gathering ─── */

  /**
   * Get night timeline sessions that overlap with the given date night.
   */
  function _getNightSessions(dateStr) {
    var tl = _timeline();
    if (!tl) return [];

    var history = tl.getNightHistory(100);
    var matched = [];
    for (var i = 0; i < history.length; i++) {
      var night = history[i];
      // Check if this night session overlaps with our target date
      if (_isOnNight(night.startTime, dateStr) ||
          (night.endTime && _isOnNight(night.endTime, dateStr)) ||
          _visitMatchesNight(new Date(night.startTime).toISOString(), dateStr)) {
        matched.push(night);
      }
    }
    return matched;
  }

  /**
   * Get crawl history entries for a specific night.
   */
  function _getCrawlEntries(dateStr) {
    var cr = _crawl();
    if (!cr) return [];

    var history = cr.loadHistory();
    var entries = [];
    var names = Object.keys(history);
    for (var i = 0; i < names.length; i++) {
      var name = names[i];
      var entry = history[name];
      if (entry.visitedAt && _visitMatchesNight(entry.visitedAt, dateStr)) {
        entries.push({
          name: name,
          rating: entry.rating || 0,
          visitedAt: entry.visitedAt
        });
      }
    }
    // Sort by visit time
    entries.sort(function (a, b) {
      return new Date(a.visitedAt).getTime() - new Date(b.visitedAt).getTime();
    });
    return entries;
  }

  /**
   * Get music reports from the night.
   */
  function _getMusicReports(dateStr) {
    var mt = _music();
    if (!mt) return [];

    // Music tracker stores all reports; filter by date
    // We need to read all reports — use getVenueMusicHistory for each known venue
    // Since we can't enumerate all venues easily, we'll check the raw storage
    var reports = [];
    try {
      var key = "lnv_music_tracker";
      var c = _cities();
      var scopedKey = c && c.getCityKey ? c.getCityKey(key) : key;
      var raw = (typeof localStorage !== "undefined") ? localStorage.getItem(scopedKey) : null;
      if (raw) {
        var all = JSON.parse(raw);
        for (var i = 0; i < all.length; i++) {
          if (_isOnNight(all[i].timestamp, dateStr)) {
            reports.push(all[i]);
          }
        }
      }
    } catch (_e) { /* ignore */ }
    return reports;
  }

  /**
   * Get social feed posts from the night.
   */
  function _getSocialPosts(dateStr) {
    var sf = _social();
    if (!sf) return [];

    var feed = sf.getFeed({ limit: 200 });
    var posts = [];
    for (var i = 0; i < feed.length; i++) {
      if (_isOnNight(feed[i].timestamp, dateStr)) {
        posts.push(feed[i]);
      }
    }
    return posts;
  }

  /**
   * Get achievements unlocked (from gamification).
   */
  function _getAchievements() {
    var gm = _gamification();
    if (!gm) return [];
    return gm.getUnlockedAchievements();
  }

  /* ─── Core computation ─── */

  /**
   * Check if there is any night data for the given date.
   */
  function hasNightData(date) {
    var dateStr = _resolveDate(date);
    var sessions = _getNightSessions(dateStr);
    var crawlEntries = _getCrawlEntries(dateStr);
    return sessions.length > 0 || crawlEntries.length > 0;
  }

  /**
   * Compute night stats for a given date.
   */
  function getNightStats(date) {
    var dateStr = _resolveDate(date);
    var sessions = _getNightSessions(dateStr);
    var crawlEntries = _getCrawlEntries(dateStr);
    var musicReports = _getMusicReports(dateStr);
    var socialPosts = _getSocialPosts(dateStr);

    // Collect venues from both timeline stops and crawl history
    var venueNames = {};
    var neighborhoods = {};
    var vibes = {};
    var totalSpend = 0;
    var ratingSum = 0;
    var ratingCount = 0;

    // From timeline sessions
    var earliestTime = null;
    var latestTime = null;

    for (var i = 0; i < sessions.length; i++) {
      var session = sessions[i];
      if (!earliestTime || session.startTime < earliestTime) {
        earliestTime = session.startTime;
      }
      if (session.endTime && (!latestTime || session.endTime > latestTime)) {
        latestTime = session.endTime;
      }

      for (var j = 0; j < session.stops.length; j++) {
        var stop = session.stops[j];
        venueNames[stop.venueName] = true;
        if (stop.vibes) {
          var tags = stop.vibes.split(",");
          for (var t = 0; t < tags.length; t++) {
            var tag = tags[t].trim();
            if (tag) vibes[tag] = (vibes[tag] || 0) + 1;
          }
        }
        if (typeof stop.spend === "number" && stop.spend > 0) {
          totalSpend += stop.spend;
        }
        if (typeof stop.rating === "number" && stop.rating >= 1 && stop.rating <= 5) {
          ratingSum += stop.rating;
          ratingCount++;
        }
      }
    }

    // From crawl entries
    for (var c = 0; c < crawlEntries.length; c++) {
      venueNames[crawlEntries[c].name] = true;
      var visitTime = new Date(crawlEntries[c].visitedAt).getTime();
      if (!earliestTime || visitTime < earliestTime) earliestTime = visitTime;
      if (!latestTime || visitTime > latestTime) latestTime = visitTime;
    }

    // Music genres
    var genres = {};
    for (var m = 0; m < musicReports.length; m++) {
      if (musicReports[m].genre) {
        genres[musicReports[m].genre] = (genres[musicReports[m].genre] || 0) + 1;
      }
    }

    // Compute duration in ms
    var duration = (earliestTime && latestTime) ? (latestTime - earliestTime) : 0;

    // Social activity count
    var socialCount = socialPosts.length;
    var checkinCount = 0;
    for (var s = 0; s < socialPosts.length; s++) {
      if (socialPosts[s].type === "checkin") checkinCount++;
    }

    var venueCount = Object.keys(venueNames).length;
    var neighborhoodCount = Object.keys(neighborhoods).length;
    var vibeCount = Object.keys(vibes).length;
    var genreCount = Object.keys(genres).length;

    return {
      totalVenues: venueCount,
      totalDistance: 0, // Would require lat/lng data per stop
      duration: duration,
      durationHours: Math.round((duration / (1000 * 60 * 60)) * 10) / 10,
      vibesExperienced: vibeCount,
      neighborhoods: neighborhoodCount,
      musicGenres: genreCount,
      genres: genres,
      totalSpend: totalSpend,
      avgRating: ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : 0,
      socialPosts: socialCount,
      checkins: checkinCount,
      venueNames: Object.keys(venueNames)
    };
  }

  /**
   * Compute a night score (0-100) based on variety, duration, social activity, exploration.
   */
  function getNightScore(date) {
    var dateStr = _resolveDate(date);
    var stats = getNightStats(dateStr);

    if (stats.totalVenues === 0) return 0;

    // Variety: venues visited (up to 5 for max) — 25 points
    var venueScore = Math.min(stats.totalVenues / 5, 1) * 25;

    // Duration: hours out (up to 5 hours for max) — 25 points
    var durationScore = Math.min(stats.durationHours / 5, 1) * 25;

    // Social activity: posts + checkins (up to 6 for max) — 20 points
    var socialScore = Math.min((stats.socialPosts + stats.checkins) / 6, 1) * 20;

    // Exploration: vibes + genres (up to 8 for max) — 15 points
    var explorationScore = Math.min((stats.vibesExperienced + stats.musicGenres) / 8, 1) * 15;

    // Bonus: good ratings — 15 points
    var ratingScore = stats.avgRating > 0 ? Math.min(stats.avgRating / 5, 1) * 15 : 7;

    var score = Math.round(venueScore + durationScore + socialScore + explorationScore + ratingScore);
    return Math.min(100, Math.max(0, score));
  }

  /**
   * Detect night highlights.
   */
  function getNightHighlights(date) {
    var dateStr = _resolveDate(date);
    var sessions = _getNightSessions(dateStr);
    var crawlEntries = _getCrawlEntries(dateStr);
    var achievements = _getAchievements();
    var highlights = [];

    // Find first-time venues: venues that appear in crawl history for this date
    // but not in any previous timeline sessions
    var allPastVenues = {};
    var tl = _timeline();
    if (tl) {
      var allHistory = tl.getNightHistory(100);
      for (var h = 0; h < allHistory.length; h++) {
        var session = allHistory[h];
        // Skip sessions from this night
        if (_isOnNight(session.startTime, dateStr)) continue;
        for (var s = 0; s < session.stops.length; s++) {
          allPastVenues[session.stops[s].venueName] = true;
        }
      }
    }

    // Check this night's venues for first-timers
    for (var i = 0; i < sessions.length; i++) {
      var stops = sessions[i].stops;
      for (var j = 0; j < stops.length; j++) {
        if (!allPastVenues[stops[j].venueName]) {
          highlights.push({
            type: "first-visit",
            venue: stops[j].venueName,
            description: "First time at " + stops[j].venueName
          });
        }
      }
    }

    // Highest-rated spot
    var highestRating = 0;
    var highestRatedVenue = null;
    for (var k = 0; k < sessions.length; k++) {
      var nightStops = sessions[k].stops;
      for (var l = 0; l < nightStops.length; l++) {
        if (typeof nightStops[l].rating === "number" && nightStops[l].rating > highestRating) {
          highestRating = nightStops[l].rating;
          highestRatedVenue = nightStops[l].venueName;
        }
      }
    }
    if (highestRatedVenue) {
      highlights.push({
        type: "highest-rated",
        venue: highestRatedVenue,
        rating: highestRating,
        description: highestRatedVenue + " was your top spot (" + highestRating + "/5)"
      });
    }

    // Achievements unlocked (we list all — in a real app we'd filter by date)
    if (achievements.length > 0) {
      for (var a = 0; a < achievements.length; a++) {
        highlights.push({
          type: "achievement",
          achievement: achievements[a],
          description: "Achievement unlocked: " + achievements[a].name
        });
      }
    }

    return highlights;
  }

  /**
   * Generate a frequency-weighted vibe cloud from the night.
   */
  function getVibeCloud(date) {
    var dateStr = _resolveDate(date);
    var sessions = _getNightSessions(dateStr);
    var vibes = {};

    for (var i = 0; i < sessions.length; i++) {
      var stops = sessions[i].stops;
      for (var j = 0; j < stops.length; j++) {
        if (stops[j].vibes) {
          var tags = stops[j].vibes.split(",");
          for (var t = 0; t < tags.length; t++) {
            var tag = tags[t].trim();
            if (tag) vibes[tag] = (vibes[tag] || 0) + 1;
          }
        }
      }
    }

    // Also add music genres as vibes
    var musicReports = _getMusicReports(dateStr);
    for (var m = 0; m < musicReports.length; m++) {
      if (musicReports[m].genre) {
        vibes[musicReports[m].genre] = (vibes[musicReports[m].genre] || 0) + 1;
      }
    }

    // Convert to sorted array
    var entries = [];
    for (var key in vibes) {
      if (vibes.hasOwnProperty(key)) {
        entries.push({ tag: key, count: vibes[key] });
      }
    }
    entries.sort(function (a, b) { return b.count - a.count; });

    return entries;
  }

  /**
   * Generate shareable text summary.
   */
  function getShareableText(date) {
    var dateStr = _resolveDate(date);
    var stats = getNightStats(dateStr);
    var score = getNightScore(dateStr);
    var highlights = getNightHighlights(dateStr);
    var vibeCloud = getVibeCloud(dateStr);

    if (stats.totalVenues === 0) return null;

    var lines = [];
    lines.push("Late Night Vibes - Morning Recap");
    lines.push(_formatDisplayDate(dateStr));
    lines.push("");
    lines.push("Night Score: " + score + "/100");
    lines.push("");
    lines.push("Stats:");
    lines.push("  Venues: " + stats.totalVenues);
    if (stats.durationHours > 0) {
      lines.push("  Time Out: " + _formatDuration(stats.duration));
    }
    if (stats.musicGenres > 0) {
      lines.push("  Music Genres: " + stats.musicGenres);
    }
    if (stats.totalSpend > 0) {
      lines.push("  Spent: $" + stats.totalSpend.toFixed(2));
    }

    if (stats.venueNames.length > 0) {
      lines.push("");
      lines.push("Venues:");
      for (var i = 0; i < stats.venueNames.length; i++) {
        lines.push("  " + (i + 1) + ". " + stats.venueNames[i]);
      }
    }

    if (vibeCloud.length > 0) {
      lines.push("");
      var topVibes = vibeCloud.slice(0, 5).map(function (v) { return v.tag; });
      lines.push("Vibes: " + topVibes.join(", "));
    }

    // Highlights
    var nonAchievementHighlights = highlights.filter(function (h) {
      return h.type !== "achievement";
    });
    if (nonAchievementHighlights.length > 0) {
      lines.push("");
      lines.push("Highlights:");
      for (var h = 0; h < nonAchievementHighlights.length; h++) {
        lines.push("  - " + nonAchievementHighlights[h].description);
      }
    }

    lines.push("");
    lines.push("- Late Night Vibes Seattle");
    return lines.join("\n");
  }

  /**
   * Generate a full recap object.
   */
  function generateRecap(date) {
    var dateStr = _resolveDate(date);

    if (!hasNightData(dateStr)) return null;

    var stats = getNightStats(dateStr);
    var score = getNightScore(dateStr);
    var highlights = getNightHighlights(dateStr);
    var vibeCloud = getVibeCloud(dateStr);
    var shareText = getShareableText(dateStr);
    var sessions = _getNightSessions(dateStr);

    // Determine mood from sessions
    var mood = null;
    for (var i = 0; i < sessions.length; i++) {
      if (sessions[i].mood) {
        mood = sessions[i].mood;
        break;
      }
    }

    var recap = {
      date: dateStr,
      generatedAt: _nowFn(),
      nightScore: score,
      stats: stats,
      highlights: highlights,
      vibeCloud: vibeCloud,
      shareText: shareText,
      mood: mood,
      venues: stats.venueNames
    };

    // Store the recap
    var recaps = _readRecaps();
    // Replace any existing recap for this date
    var replaced = false;
    for (var r = 0; r < recaps.length; r++) {
      if (recaps[r].date === dateStr) {
        recaps[r] = recap;
        replaced = true;
        break;
      }
    }
    if (!replaced) {
      recaps.push(recap);
    }
    _writeRecaps(recaps);

    return recap;
  }

  /**
   * Get previously generated recap history.
   */
  function getRecapHistory() {
    var recaps = _readRecaps();
    recaps.sort(function (a, b) {
      return b.date > a.date ? 1 : (b.date < a.date ? -1 : 0);
    });
    return recaps;
  }

  /* ─── Formatting helpers ─── */

  function _formatDisplayDate(dateStr) {
    var parts = dateStr.split("-");
    var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    var days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return days[d.getDay()] + ", " + months[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
  }

  function _formatDuration(ms) {
    var totalMin = Math.round(ms / 60000);
    var hours = Math.floor(totalMin / 60);
    var mins = totalMin % 60;
    if (hours === 0) return mins + "m";
    if (mins === 0) return hours + "h";
    return hours + "h " + mins + "m";
  }

  /* ─── Exports ─── */

  exports.STORAGE_KEY = STORAGE_KEY;
  exports.generateRecap = generateRecap;
  exports.getNightScore = getNightScore;
  exports.getNightStats = getNightStats;
  exports.getNightHighlights = getNightHighlights;
  exports.getShareableText = getShareableText;
  exports.getRecapHistory = getRecapHistory;
  exports.hasNightData = hasNightData;
  exports.getVibeCloud = getVibeCloud;
  exports._setNowFn = _setNowFn;
  exports._resetNowFn = _resetNowFn;

})(typeof module !== "undefined" ? module.exports : (window.LNVMorningRecap = {}));
