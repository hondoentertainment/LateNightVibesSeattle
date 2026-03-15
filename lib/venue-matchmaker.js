/**
 * Late Night Vibes — Venue Matchmaker (swipe-based venue discovery with learning).
 *
 * Tinder-style venue discovery: swipe right to like, left to skip,
 * super-like for strong signals. Learns user preferences over time
 * and provides smart recommendations, compatibility scoring, and
 * curated collections.
 *
 * UMD-style export: works in Node (tests) and browser
 * (<script src="lib/venue-matchmaker.js"> → window.LNVVenueMatchmaker).
 */
(function (exports) {
  "use strict";

  var STORAGE_KEY = "lnv_venue_matchmaker";

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

  function _readData() {
    try {
      _migrate();
      var raw = localStorage.getItem(_scopedKey());
      return JSON.parse(raw || "null") || _defaultData();
    } catch (_) {
      return _defaultData();
    }
  }

  function _writeData(data) {
    try {
      localStorage.setItem(_scopedKey(), JSON.stringify(data));
    } catch (_) { /* quota exceeded — silently fail */ }
  }

  function _defaultData() {
    return {
      swipeHistory: [],
      collections: []
    };
  }

  /* ─── In-memory queue ─── */

  var _queue = [];

  /* ─── Shuffle (Fisher-Yates) ─── */

  function _shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  /* ─── Simple seeded random (for daily picks) ─── */

  function _seededRandom(seed) {
    var x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  function _dateToSeed() {
    var d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }

  /* ═══════════════════════════════════════════
   * 1. Swipe Queue
   * ═══════════════════════════════════════════ */

  function loadQueue(venues) {
    if (!Array.isArray(venues)) return 0;
    var data = _readData();
    var swipedNames = {};
    for (var i = 0; i < data.swipeHistory.length; i++) {
      swipedNames[data.swipeHistory[i].venueName] = true;
    }
    var filtered = venues.filter(function (v) {
      return v && v.name && !swipedNames[v.name];
    });
    _queue = _shuffle(filtered);
    return _queue.length;
  }

  function getNextVenue() {
    if (_queue.length === 0) return null;
    return _queue[0];
  }

  function getQueueSize() {
    return _queue.length;
  }

  /* ═══════════════════════════════════════════
   * 2. Swipe Actions
   * ═══════════════════════════════════════════ */

  function _recordSwipe(venueName, action) {
    if (!venueName || typeof venueName !== "string") return false;
    var data = _readData();
    // Remove from queue
    _queue = _queue.filter(function (v) { return v.name !== venueName; });
    var record = {
      venueName: venueName,
      action: action,
      timestamp: Date.now()
    };
    data.swipeHistory.push(record);
    _writeData(data);
    return true;
  }

  function swipeRight(venueName) {
    return _recordSwipe(venueName, "like");
  }

  function swipeLeft(venueName) {
    return _recordSwipe(venueName, "skip");
  }

  function superLike(venueName) {
    return _recordSwipe(venueName, "superlike");
  }

  function getSwipeHistory(action) {
    var data = _readData();
    var history = data.swipeHistory.slice();
    if (action) {
      history = history.filter(function (s) { return s.action === action; });
    }
    history.sort(function (a, b) { return b.timestamp - a.timestamp; });
    return history;
  }

  /* ═══════════════════════════════════════════
   * 3. Preference Learning
   * ═══════════════════════════════════════════ */

  function _findVenueInArray(venues, name) {
    for (var i = 0; i < venues.length; i++) {
      if (venues[i].name === name) return venues[i];
    }
    return null;
  }

  function _getVenuePool() {
    // Combine queue with any previously loaded venues
    return _queue.slice();
  }

  function getPreferenceProfile(allVenues) {
    var data = _readData();
    var venues = allVenues || [];
    var categoryCounts = {};
    var vibeCounts = {};
    var neighborhoodCounts = {};
    var priceLevels = [];
    var skipCategoryCounts = {};
    var likeCategoryCounts = {};

    for (var i = 0; i < data.swipeHistory.length; i++) {
      var swipe = data.swipeHistory[i];
      var venue = _findVenueInArray(venues, swipe.venueName);
      if (!venue) continue;

      var weight = swipe.action === "superlike" ? 3 : 1;

      if (swipe.action === "like" || swipe.action === "superlike") {
        // Category
        if (venue.category) {
          categoryCounts[venue.category] = (categoryCounts[venue.category] || 0) + weight;
          likeCategoryCounts[venue.category] = (likeCategoryCounts[venue.category] || 0) + 1;
        }
        // Vibes
        if (Array.isArray(venue.vibes)) {
          for (var v = 0; v < venue.vibes.length; v++) {
            vibeCounts[venue.vibes[v]] = (vibeCounts[venue.vibes[v]] || 0) + weight;
          }
        }
        // Neighborhood
        if (venue.neighborhood) {
          neighborhoodCounts[venue.neighborhood] = (neighborhoodCounts[venue.neighborhood] || 0) + weight;
        }
        // Price
        if (venue.priceLevel) {
          for (var p = 0; p < weight; p++) {
            priceLevels.push(venue.priceLevel);
          }
        }
      } else if (swipe.action === "skip") {
        if (venue.category) {
          skipCategoryCounts[venue.category] = (skipCategoryCounts[venue.category] || 0) + 1;
        }
      }
    }

    // Sort categories by count
    var topCategories = _sortedEntries(categoryCounts);
    var topVibes = _sortedEntries(vibeCounts);
    var topNeighborhoods = _sortedEntries(neighborhoodCounts);

    // Average price level
    var avgPriceLevel = 0;
    if (priceLevels.length > 0) {
      var sum = 0;
      for (var s = 0; s < priceLevels.length; s++) sum += priceLevels[s];
      avgPriceLevel = sum / priceLevels.length;
    }

    // Avoided categories: >2 skips and 0 likes
    var avoidedCategories = [];
    for (var cat in skipCategoryCounts) {
      if (skipCategoryCounts[cat] > 2 && !likeCategoryCounts[cat]) {
        avoidedCategories.push(cat);
      }
    }

    return {
      topCategories: topCategories,
      topVibes: topVibes,
      topNeighborhoods: topNeighborhoods,
      avgPriceLevel: avgPriceLevel,
      avoidedCategories: avoidedCategories
    };
  }

  function _sortedEntries(obj) {
    var entries = [];
    for (var key in obj) {
      entries.push({ name: key, count: obj[key] });
    }
    entries.sort(function (a, b) { return b.count - a.count; });
    return entries;
  }

  function getCompatibilityScore(venue, allVenues) {
    if (!venue) return 0;
    var profile = getPreferenceProfile(allVenues);
    var score = 0;

    // +30 for matching top category
    if (profile.topCategories.length > 0 && venue.category === profile.topCategories[0].name) {
      score += 30;
    }

    // +25 for matching any top vibe
    if (Array.isArray(venue.vibes) && profile.topVibes.length > 0) {
      var topVibeNames = {};
      for (var tv = 0; tv < profile.topVibes.length; tv++) {
        topVibeNames[profile.topVibes[tv].name] = true;
      }
      for (var vi = 0; vi < venue.vibes.length; vi++) {
        if (topVibeNames[venue.vibes[vi]]) {
          score += 25;
          break;
        }
      }
    }

    // +20 for matching top neighborhood
    if (profile.topNeighborhoods.length > 0 && venue.neighborhood === profile.topNeighborhoods[0].name) {
      score += 20;
    }

    // +25 for price within ±1 of avg
    if (profile.avgPriceLevel > 0 && venue.priceLevel) {
      if (Math.abs(venue.priceLevel - profile.avgPriceLevel) <= 1) {
        score += 25;
      }
    }

    // -20 for avoided category
    if (profile.avoidedCategories.indexOf(venue.category) !== -1) {
      score -= 20;
    }

    // Clamp 0-100
    if (score < 0) score = 0;
    if (score > 100) score = 100;

    return score;
  }

  /* ═══════════════════════════════════════════
   * 4. Smart Recommendations
   * ═══════════════════════════════════════════ */

  function getRecommendations(venues, limit) {
    if (!Array.isArray(venues)) return [];
    var n = limit || 5;
    var data = _readData();
    var swipedNames = {};
    for (var i = 0; i < data.swipeHistory.length; i++) {
      swipedNames[data.swipeHistory[i].venueName] = true;
    }
    var unswiped = venues.filter(function (v) {
      return v && v.name && !swipedNames[v.name];
    });
    var scored = unswiped.map(function (v) {
      return { venue: v, score: getCompatibilityScore(v, venues) };
    });
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored.slice(0, n);
  }

  function getDailyPicks(venues, count) {
    if (!Array.isArray(venues)) return [];
    var n = count || 3;
    var data = _readData();
    var swipedNames = {};
    for (var i = 0; i < data.swipeHistory.length; i++) {
      swipedNames[data.swipeHistory[i].venueName] = true;
    }
    var unswiped = venues.filter(function (v) {
      return v && v.name && !swipedNames[v.name];
    });
    // Score venues
    var scored = unswiped.map(function (v) {
      return { venue: v, score: getCompatibilityScore(v, venues) };
    });
    // Sort by score descending first
    scored.sort(function (a, b) { return b.score - a.score; });

    // Take top candidates (at least 2x count for variety)
    var pool = scored.slice(0, Math.max(n * 3, scored.length));

    // Use seeded shuffle for deterministic daily selection
    var seed = _dateToSeed();
    var picks = [];
    var poolCopy = pool.slice();
    for (var i2 = 0; i2 < n && poolCopy.length > 0; i2++) {
      var idx = Math.floor(_seededRandom(seed + i2) * poolCopy.length);
      picks.push(poolCopy[idx].venue);
      poolCopy.splice(idx, 1);
    }
    return picks;
  }

  /* ═══════════════════════════════════════════
   * 5. Match Stats
   * ═══════════════════════════════════════════ */

  function getMatchStats(allVenues) {
    var data = _readData();
    var history = data.swipeHistory;
    var likes = 0;
    var skips = 0;
    var superlikes = 0;
    var categoryCounts = {};
    var streak = 0;
    var maxStreak = 0;

    // Sort by timestamp ascending for streak calculation
    var sorted = history.slice().sort(function (a, b) { return a.timestamp - b.timestamp; });

    for (var i = 0; i < sorted.length; i++) {
      var s = sorted[i];
      if (s.action === "like") {
        likes++;
        streak++;
        if (streak > maxStreak) maxStreak = streak;
      } else if (s.action === "superlike") {
        superlikes++;
        streak++;
        if (streak > maxStreak) maxStreak = streak;
      } else if (s.action === "skip") {
        skips++;
        streak = 0;
      }
      // Count categories for topCategory
      var venues = allVenues || [];
      var venue = _findVenueInArray(venues, s.venueName);
      if (venue && venue.category && (s.action === "like" || s.action === "superlike")) {
        categoryCounts[venue.category] = (categoryCounts[venue.category] || 0) + 1;
      }
    }

    var totalSwipes = likes + skips + superlikes;
    var likeRate = totalSwipes > 0 ? (likes + superlikes) / totalSwipes : 0;

    // Top category
    var topCategory = null;
    var topCount = 0;
    for (var cat in categoryCounts) {
      if (categoryCounts[cat] > topCount) {
        topCount = categoryCounts[cat];
        topCategory = cat;
      }
    }

    return {
      totalSwipes: totalSwipes,
      likes: likes,
      skips: skips,
      superlikes: superlikes,
      likeRate: likeRate,
      topCategory: topCategory,
      streak: maxStreak
    };
  }

  function getVenueDecision(venueName) {
    if (!venueName) return null;
    var data = _readData();
    for (var i = data.swipeHistory.length - 1; i >= 0; i--) {
      if (data.swipeHistory[i].venueName === venueName) {
        return data.swipeHistory[i];
      }
    }
    return null;
  }

  /* ═══════════════════════════════════════════
   * 6. Undo & Reset
   * ═══════════════════════════════════════════ */

  function undoLastSwipe() {
    var data = _readData();
    if (data.swipeHistory.length === 0) return null;
    var last = data.swipeHistory.pop();
    _writeData(data);
    // Re-add a placeholder venue to the front of the queue
    _queue.unshift({ name: last.venueName });
    return last;
  }

  function resetPreferences() {
    var data = _defaultData();
    _writeData(data);
    _queue = [];
    return true;
  }

  /* ═══════════════════════════════════════════
   * 7. Collections
   * ═══════════════════════════════════════════ */

  function _generateId() {
    return "col_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
  }

  function createCollection(name) {
    if (!name || typeof name !== "string") return null;
    var data = _readData();
    var collection = {
      id: _generateId(),
      name: name,
      venues: [],
      createdAt: Date.now()
    };
    data.collections.push(collection);
    _writeData(data);
    return collection;
  }

  function addToCollection(collectionId, venueName) {
    if (!collectionId || !venueName) return false;
    var data = _readData();
    // Check venue is liked or superliked
    var isLiked = false;
    for (var i = 0; i < data.swipeHistory.length; i++) {
      if (data.swipeHistory[i].venueName === venueName &&
          (data.swipeHistory[i].action === "like" || data.swipeHistory[i].action === "superlike")) {
        isLiked = true;
        break;
      }
    }
    if (!isLiked) return false;

    // Find collection
    for (var c = 0; c < data.collections.length; c++) {
      if (data.collections[c].id === collectionId) {
        // Check not already added
        if (data.collections[c].venues.indexOf(venueName) === -1) {
          data.collections[c].venues.push(venueName);
        }
        _writeData(data);
        return true;
      }
    }
    return false;
  }

  function getCollection(collectionId) {
    if (!collectionId) return null;
    var data = _readData();
    for (var i = 0; i < data.collections.length; i++) {
      if (data.collections[i].id === collectionId) {
        return data.collections[i];
      }
    }
    return null;
  }

  function listCollections() {
    var data = _readData();
    return data.collections.slice();
  }

  function removeFromCollection(collectionId, venueName) {
    if (!collectionId || !venueName) return false;
    var data = _readData();
    for (var i = 0; i < data.collections.length; i++) {
      if (data.collections[i].id === collectionId) {
        var idx = data.collections[i].venues.indexOf(venueName);
        if (idx !== -1) {
          data.collections[i].venues.splice(idx, 1);
          _writeData(data);
          return true;
        }
        return false;
      }
    }
    return false;
  }

  /* ─── Exports ─── */

  exports.loadQueue = loadQueue;
  exports.getNextVenue = getNextVenue;
  exports.getQueueSize = getQueueSize;
  exports.swipeRight = swipeRight;
  exports.swipeLeft = swipeLeft;
  exports.superLike = superLike;
  exports.getSwipeHistory = getSwipeHistory;
  exports.getPreferenceProfile = getPreferenceProfile;
  exports.getCompatibilityScore = getCompatibilityScore;
  exports.getRecommendations = getRecommendations;
  exports.getDailyPicks = getDailyPicks;
  exports.getMatchStats = getMatchStats;
  exports.getVenueDecision = getVenueDecision;
  exports.undoLastSwipe = undoLastSwipe;
  exports.resetPreferences = resetPreferences;
  exports.createCollection = createCollection;
  exports.addToCollection = addToCollection;
  exports.getCollection = getCollection;
  exports.listCollections = listCollections;
  exports.removeFromCollection = removeFromCollection;

})(typeof module !== "undefined" ? module.exports : (window.LNVVenueMatchmaker = {}));
