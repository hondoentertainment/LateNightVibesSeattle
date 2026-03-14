/**
 * Late Night Vibes — AI Personalization Engine.
 *
 * Learns from user behavior (visits, searches, favorites, time spent) and
 * provides personalized venue recommendations, itineraries, collaborative
 * filtering, and weather-aware suggestions.
 *
 * Data persists in localStorage under `lnv_personalization`.
 *
 * UMD-style export: works in Node (tests) and in the browser
 * (<script src="lib/personalization.js"> -> window.LNVPersonalization).
 */
(function (exports) {
  "use strict";

  var STORAGE_KEY = "lnv_personalization";
  var MAX_EVENTS = 500;

  /* ─── Core dependency ─── */

  function _core() {
    if (typeof module !== "undefined") return require("./core");
    return (typeof window !== "undefined" && window.LNVCore) || null;
  }

  /* ─── City-scoped key helpers ─── */

  function _cities() {
    if (typeof module !== "undefined") return require("./cities");
    return (typeof window !== "undefined" && window.LNVCities) || null;
  }

  function _scopedKey() {
    var c = _cities();
    return c && c.getCityKey ? c.getCityKey(STORAGE_KEY) : STORAGE_KEY;
  }

  function _migrate() {
    var c = _cities();
    if (c && c.migrateKeyIfNeeded) c.migrateKeyIfNeeded(STORAGE_KEY);
  }

  /* ─── Storage helpers ─── */

  function _readAll() {
    try {
      _migrate();
      return JSON.parse(localStorage.getItem(_scopedKey()) || "[]");
    } catch (_e) {
      return [];
    }
  }

  function _writeAll(events) {
    try {
      localStorage.setItem(_scopedKey(), JSON.stringify(events));
    } catch (_e) { /* quota exceeded — silently fail */ }
  }

  function _appendEvent(event) {
    var all = _readAll();
    all.push(event);
    // FIFO pruning: keep only the most recent MAX_EVENTS
    if (all.length > MAX_EVENTS) {
      all = all.slice(all.length - MAX_EVENTS);
    }
    _writeAll(all);
    return event;
  }

  /* ─── 1. Behavior Tracking ─── */

  function trackVisit(venueName, venueData) {
    if (!venueName) return null;
    return _appendEvent({
      type: "visit",
      venue: venueName,
      data: venueData || {},
      timestamp: Date.now()
    });
  }

  function trackSearch(query) {
    if (!query) return null;
    return _appendEvent({
      type: "search",
      query: query,
      timestamp: Date.now()
    });
  }

  function trackFavorite(venueName, venueData) {
    if (!venueName) return null;
    return _appendEvent({
      type: "favorite",
      venue: venueName,
      data: venueData || {},
      timestamp: Date.now()
    });
  }

  function trackTimeSpent(venueName, durationMinutes) {
    if (!venueName) return null;
    return _appendEvent({
      type: "time_spent",
      venue: venueName,
      duration: durationMinutes || 0,
      timestamp: Date.now()
    });
  }

  function getEvents() {
    return _readAll();
  }

  function clearEvents() {
    _writeAll([]);
  }

  /* ─── 2. Preference Learning ─── */

  function buildUserProfile() {
    var core = _core();
    var events = _readAll();
    if (!events.length) {
      return {
        preferredVibes: [],
        preferredCategories: [],
        preferredAreas: [],
        preferredTimeRange: null,
        visitFrequency: "occasional"
      };
    }

    var vibeCounts = {};
    var categoryCounts = {};
    var areaCounts = {};
    var closingTimes = [];
    var visitDates = {};

    events.forEach(function (evt) {
      var data = evt.data || {};
      var weight = 1;
      if (evt.type === "favorite") weight = 3;
      else if (evt.type === "time_spent") weight = 2;
      else if (evt.type === "visit") weight = 1.5;

      // Extract vibes
      var vibeTags = data["Vibe Tags"] || "";
      if (vibeTags && core) {
        var vibes = core.normalizeValue(vibeTags).split(",")
          .map(function (t) { return core.normalizeValue(t).toLowerCase(); })
          .filter(Boolean);
        vibes.forEach(function (v) {
          vibeCounts[v] = (vibeCounts[v] || 0) + weight;
        });
      }

      // Extract category
      var cat = data["Category"] || data["category"] || "";
      if (cat) {
        var normalCat = cat.toString().trim().toLowerCase();
        if (normalCat) {
          categoryCounts[normalCat] = (categoryCounts[normalCat] || 0) + weight;
        }
      }

      // Extract area
      var area = data["Area"] || data["area"] || "";
      if (area) {
        var normalArea = area.toString().trim();
        if (normalArea) {
          areaCounts[normalArea] = (areaCounts[normalArea] || 0) + weight;
        }
      }

      // Extract closing time
      var closing = data["Typical Closing Time"] || "";
      if (closing && core) {
        var mins = core.parseTimeToMinutes(closing);
        if (mins !== null) {
          closingTimes.push(mins);
        }
      }

      // Track unique visit dates for frequency
      if (evt.type === "visit" || evt.type === "favorite") {
        var dateKey = new Date(evt.timestamp).toDateString();
        visitDates[dateKey] = true;
      }
    });

    // Rank by count
    var preferredVibes = _rankKeys(vibeCounts);
    var preferredCategories = _rankKeys(categoryCounts);
    var preferredAreas = _rankKeys(areaCounts);

    // Time range
    var preferredTimeRange = null;
    if (closingTimes.length) {
      // Normalize times: if below 360 (6 AM), treat as after midnight (add 1440)
      var normalized = closingTimes.map(function (t) {
        return t < 360 ? t + 1440 : t;
      });
      var earliest = Math.min.apply(null, normalized);
      var latest = Math.max.apply(null, normalized);
      // Convert back
      preferredTimeRange = {
        earliest: earliest >= 1440 ? earliest - 1440 : earliest,
        latest: latest >= 1440 ? latest - 1440 : latest
      };
    }

    // Visit frequency
    var uniqueDays = Object.keys(visitDates).length;
    var visitFrequency;
    if (uniqueDays >= 8) {
      visitFrequency = "frequent";
    } else if (uniqueDays >= 3) {
      visitFrequency = "regular";
    } else {
      visitFrequency = "occasional";
    }

    return {
      preferredVibes: preferredVibes,
      preferredCategories: preferredCategories,
      preferredAreas: preferredAreas,
      preferredTimeRange: preferredTimeRange,
      visitFrequency: visitFrequency
    };
  }

  function _rankKeys(counts) {
    return Object.keys(counts)
      .sort(function (a, b) { return counts[b] - counts[a]; })
      .filter(function (k) { return counts[k] > 0; });
  }

  /* ─── 3. Personalized Scoring ─── */

  function scoreVenueForUser(venue, userProfile) {
    if (!venue || !userProfile) return 0;

    var core = _core();
    var score = 0;

    // Vibe overlap (0-40 points)
    var venueVibes = [];
    if (venue["Vibe Tags"] && core) {
      venueVibes = core.normalizeValue(venue["Vibe Tags"]).split(",")
        .map(function (t) { return core.normalizeValue(t).toLowerCase(); })
        .filter(Boolean);
    }
    var prefVibes = userProfile.preferredVibes || [];
    if (prefVibes.length && venueVibes.length) {
      var vibeMatches = 0;
      venueVibes.forEach(function (v) {
        var idx = prefVibes.indexOf(v);
        if (idx !== -1) {
          // Higher rank = more weight
          vibeMatches += Math.max(1, 10 - idx);
        }
      });
      score += Math.min(40, vibeMatches * 4);
    }

    // Category match (0-25 points)
    var venueCat = (venue["Category"] || venue["category"] || "").toString().trim().toLowerCase();
    var prefCats = userProfile.preferredCategories || [];
    if (venueCat && prefCats.length) {
      var catIdx = prefCats.indexOf(venueCat);
      if (catIdx === 0) score += 25;
      else if (catIdx === 1) score += 18;
      else if (catIdx === 2) score += 12;
      else if (catIdx >= 3) score += 6;
    }

    // Area preference (0-20 points)
    var venueArea = (venue["Area"] || venue["area"] || "").toString().trim();
    var prefAreas = userProfile.preferredAreas || [];
    if (venueArea && prefAreas.length) {
      var areaIdx = prefAreas.indexOf(venueArea);
      if (areaIdx === 0) score += 20;
      else if (areaIdx === 1) score += 14;
      else if (areaIdx === 2) score += 8;
      else if (areaIdx >= 3) score += 4;
    }

    // Time compatibility (0-15 points)
    if (userProfile.preferredTimeRange && core) {
      var closingStr = venue["Typical Closing Time"] || "";
      if (closingStr) {
        var closingMins = core.parseTimeToMinutes(closingStr);
        if (closingMins !== null) {
          // Normalize for comparison
          var normClosing = closingMins < 360 ? closingMins + 1440 : closingMins;
          var normEarliest = userProfile.preferredTimeRange.earliest < 360
            ? userProfile.preferredTimeRange.earliest + 1440
            : userProfile.preferredTimeRange.earliest;
          var normLatest = userProfile.preferredTimeRange.latest < 360
            ? userProfile.preferredTimeRange.latest + 1440
            : userProfile.preferredTimeRange.latest;

          if (normClosing >= normEarliest && normClosing <= normLatest + 120) {
            score += 15;
          } else if (normClosing >= normEarliest - 60) {
            score += 8;
          }
        }
      }
    }

    return Math.min(100, Math.max(0, Math.round(score)));
  }

  /* ─── 4. Itinerary Generator ─── */

  function generateItinerary(venues, userProfile, options) {
    if (!venues || !venues.length) return [];

    var core = _core();
    var opts = options || {};
    var startTime = opts.startTime || 540; // default 9:00 PM = 21*60
    if (typeof startTime === "string" && core) {
      startTime = core.parseTimeToMinutes(startTime) || 540;
    }
    var maxVenues = opts.maxVenues || 4;
    if (maxVenues < 2) maxVenues = 2;
    if (maxVenues > 5) maxVenues = 5;
    var preferWalkable = opts.preferWalkable || false;
    var mood = (opts.mood || "").toString().toLowerCase();

    // Score and filter venues
    var scored = venues.map(function (v) {
      var s = scoreVenueForUser(v, userProfile);

      // Mood bonus
      if (mood && v["Vibe Tags"]) {
        var vibes = (v["Vibe Tags"] || "").toString().toLowerCase();
        if (vibes.indexOf(mood) !== -1) {
          s = Math.min(100, s + 15);
        }
      }

      return { venue: v, score: s };
    });

    // Filter out venues that close before start time
    scored = scored.filter(function (item) {
      if (!core) return true;
      var closing = core.parseTimeToMinutes(item.venue["Typical Closing Time"] || "");
      if (closing === null) return true;
      // Normalize: closing times before 6 AM are "after midnight"
      var normClosing = closing < 360 ? closing + 1440 : closing;
      var normStart = startTime < 360 ? startTime + 1440 : startTime;
      return normClosing > normStart;
    });

    // Sort by score descending
    scored.sort(function (a, b) { return b.score - a.score; });

    // Greedy itinerary building with variety
    var itinerary = [];
    var usedCategories = {};
    var usedAreas = {};
    var usedVibes = {};

    // First pass: pick top venue
    if (scored.length) {
      var first = scored[0];
      itinerary.push(first);
      _trackUsed(first.venue, usedCategories, usedAreas, usedVibes);
      scored.splice(0, 1);
    }

    // Subsequent passes: balance score with variety
    while (itinerary.length < maxVenues && scored.length) {
      var bestIdx = -1;
      var bestVal = -1;

      for (var i = 0; i < scored.length; i++) {
        var candidate = scored[i];
        var varietyBonus = _varietyBonus(candidate.venue, usedCategories, usedAreas, usedVibes);
        var walkBonus = 0;

        if (preferWalkable && core && itinerary.length > 0) {
          var last = itinerary[itinerary.length - 1].venue;
          if (last.lat && last.lng && candidate.venue.lat && candidate.venue.lng) {
            var dist = core.haversineMiles(last.lat, last.lng, candidate.venue.lat, candidate.venue.lng);
            if (dist <= (core.WALKABLE_MILES || 0.5)) {
              walkBonus = 10;
            }
          }
        }

        var val = candidate.score + varietyBonus + walkBonus;
        if (val > bestVal) {
          bestVal = val;
          bestIdx = i;
        }
      }

      if (bestIdx === -1) break;
      var picked = scored[bestIdx];
      itinerary.push(picked);
      _trackUsed(picked.venue, usedCategories, usedAreas, usedVibes);
      scored.splice(bestIdx, 1);
    }

    // Order by closing time (earliest closing first, so you leave before it closes)
    if (core) {
      itinerary.sort(function (a, b) {
        var aClose = core.parseTimeToMinutes(a.venue["Typical Closing Time"] || "") || 0;
        var bClose = core.parseTimeToMinutes(b.venue["Typical Closing Time"] || "") || 0;
        // Normalize
        var aNorm = aClose < 360 ? aClose + 1440 : aClose;
        var bNorm = bClose < 360 ? bClose + 1440 : bClose;
        return aNorm - bNorm;
      });
    }

    return itinerary.map(function (item) {
      return {
        venue: item.venue,
        score: item.score,
        name: item.venue.Name || item.venue.name || ""
      };
    });
  }

  function _trackUsed(venue, usedCats, usedAreas, usedVibes) {
    var cat = (venue["Category"] || venue["category"] || "").toString().trim().toLowerCase();
    if (cat) usedCats[cat] = (usedCats[cat] || 0) + 1;

    var area = (venue["Area"] || venue["area"] || "").toString().trim();
    if (area) usedAreas[area] = (usedAreas[area] || 0) + 1;

    var vibes = (venue["Vibe Tags"] || "").toString().toLowerCase().split(",");
    vibes.forEach(function (v) {
      var trimmed = v.trim();
      if (trimmed) usedVibes[trimmed] = (usedVibes[trimmed] || 0) + 1;
    });
  }

  function _varietyBonus(venue, usedCats, usedAreas, usedVibes) {
    var bonus = 0;
    var cat = (venue["Category"] || venue["category"] || "").toString().trim().toLowerCase();
    if (cat && !usedCats[cat]) bonus += 8;

    var area = (venue["Area"] || venue["area"] || "").toString().trim();
    if (area && !usedAreas[area]) bonus += 5;

    var vibes = (venue["Vibe Tags"] || "").toString().toLowerCase().split(",");
    var newVibeCount = 0;
    vibes.forEach(function (v) {
      var trimmed = v.trim();
      if (trimmed && !usedVibes[trimmed]) newVibeCount++;
    });
    bonus += newVibeCount * 2;

    return bonus;
  }

  /* ─── 5. Collaborative Filtering (simplified) ─── */

  function getSimilarUserRecommendations(userProfile, allVenues) {
    if (!userProfile || !allVenues || !allVenues.length) return [];

    // Get visited venue names from events
    var events = _readAll();
    var visitedNames = {};
    events.forEach(function (evt) {
      if (evt.venue) {
        visitedNames[evt.venue] = true;
      }
    });

    // Score all unvisited venues
    var unvisited = allVenues.filter(function (v) {
      var name = v.Name || v.name || "";
      return name && !visitedNames[name];
    });

    var scored = unvisited.map(function (v) {
      return {
        venue: v,
        score: scoreVenueForUser(v, userProfile),
        name: v.Name || v.name || ""
      };
    });

    // Sort by score descending
    scored.sort(function (a, b) { return b.score - a.score; });

    return scored;
  }

  /* ─── 6. Weather-Aware Suggestions ─── */

  function getWeatherAwareTags(conditions) {
    var mapping = {
      rainy: ["cozy", "chill", "indoor"],
      cold: ["cozy", "warm", "indoor", "chill"],
      hot: ["rooftop", "patio", "outdoor"],
      clear: ["rooftop", "patio", "outdoor", "scenic"],
      snowy: ["cozy", "warm", "indoor", "fireplace"]
    };

    var key = (conditions || "").toString().trim().toLowerCase();
    return mapping[key] || [];
  }

  /* ─── Exports ─── */

  exports.trackVisit = trackVisit;
  exports.trackSearch = trackSearch;
  exports.trackFavorite = trackFavorite;
  exports.trackTimeSpent = trackTimeSpent;
  exports.getEvents = getEvents;
  exports.clearEvents = clearEvents;
  exports.buildUserProfile = buildUserProfile;
  exports.scoreVenueForUser = scoreVenueForUser;
  exports.generateItinerary = generateItinerary;
  exports.getSimilarUserRecommendations = getSimilarUserRecommendations;
  exports.getWeatherAwareTags = getWeatherAwareTags;

})(typeof module !== "undefined" ? module.exports : (window.LNVPersonalization = {}));
