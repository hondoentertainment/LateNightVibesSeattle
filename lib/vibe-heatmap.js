/**
 * Late Night Vibes — Vibe Heatmap (real-time neighborhood heat scoring).
 *
 * Aggregates data from social-feed.js (check-ins/activity), music-tracker.js
 * (now-playing reports), and venue-pulse.js (crowd/viability scores) to compute
 * a 0-100 "heat score" per neighborhood.
 *
 * UMD-style export: works in Node (tests) and browser
 * (<script src="lib/vibe-heatmap.js"> → window.LNVVibeHeatmap).
 */
(function (exports) {
  "use strict";

  var HEAT_WINDOW_MS = 2 * 60 * 60 * 1000;  // 2 hours

  /* ─── Dependency accessors ─── */

  function _socialFeed() {
    if (typeof module !== "undefined") return require("./social-feed");
    return (typeof window !== "undefined" && window.LNVSocialFeed) || null;
  }

  function _musicTracker() {
    if (typeof module !== "undefined") return require("./music-tracker");
    return (typeof window !== "undefined" && window.LNVMusicTracker) || null;
  }

  function _venuePulse() {
    if (typeof module !== "undefined") return require("./venue-pulse");
    return (typeof window !== "undefined" && window.LNVVenuePulse) || null;
  }

  function _cities() {
    if (typeof module !== "undefined") return require("./cities");
    return (typeof window !== "undefined" && window.LNVCities) || null;
  }

  /* ─── City-scoped key helpers ─── */

  function _scopedKey(baseKey) {
    var c = _cities();
    return c && c.getCityKey ? c.getCityKey(baseKey) : baseKey;
  }

  function _migrate(baseKey) {
    var c = _cities();
    if (c && c.migrateKeyIfNeeded) c.migrateKeyIfNeeded(baseKey);
  }

  /* ─── Storage helpers (read raw localStorage for aggregation) ─── */

  function _readJSON(baseKey) {
    try {
      _migrate(baseKey);
      return JSON.parse(localStorage.getItem(_scopedKey(baseKey)) || "[]");
    } catch (_) {
      return [];
    }
  }

  /* ─── Time-decay weighting ───
   * Activity from 0 min ago  → weight 1.0
   * Activity from 30 min ago → weight ~0.75
   * Activity from 2h ago     → weight ~0.15
   * Exponential decay: weight = e^(-k * ageMinutes) where k chosen so that
   * at 120 min the weight is ~0.1.
   */
  function _timeDecayWeight(timestamp, now) {
    var ageMs = now - timestamp;
    if (ageMs < 0) ageMs = 0;
    var ageMins = ageMs / 60000;
    // k = ln(10)/120 ≈ 0.0192
    var k = 0.0192;
    return Math.exp(-k * ageMins);
  }

  /* ─── Venue→Neighborhood mapping ───
   * Reads the CSV venue data to map venue names to their Area/neighborhood.
   * Falls back to venue data loaded into window._lnvData (set by app.js).
   */
  function _getVenueMap() {
    var map = {};
    // Try browser-loaded venue data (window in browser, globalThis in Node tests)
    var g = typeof window !== "undefined" ? window
          : typeof globalThis !== "undefined" ? globalThis : null;
    if (g && g._lnvData && Array.isArray(g._lnvData)) {
      g._lnvData.forEach(function (v) {
        if (v.Name && v.Area) {
          map[v.Name] = v.Area;
        }
      });
    }
    return map;
  }

  /* ─── Internal: cached heat data ─── */
  var _cachedHeatData = null;
  var _cacheTimestamp = 0;
  var CACHE_TTL_MS = 10000; // 10 seconds

  /**
   * _computeHeatData() — Core aggregation logic.
   * Returns { neighborhoods: { [name]: { score, venueCount, topVibe, trend, venues } } }
   */
  function _computeHeatData() {
    var now = Date.now();
    var cutoff = now - HEAT_WINDOW_MS;
    var venueMap = _getVenueMap();

    // ─── 1. Aggregate social feed check-ins ───
    var socialFeed = _socialFeed();
    var posts = [];
    if (socialFeed && socialFeed.getFeed) {
      posts = socialFeed.getFeed({ limit: 500 });
    }

    // Per-venue social heat
    var venueSocialHeat = {};
    for (var i = 0; i < posts.length; i++) {
      var p = posts[i];
      if (!p.venueName || !p.timestamp || p.timestamp < cutoff) continue;
      var weight = _timeDecayWeight(p.timestamp, now);
      if (!venueSocialHeat[p.venueName]) {
        venueSocialHeat[p.venueName] = 0;
      }
      // Each post contributes its weight; likes add extra
      venueSocialHeat[p.venueName] += weight * (1 + (p.likes ? p.likes.length * 0.3 : 0));
    }

    // ─── 2. Aggregate music tracker data ───
    var musicTracker = _musicTracker();
    var venueMusicHeat = {};
    var venueGenre = {};
    if (musicTracker && musicTracker.getEnergyMap) {
      var energyMap = musicTracker.getEnergyMap();
      for (var j = 0; j < energyMap.length; j++) {
        var em = energyMap[j];
        venueMusicHeat[em.venueName] = (em.energy || 0) / 5; // normalize 0-1
        if (em.genre) {
          venueGenre[em.venueName] = em.genre;
        }
      }
    }

    // ─── 3. Aggregate venue pulse data ───
    var venuePulse = _venuePulse();
    var venuePulseHeat = {};
    var venuePulseMoods = {};

    // Collect all unique venue names from all sources
    var allVenueNames = {};
    for (var vn in venueSocialHeat) allVenueNames[vn] = true;
    for (var vn2 in venueMusicHeat) allVenueNames[vn2] = true;
    // Also include venues from venueMap
    for (var vn3 in venueMap) allVenueNames[vn3] = true;

    if (venuePulse && venuePulse.getVenuePulse) {
      for (var vName in allVenueNames) {
        var pulse = venuePulse.getVenuePulse(vName);
        if (pulse) {
          // Convert crowd level to a 0-1 score
          var crowdScores = {
            "empty": 0.1, "sparse": 0.3, "moderate": 0.5, "busy": 0.75, "packed": 1.0
          };
          venuePulseHeat[vName] = crowdScores[pulse.dominantCrowdLevel] || 0.5;
          if (pulse.topMoods && pulse.topMoods.length > 0) {
            venuePulseMoods[vName] = pulse.topMoods;
          }
        }
      }
    }

    // ─── 4. Group by neighborhood and compute heat scores ───
    var neighborhoods = {};

    function ensureHood(name) {
      if (!neighborhoods[name]) {
        neighborhoods[name] = {
          name: name,
          rawScore: 0,
          venueCount: 0,
          venues: [],
          vibeMap: {},
          genreMap: {}
        };
      }
      return neighborhoods[name];
    }

    // Process all venues that have any activity
    var activeVenues = {};
    for (var v1 in venueSocialHeat) activeVenues[v1] = true;
    for (var v2 in venueMusicHeat) activeVenues[v2] = true;
    for (var v3 in venuePulseHeat) activeVenues[v3] = true;

    for (var venue in activeVenues) {
      var area = venueMap[venue];
      if (!area) continue; // Skip if we can't map to a neighborhood

      var hood = ensureHood(area);
      var social = venueSocialHeat[venue] || 0;
      var music = venueMusicHeat[venue] || 0;
      var pulse = venuePulseHeat[venue] || 0;

      // Weighted combination per venue:
      // social check-ins (40%), music energy (30%), crowd pulse (30%)
      var venueHeat = social * 0.4 + music * 0.3 + pulse * 0.3;

      hood.rawScore += venueHeat;
      hood.venueCount++;
      hood.venues.push({
        name: venue,
        heat: venueHeat,
        social: social,
        music: music,
        pulse: pulse
      });

      // Collect vibes
      var moods = venuePulseMoods[venue] || [];
      for (var mi = 0; mi < moods.length; mi++) {
        hood.vibeMap[moods[mi]] = (hood.vibeMap[moods[mi]] || 0) + 1;
      }

      // Collect genres as vibes too
      var genre = venueGenre[venue];
      if (genre) {
        hood.genreMap[genre] = (hood.genreMap[genre] || 0) + 1;
      }
    }

    // ─── 5. Normalize scores to 0-100 ───
    var maxRaw = 0;
    for (var h in neighborhoods) {
      if (neighborhoods[h].rawScore > maxRaw) {
        maxRaw = neighborhoods[h].rawScore;
      }
    }

    var result = {};
    for (var hName in neighborhoods) {
      var hd = neighborhoods[hName];
      // Normalize: if maxRaw is 0, score is 0
      var score = maxRaw > 0 ? Math.round((hd.rawScore / maxRaw) * 100) : 0;
      if (score > 100) score = 100;

      // Determine top vibe (combine moods + genres)
      var combinedVibes = {};
      for (var mk in hd.vibeMap) combinedVibes[mk] = hd.vibeMap[mk];
      for (var gk in hd.genreMap) {
        combinedVibes[gk] = (combinedVibes[gk] || 0) + hd.genreMap[gk];
      }
      var topVibe = null;
      var topVibeCount = 0;
      for (var vk in combinedVibes) {
        if (combinedVibes[vk] > topVibeCount) {
          topVibeCount = combinedVibes[vk];
          topVibe = vk;
        }
      }

      // Sort venues by heat descending
      hd.venues.sort(function (a, b) { return b.heat - a.heat; });

      result[hName] = {
        name: hName,
        score: score,
        venueCount: hd.venueCount,
        topVibe: topVibe || "nightlife",
        trend: _computeTrend(hName),
        venues: hd.venues
      };
    }

    return result;
  }

  /**
   * _computeTrend(neighborhood) — Compare recent 30-min activity vs prior 30-90 min.
   * Returns one of: "up", "rising", "steady", "cooling", "down"
   */
  function _computeTrend(neighborhood) {
    var now = Date.now();
    var socialFeed = _socialFeed();
    if (!socialFeed || !socialFeed.getFeed) return "steady";

    // We need to get the venueMap to check which venues are in this neighborhood
    var venueMap = _getVenueMap();
    var hoodVenues = {};
    for (var vn in venueMap) {
      if (venueMap[vn] === neighborhood) {
        hoodVenues[vn] = true;
      }
    }

    var posts = socialFeed.getFeed({ limit: 500 });
    var recentCount = 0;  // last 30 min
    var priorCount = 0;   // 30-90 min ago

    for (var i = 0; i < posts.length; i++) {
      var p = posts[i];
      if (!p.venueName || !hoodVenues[p.venueName]) continue;
      var age = now - p.timestamp;
      if (age <= 30 * 60 * 1000) {
        recentCount++;
      } else if (age <= 90 * 60 * 1000) {
        priorCount++;
      }
    }

    // Normalize prior to same time window (30 min vs 60 min)
    var priorNormalized = priorCount / 2;

    if (recentCount === 0 && priorNormalized === 0) return "steady";
    if (priorNormalized === 0 && recentCount > 0) return "up";
    if (recentCount === 0 && priorNormalized > 0) return "down";

    var ratio = recentCount / priorNormalized;
    if (ratio >= 2) return "up";
    if (ratio >= 1.3) return "rising";
    if (ratio >= 0.7) return "steady";
    if (ratio >= 0.4) return "cooling";
    return "down";
  }

  /* ─── Public API ─── */

  /**
   * refreshHeatData() — Force recalculation of heat data (clears cache).
   */
  function refreshHeatData() {
    _cachedHeatData = _computeHeatData();
    _cacheTimestamp = Date.now();
    return _cachedHeatData;
  }

  function _getHeatData() {
    var now = Date.now();
    if (_cachedHeatData && (now - _cacheTimestamp) < CACHE_TTL_MS) {
      return _cachedHeatData;
    }
    return refreshHeatData();
  }

  /**
   * getNeighborhoodHeat() — Returns all neighborhoods with heat data,
   * sorted by score descending.
   */
  function getNeighborhoodHeat() {
    var data = _getHeatData();
    var results = [];
    for (var name in data) {
      results.push(data[name]);
    }
    results.sort(function (a, b) { return b.score - a.score; });
    return results;
  }

  /**
   * getHeatScore(neighborhood) — Returns heat score (0-100) for a specific
   * neighborhood, or 0 if not found / no activity.
   */
  function getHeatScore(neighborhood) {
    if (!neighborhood) return 0;
    var data = _getHeatData();
    return data[neighborhood] ? data[neighborhood].score : 0;
  }

  /**
   * getHottestNeighborhoods(limit) — Returns top N hottest neighborhoods.
   * Default limit is 5.
   */
  function getHottestNeighborhoods(limit) {
    var max = (limit !== undefined && limit !== null) ? limit : 5;
    return getNeighborhoodHeat().slice(0, max);
  }

  /**
   * getVenueHeatContribution(venueName) — Returns the heat contribution
   * details for a specific venue, or null if not found.
   * Returns: { neighborhood, heat, social, music, pulse }
   */
  function getVenueHeatContribution(venueName) {
    if (!venueName) return null;
    var data = _getHeatData();
    for (var hName in data) {
      var venues = data[hName].venues;
      for (var i = 0; i < venues.length; i++) {
        if (venues[i].name === venueName) {
          return {
            neighborhood: hName,
            heat: venues[i].heat,
            social: venues[i].social,
            music: venues[i].music,
            pulse: venues[i].pulse
          };
        }
      }
    }
    return null;
  }

  /* ─── Exports ─── */

  exports.getNeighborhoodHeat = getNeighborhoodHeat;
  exports.getHeatScore = getHeatScore;
  exports.getHottestNeighborhoods = getHottestNeighborhoods;
  exports.getVenueHeatContribution = getVenueHeatContribution;
  exports.refreshHeatData = refreshHeatData;

  // Expose internals for testing
  exports._timeDecayWeight = _timeDecayWeight;
  exports._computeHeatData = _computeHeatData;

})(typeof module !== "undefined" ? module.exports : (window.LNVVibeHeatmap = {}));
