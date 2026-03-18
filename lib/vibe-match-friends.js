/**
 * Late Night Vibes — Vibe Match with Friends.
 *
 * Compares vibe preferences and crawl history between two or more users
 * to compute compatibility scores, identify conflicts, and suggest
 * compromise venues.
 *
 * Each user profile shape:
 *   { vibePreferences: string[], visitedVenues: string[],
 *     favoriteCategories: string[], preferredNeighborhoods: string[] }
 *
 * UMD-style export: works in Node (tests) and in the browser
 * (<script src="lib/vibe-match-friends.js"> -> window.LNVVibeMatchFriends).
 */
(function (exports) {
  "use strict";

  /* ─── Helpers ─── */

  function _norm(s) {
    return (s || "").toString().trim().toLowerCase();
  }

  function _toSet(arr) {
    var set = {};
    if (!Array.isArray(arr)) return set;
    for (var i = 0; i < arr.length; i++) {
      var v = _norm(arr[i]);
      if (v) set[v] = true;
    }
    return set;
  }

  function _keys(obj) {
    var out = [];
    for (var k in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) out.push(k);
    }
    return out;
  }

  function _intersect(setA, setB) {
    var result = [];
    var keysA = _keys(setA);
    for (var i = 0; i < keysA.length; i++) {
      if (setB[keysA[i]]) result.push(keysA[i]);
    }
    return result;
  }

  function _union(setA, setB) {
    var merged = {};
    var k;
    for (k in setA) {
      if (Object.prototype.hasOwnProperty.call(setA, k)) merged[k] = true;
    }
    for (k in setB) {
      if (Object.prototype.hasOwnProperty.call(setB, k)) merged[k] = true;
    }
    return merged;
  }

  function _difference(setA, setB) {
    var result = [];
    var keysA = _keys(setA);
    for (var i = 0; i < keysA.length; i++) {
      if (!setB[keysA[i]]) result.push(keysA[i]);
    }
    return result;
  }

  function _jaccardSimilarity(arrA, arrB) {
    var setA = _toSet(arrA);
    var setB = _toSet(arrB);
    var inter = _intersect(setA, setB);
    var uni = _keys(_union(setA, setB));
    if (uni.length === 0) return 0;
    return inter.length / uni.length;
  }

  function _safeProfile(profile) {
    if (!profile || typeof profile !== "object") {
      return {
        vibePreferences: [],
        visitedVenues: [],
        favoriteCategories: [],
        preferredNeighborhoods: []
      };
    }
    return {
      vibePreferences: Array.isArray(profile.vibePreferences) ? profile.vibePreferences : [],
      visitedVenues: Array.isArray(profile.visitedVenues) ? profile.visitedVenues : [],
      favoriteCategories: Array.isArray(profile.favoriteCategories) ? profile.favoriteCategories : [],
      preferredNeighborhoods: Array.isArray(profile.preferredNeighborhoods) ? profile.preferredNeighborhoods : []
    };
  }

  /* ─── 1. calculateCompatibility ─── */

  /**
   * Compute a 0-100 compatibility score between two user profiles.
   * Weights: vibes 35%, visited venues 25%, categories 25%, neighborhoods 15%.
   */
  function calculateCompatibility(profileA, profileB) {
    var a = _safeProfile(profileA);
    var b = _safeProfile(profileB);

    var vibeScore = _jaccardSimilarity(a.vibePreferences, b.vibePreferences);
    var venueScore = _jaccardSimilarity(a.visitedVenues, b.visitedVenues);
    var categoryScore = _jaccardSimilarity(a.favoriteCategories, b.favoriteCategories);
    var neighborhoodScore = _jaccardSimilarity(a.preferredNeighborhoods, b.preferredNeighborhoods);

    var raw = vibeScore * 35 + venueScore * 25 + categoryScore * 25 + neighborhoodScore * 15;
    return Math.min(100, Math.max(0, Math.round(raw)));
  }

  /* ─── 2. getSharedVibes ─── */

  /**
   * Return an array of vibe tags shared across ALL provided profiles.
   * profiles: array of user profile objects.
   */
  function getSharedVibes(profiles) {
    if (!Array.isArray(profiles) || profiles.length === 0) return [];
    var safe = profiles.map(_safeProfile);

    // Start with the first profile's vibes as candidates
    var shared = _toSet(safe[0].vibePreferences);

    for (var i = 1; i < safe.length; i++) {
      var current = _toSet(safe[i].vibePreferences);
      var inter = _intersect(shared, current);
      shared = _toSet(inter);
    }

    return _keys(shared).sort();
  }

  /* ─── 3. getConflictingVibes ─── */

  /**
   * Identify vibe tags that appear in one profile but not in others.
   * Returns array of { vibe, presentIn, missingIn } objects.
   * For two profiles, conflicting = vibes unique to one side.
   */
  function getConflictingVibes(profiles) {
    if (!Array.isArray(profiles) || profiles.length < 2) return [];
    var safe = profiles.map(_safeProfile);

    // Collect all vibes and which profile indices have them
    var vibeOwners = {};
    for (var i = 0; i < safe.length; i++) {
      var vibes = _toSet(safe[i].vibePreferences);
      var keys = _keys(vibes);
      for (var j = 0; j < keys.length; j++) {
        if (!vibeOwners[keys[j]]) vibeOwners[keys[j]] = [];
        vibeOwners[keys[j]].push(i);
      }
    }

    var conflicts = [];
    var allVibes = _keys(vibeOwners);
    for (var v = 0; v < allVibes.length; v++) {
      var vibe = allVibes[v];
      var presentIn = vibeOwners[vibe];
      // Conflict = not present in every profile
      if (presentIn.length < safe.length) {
        var missingIn = [];
        for (var m = 0; m < safe.length; m++) {
          if (presentIn.indexOf(m) === -1) missingIn.push(m);
        }
        conflicts.push({
          vibe: vibe,
          presentIn: presentIn,
          missingIn: missingIn
        });
      }
    }

    return conflicts.sort(function (a, b) {
      return a.vibe < b.vibe ? -1 : a.vibe > b.vibe ? 1 : 0;
    });
  }

  /* ─── 4. suggestCompromiseVenues ─── */

  /**
   * Suggest venues that bridge different preferences.
   * Ranks venues by how well they satisfy all profiles.
   *
   * venueList: array of venue objects with properties:
   *   Name, Category, Area, "Vibe Tags" (comma-separated)
   *
   * Returns top venues sorted by compromise score descending.
   */
  function suggestCompromiseVenues(profiles, venueList) {
    if (!Array.isArray(profiles) || profiles.length === 0) return [];
    if (!Array.isArray(venueList) || venueList.length === 0) return [];

    var safe = profiles.map(_safeProfile);

    var scored = [];
    for (var v = 0; v < venueList.length; v++) {
      var venue = venueList[v];
      var venueName = _norm(venue.Name || venue.name || "");
      var venueCategory = _norm(venue.Category || venue.category || "");
      var venueArea = _norm(venue.Area || venue.area || venue.neighborhood || "");
      var venueVibes = _parseVibeTags(venue);

      // Score: how many profiles does this venue satisfy?
      var totalScore = 0;
      var profilesServed = 0;

      for (var p = 0; p < safe.length; p++) {
        var prof = safe[p];
        var score = 0;

        // Vibe overlap
        var profVibes = _toSet(prof.vibePreferences);
        var venueVibeSet = _toSet(venueVibes);
        var vibeInter = _intersect(profVibes, venueVibeSet);
        if (vibeInter.length > 0) score += vibeInter.length * 10;

        // Category match
        var profCats = _toSet(prof.favoriteCategories);
        if (profCats[venueCategory]) score += 15;

        // Neighborhood match
        var profHoods = _toSet(prof.preferredNeighborhoods);
        if (profHoods[venueArea]) score += 10;

        // Already visited (familiarity bonus)
        var profVenues = _toSet(prof.visitedVenues);
        if (profVenues[venueName]) score += 5;

        if (score > 0) profilesServed++;
        totalScore += score;
      }

      // Bonus for satisfying more profiles (breadth)
      var breadthBonus = profilesServed === safe.length ? 20 : (profilesServed / safe.length) * 10;

      scored.push({
        venue: venue,
        score: totalScore + breadthBonus,
        profilesServed: profilesServed
      });
    }

    // Sort by score descending, then by profilesServed descending
    scored.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return b.profilesServed - a.profilesServed;
    });

    return scored.slice(0, 10);
  }

  /* ─── 5. createGroupVibeProfile ─── */

  /**
   * Merge multiple user profiles into a single "group" profile.
   * Vibes/categories/neighborhoods that appear in more profiles rank higher.
   */
  function createGroupVibeProfile(profiles) {
    if (!Array.isArray(profiles) || profiles.length === 0) {
      return {
        vibePreferences: [],
        visitedVenues: [],
        favoriteCategories: [],
        preferredNeighborhoods: []
      };
    }
    var safe = profiles.map(_safeProfile);

    var vibeCounts = {};
    var catCounts = {};
    var hoodCounts = {};
    var allVenues = {};

    for (var i = 0; i < safe.length; i++) {
      _countItems(safe[i].vibePreferences, vibeCounts);
      _countItems(safe[i].favoriteCategories, catCounts);
      _countItems(safe[i].preferredNeighborhoods, hoodCounts);
      // Union of all visited venues
      var v = safe[i].visitedVenues;
      for (var j = 0; j < v.length; j++) {
        var name = _norm(v[j]);
        if (name) allVenues[name] = true;
      }
    }

    return {
      vibePreferences: _rankByCounts(vibeCounts),
      visitedVenues: _keys(allVenues).sort(),
      favoriteCategories: _rankByCounts(catCounts),
      preferredNeighborhoods: _rankByCounts(hoodCounts)
    };
  }

  function _countItems(arr, counts) {
    if (!Array.isArray(arr)) return;
    for (var i = 0; i < arr.length; i++) {
      var k = _norm(arr[i]);
      if (k) counts[k] = (counts[k] || 0) + 1;
    }
  }

  function _rankByCounts(counts) {
    var entries = [];
    for (var k in counts) {
      if (Object.prototype.hasOwnProperty.call(counts, k)) {
        entries.push({ name: k, count: counts[k] });
      }
    }
    entries.sort(function (a, b) {
      if (b.count !== a.count) return b.count - a.count;
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    });
    return entries.map(function (e) { return e.name; });
  }

  /* ─── 6. getCompatibilityBreakdown ─── */

  /**
   * Return a detailed breakdown of compatibility between two profiles.
   */
  function getCompatibilityBreakdown(profileA, profileB) {
    var a = _safeProfile(profileA);
    var b = _safeProfile(profileB);

    var vibeSetA = _toSet(a.vibePreferences);
    var vibeSetB = _toSet(b.vibePreferences);
    var sharedVibes = _intersect(vibeSetA, vibeSetB);
    var uniqueToA = _difference(vibeSetA, vibeSetB);
    var uniqueToB = _difference(vibeSetB, vibeSetA);

    var venueSetA = _toSet(a.visitedVenues);
    var venueSetB = _toSet(b.visitedVenues);
    var sharedVenues = _intersect(venueSetA, venueSetB);

    var catSetA = _toSet(a.favoriteCategories);
    var catSetB = _toSet(b.favoriteCategories);
    var sharedCategories = _intersect(catSetA, catSetB);

    var hoodSetA = _toSet(a.preferredNeighborhoods);
    var hoodSetB = _toSet(b.preferredNeighborhoods);
    var sharedNeighborhoods = _intersect(hoodSetA, hoodSetB);

    var vibeScore = _jaccardSimilarity(a.vibePreferences, b.vibePreferences);
    var venueScore = _jaccardSimilarity(a.visitedVenues, b.visitedVenues);
    var categoryScore = _jaccardSimilarity(a.favoriteCategories, b.favoriteCategories);
    var neighborhoodScore = _jaccardSimilarity(a.preferredNeighborhoods, b.preferredNeighborhoods);

    return {
      overallScore: calculateCompatibility(profileA, profileB),
      vibes: {
        score: Math.round(vibeScore * 100),
        shared: sharedVibes.sort(),
        uniqueToA: uniqueToA.sort(),
        uniqueToB: uniqueToB.sort()
      },
      venues: {
        score: Math.round(venueScore * 100),
        shared: sharedVenues.sort()
      },
      categories: {
        score: Math.round(categoryScore * 100),
        shared: sharedCategories.sort()
      },
      neighborhoods: {
        score: Math.round(neighborhoodScore * 100),
        shared: sharedNeighborhoods.sort()
      }
    };
  }

  /* ─── Internal: parse vibe tags from venue ─── */

  function _parseVibeTags(venue) {
    var raw = (venue["Vibe Tags"] || venue.vibes || "").toString();
    if (Array.isArray(venue.vibes)) return venue.vibes;
    return raw.split(",").map(function (t) { return t.trim().toLowerCase(); }).filter(Boolean);
  }

  /* ─── Exports ─── */

  exports.calculateCompatibility = calculateCompatibility;
  exports.getSharedVibes = getSharedVibes;
  exports.getConflictingVibes = getConflictingVibes;
  exports.suggestCompromiseVenues = suggestCompromiseVenues;
  exports.createGroupVibeProfile = createGroupVibeProfile;
  exports.getCompatibilityBreakdown = getCompatibilityBreakdown;

})(typeof module !== "undefined" ? module.exports : (window.LNVVibeMatchFriends = {}));
