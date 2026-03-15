/**
 * Late Night Vibes — Music Tracker (real-time crowd-sourced music/DJ tracking).
 * UMD-style export: works in Node (tests) and browser
 * (<script src="lib/music-tracker.js"> → window.LNVMusicTracker).
 */
(function (exports) {
  "use strict";

  var STORAGE_KEY = "lnv_music_tracker";
  var PREFS_KEY = "lnv_music_prefs";
  var EXPIRY_MS = 3 * 60 * 60 * 1000;    // 3 hours
  var COOLDOWN_MS = 10 * 60 * 1000;       // 10 minutes

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

  function _isExpired(report) {
    return (Date.now() - report.timestamp) >= EXPIRY_MS;
  }

  function _pruneExpired(reports) {
    return reports.filter(function (r) {
      return !_isExpired(r);
    });
  }

  /* ─── 1. Now Playing Reports ─── */

  /**
   * submitNowPlaying(venueName, report)
   * report: { genre, artist, dj, song, energy (1-5), bpm (60-200) }
   * Returns the created report object with timestamp, or null on invalid.
   */
  function submitNowPlaying(venueName, report) {
    if (!venueName || typeof venueName !== "string") return null;
    if (!report || typeof report !== "object") return null;
    if (!report.genre || typeof report.genre !== "string") return null;

    // Validate energy if provided
    if (report.energy !== undefined && report.energy !== null) {
      var energy = Number(report.energy);
      if (isNaN(energy) || energy < 1 || energy > 5) return null;
    }

    // Validate bpm if provided
    if (report.bpm !== undefined && report.bpm !== null) {
      var bpm = Number(report.bpm);
      if (isNaN(bpm) || bpm < 60 || bpm > 200) return null;
    }

    // Check cooldown
    var all = _readAll();
    var now = Date.now();
    var recentForVenue = all.filter(function (r) {
      return r.venueName === venueName && (now - r.timestamp) < COOLDOWN_MS;
    });
    if (recentForVenue.length > 0) return null;

    var entry = {
      venueName: venueName,
      genre: report.genre,
      artist: report.artist || null,
      dj: report.dj || null,
      song: report.song || null,
      energy: report.energy !== undefined && report.energy !== null ? Number(report.energy) : null,
      bpm: report.bpm !== undefined && report.bpm !== null ? Number(report.bpm) : null,
      timestamp: now
    };

    all.push(entry);
    _writeAll(all);
    return entry;
  }

  /* ─── 2. Venue Music Status ─── */

  /**
   * getVenueMusic(venueName) — Get current music at a venue.
   * Returns latest non-expired report, or null.
   */
  function getVenueMusic(venueName) {
    if (!venueName) return null;
    var all = _readAll();
    var active = _pruneExpired(all);
    var venueReports = active.filter(function (r) {
      return r.venueName === venueName;
    });
    if (venueReports.length === 0) return null;
    // Return the most recent
    venueReports.sort(function (a, b) { return b.timestamp - a.timestamp; });
    return venueReports[0];
  }

  /**
   * getVenueMusicHistory(venueName, limit) — Get history of music at venue.
   * Returns array of reports, newest first, limited to `limit` (default 10).
   * Includes expired reports.
   */
  function getVenueMusicHistory(venueName, limit) {
    if (!venueName) return [];
    var maxItems = (limit !== undefined && limit !== null) ? limit : 10;
    var all = _readAll();
    var venueReports = all.filter(function (r) {
      return r.venueName === venueName;
    });
    venueReports.sort(function (a, b) { return b.timestamp - a.timestamp; });
    return venueReports.slice(0, maxItems);
  }

  /* ─── 3. Genre Search ─── */

  /**
   * findVenuesByGenre(genre) — Find all venues currently playing a genre.
   * Case-insensitive partial match. Only non-expired reports.
   * Returns array of { venueName, report } sorted by most recent.
   */
  function findVenuesByGenre(genre) {
    if (!genre || typeof genre !== "string") return [];
    var lowerGenre = genre.toLowerCase();
    var all = _readAll();
    var active = _pruneExpired(all);

    // Get latest report per venue that matches genre
    var venueMap = {};
    active.forEach(function (r) {
      if (r.genre && r.genre.toLowerCase().indexOf(lowerGenre) !== -1) {
        if (!venueMap[r.venueName] || r.timestamp > venueMap[r.venueName].timestamp) {
          venueMap[r.venueName] = r;
        }
      }
    });

    var results = [];
    for (var v in venueMap) {
      results.push({ venueName: v, report: venueMap[v] });
    }
    results.sort(function (a, b) { return b.report.timestamp - a.report.timestamp; });
    return results;
  }

  /* ─── 4. DJ Tracker ─── */

  /**
   * getDJSchedule(djName) — Find where a DJ is playing/has played.
   * Case-insensitive exact match on dj field.
   * Returns array of { venueName, report } sorted by most recent.
   */
  function getDJSchedule(djName) {
    if (!djName || typeof djName !== "string") return [];
    var lowerDJ = djName.toLowerCase();
    var all = _readAll();
    var matches = all.filter(function (r) {
      return r.dj && r.dj.toLowerCase() === lowerDJ;
    });
    matches.sort(function (a, b) { return b.timestamp - a.timestamp; });
    return matches.map(function (r) {
      return { venueName: r.venueName, report: r };
    });
  }

  /**
   * getActiveDJs() — List all DJs with non-expired reports.
   * Returns array of { dj, venueName, genre, timestamp } sorted by most recent.
   */
  function getActiveDJs() {
    var all = _readAll();
    var active = _pruneExpired(all);
    var djReports = active.filter(function (r) {
      return r.dj;
    });
    djReports.sort(function (a, b) { return b.timestamp - a.timestamp; });
    return djReports.map(function (r) {
      return { dj: r.dj, venueName: r.venueName, genre: r.genre, timestamp: r.timestamp };
    });
  }

  /* ─── 5. Energy Map ─── */

  /**
   * getEnergyMap() — Get energy levels across all venues with active reports.
   * Returns array of { venueName, energy, genre, timestamp } sorted by energy descending.
   */
  function getEnergyMap() {
    var all = _readAll();
    var active = _pruneExpired(all);
    // Only include reports with energy
    var withEnergy = active.filter(function (r) {
      return r.energy !== null && r.energy !== undefined;
    });

    // Get latest report per venue
    var venueMap = {};
    withEnergy.forEach(function (r) {
      if (!venueMap[r.venueName] || r.timestamp > venueMap[r.venueName].timestamp) {
        venueMap[r.venueName] = r;
      }
    });

    var results = [];
    for (var v in venueMap) {
      var r = venueMap[v];
      results.push({ venueName: v, energy: r.energy, genre: r.genre, timestamp: r.timestamp });
    }
    results.sort(function (a, b) { return b.energy - a.energy; });
    return results;
  }

  /**
   * getHighEnergyVenues(minEnergy) — Filter venues above energy threshold.
   * minEnergy defaults to 4, must be 1-5.
   */
  function getHighEnergyVenues(minEnergy) {
    var threshold = (minEnergy !== undefined && minEnergy !== null) ? minEnergy : 4;
    if (threshold < 1 || threshold > 5) return [];
    var map = getEnergyMap();
    return map.filter(function (entry) {
      return entry.energy >= threshold;
    });
  }

  /* ─── 6. Genre Trends ─── */

  /**
   * getGenreTrends() — Aggregate genre popularity from non-expired reports.
   * Returns array of { genre, count, venues } sorted by count descending.
   */
  function getGenreTrends() {
    var all = _readAll();
    var active = _pruneExpired(all);

    var genreMap = {};
    active.forEach(function (r) {
      if (!r.genre) return;
      var g = r.genre;
      if (!genreMap[g]) {
        genreMap[g] = { count: 0, venues: {} };
      }
      genreMap[g].count++;
      genreMap[g].venues[r.venueName] = true;
    });

    var results = [];
    for (var g in genreMap) {
      results.push({
        genre: g,
        count: genreMap[g].count,
        venues: Object.keys(genreMap[g].venues)
      });
    }
    results.sort(function (a, b) { return b.count - a.count; });
    return results;
  }

  /**
   * getTopGenres(limit) — Top N genres (default 5).
   */
  function getTopGenres(limit) {
    var max = (limit !== undefined && limit !== null) ? limit : 5;
    return getGenreTrends().slice(0, max);
  }

  /* ─── 7. Music Preferences ─── */

  /**
   * saveMusicPrefs(prefs) — Save user music preferences.
   * prefs: { favoriteGenres: [], followedDJs: [], energyPreference: 1-5 }
   * Returns true on success, false on invalid.
   */
  function saveMusicPrefs(prefs) {
    if (!prefs || typeof prefs !== "object") return false;

    var favoriteGenres = Array.isArray(prefs.favoriteGenres) ? prefs.favoriteGenres : [];
    var followedDJs = Array.isArray(prefs.followedDJs) ? prefs.followedDJs : [];

    var energyPreference = null;
    if (prefs.energyPreference !== undefined && prefs.energyPreference !== null) {
      var ep = Number(prefs.energyPreference);
      if (isNaN(ep) || ep < 1 || ep > 5) return false;
      energyPreference = ep;
    }

    var data = {
      favoriteGenres: favoriteGenres,
      followedDJs: followedDJs,
      energyPreference: energyPreference
    };

    try {
      localStorage.setItem(_scopedKey(PREFS_KEY), JSON.stringify(data));
      return true;
    } catch (_) {
      return false;
    }
  }

  /**
   * getMusicPrefs() — Get saved preferences, returns default empty prefs if none.
   */
  function getMusicPrefs() {
    try {
      _migrate(PREFS_KEY);
      var raw = localStorage.getItem(_scopedKey(PREFS_KEY));
      if (!raw) return { favoriteGenres: [], followedDJs: [], energyPreference: null };
      return JSON.parse(raw);
    } catch (_) {
      return { favoriteGenres: [], followedDJs: [], energyPreference: null };
    }
  }

  /**
   * getPersonalizedVenues() — Match current active reports against user prefs.
   * Score: +3 for matching genre, +3 for matching DJ, +1 per energy closeness (max 2).
   * Returns array of { venueName, report, score } sorted by score descending.
   */
  function getPersonalizedVenues() {
    var prefs = getMusicPrefs();
    var all = _readAll();
    var active = _pruneExpired(all);
    if (active.length === 0) return [];

    // Get latest report per venue
    var venueMap = {};
    active.forEach(function (r) {
      if (!venueMap[r.venueName] || r.timestamp > venueMap[r.venueName].timestamp) {
        venueMap[r.venueName] = r;
      }
    });

    var lowerGenres = (prefs.favoriteGenres || []).map(function (g) {
      return g.toLowerCase();
    });
    var lowerDJs = (prefs.followedDJs || []).map(function (d) {
      return d.toLowerCase();
    });

    var results = [];
    for (var v in venueMap) {
      var r = venueMap[v];
      var score = 0;

      // Genre match (+3)
      if (r.genre && lowerGenres.indexOf(r.genre.toLowerCase()) !== -1) {
        score += 3;
      }

      // DJ match (+3)
      if (r.dj && lowerDJs.indexOf(r.dj.toLowerCase()) !== -1) {
        score += 3;
      }

      // Energy closeness (+1 per closeness, max 2)
      if (prefs.energyPreference !== null && prefs.energyPreference !== undefined &&
          r.energy !== null && r.energy !== undefined) {
        var diff = Math.abs(r.energy - prefs.energyPreference);
        var energyScore = Math.max(0, 2 - diff);
        score += energyScore;
      }

      results.push({ venueName: v, report: r, score: score });
    }

    results.sort(function (a, b) { return b.score - a.score; });
    return results;
  }

  /* ─── Exports ─── */

  exports.submitNowPlaying = submitNowPlaying;
  exports.getVenueMusic = getVenueMusic;
  exports.getVenueMusicHistory = getVenueMusicHistory;
  exports.findVenuesByGenre = findVenuesByGenre;
  exports.getDJSchedule = getDJSchedule;
  exports.getActiveDJs = getActiveDJs;
  exports.getEnergyMap = getEnergyMap;
  exports.getHighEnergyVenues = getHighEnergyVenues;
  exports.getGenreTrends = getGenreTrends;
  exports.getTopGenres = getTopGenres;
  exports.saveMusicPrefs = saveMusicPrefs;
  exports.getMusicPrefs = getMusicPrefs;
  exports.getPersonalizedVenues = getPersonalizedVenues;

})(typeof module !== "undefined" ? module.exports : (window.LNVMusicTracker = {}));
