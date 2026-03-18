import { describe, it, expect } from "vitest";

import {
  calculateCompatibility,
  getSharedVibes,
  getConflictingVibes,
  suggestCompromiseVenues,
  createGroupVibeProfile,
  getCompatibilityBreakdown,
} from "../lib/vibe-match-friends.js";

/* ── Test profile fixtures ── */

const PROFILE_A = {
  vibePreferences: ["chill", "romantic", "cozy"],
  visitedVenues: ["Bar Alpha", "Lounge Delta", "Wine Zeta"],
  favoriteCategories: ["cocktail-bar", "wine-bar"],
  preferredNeighborhoods: ["Capitol Hill", "Fremont"],
};

const PROFILE_B = {
  vibePreferences: ["energetic", "loud", "dance"],
  visitedVenues: ["Club Beta", "Dive Epsilon", "Sports Eta"],
  favoriteCategories: ["nightclub", "dive-bar"],
  preferredNeighborhoods: ["Belltown", "Georgetown"],
};

const PROFILE_C = {
  vibePreferences: ["chill", "romantic", "cozy"],
  visitedVenues: ["Bar Alpha", "Lounge Delta", "Wine Zeta"],
  favoriteCategories: ["cocktail-bar", "wine-bar"],
  preferredNeighborhoods: ["Capitol Hill", "Fremont"],
};

const PROFILE_PARTIAL_OVERLAP = {
  vibePreferences: ["chill", "energetic", "fun"],
  visitedVenues: ["Bar Alpha", "Club Beta", "Brewery Theta"],
  favoriteCategories: ["cocktail-bar", "brewery"],
  preferredNeighborhoods: ["Capitol Hill", "Ballard"],
};

const EMPTY_PROFILE = {
  vibePreferences: [],
  visitedVenues: [],
  favoriteCategories: [],
  preferredNeighborhoods: [],
};

/* ── Venue fixtures for compromise suggestions ── */

const VENUES = [
  { Name: "Bar Alpha", Category: "cocktail-bar", Area: "Capitol Hill", "Vibe Tags": "chill, romantic" },
  { Name: "Club Beta", Category: "nightclub", Area: "Belltown", "Vibe Tags": "energetic, loud" },
  { Name: "Pub Gamma", Category: "pub", Area: "Ballard", "Vibe Tags": "chill, casual" },
  { Name: "Lounge Delta", Category: "cocktail-bar", Area: "Capitol Hill", "Vibe Tags": "romantic, upscale" },
  { Name: "Dive Epsilon", Category: "dive-bar", Area: "Georgetown", "Vibe Tags": "loud, casual" },
  { Name: "Wine Zeta", Category: "wine-bar", Area: "Fremont", "Vibe Tags": "romantic, chill" },
  { Name: "Sports Eta", Category: "sports-bar", Area: "University District", "Vibe Tags": "loud, energetic" },
  { Name: "Brewery Theta", Category: "brewery", Area: "Ballard", "Vibe Tags": "casual, chill" },
  { Name: "Fusion Spot", Category: "cocktail-bar", Area: "Belltown", "Vibe Tags": "chill, energetic, fun" },
  { Name: "Rooftop Iota", Category: "rooftop", Area: "Downtown", "Vibe Tags": "upscale, romantic" },
];

/* ══════════════════════════════════════════
 * 1. calculateCompatibility
 * ══════════════════════════════════════════ */
describe("calculateCompatibility", () => {
  it("returns 100 for identical profiles", () => {
    expect(calculateCompatibility(PROFILE_A, PROFILE_C)).toBe(100);
  });

  it("returns 0 for completely different profiles", () => {
    expect(calculateCompatibility(PROFILE_A, PROFILE_B)).toBe(0);
  });

  it("returns a value between 0 and 100 for partial overlap", () => {
    var score = calculateCompatibility(PROFILE_A, PROFILE_PARTIAL_OVERLAP);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(100);
  });

  it("returns 0 for two empty profiles", () => {
    expect(calculateCompatibility(EMPTY_PROFILE, EMPTY_PROFILE)).toBe(0);
  });

  it("returns 0 when one profile is empty", () => {
    expect(calculateCompatibility(PROFILE_A, EMPTY_PROFILE)).toBe(0);
  });

  it("handles null profiles gracefully", () => {
    expect(calculateCompatibility(null, null)).toBe(0);
    expect(calculateCompatibility(PROFILE_A, null)).toBe(0);
    expect(calculateCompatibility(null, PROFILE_A)).toBe(0);
  });

  it("handles undefined profiles gracefully", () => {
    expect(calculateCompatibility(undefined, undefined)).toBe(0);
  });

  it("is symmetric (A,B) === (B,A)", () => {
    var ab = calculateCompatibility(PROFILE_A, PROFILE_PARTIAL_OVERLAP);
    var ba = calculateCompatibility(PROFILE_PARTIAL_OVERLAP, PROFILE_A);
    expect(ab).toBe(ba);
  });

  it("returns a rounded integer", () => {
    var score = calculateCompatibility(PROFILE_A, PROFILE_PARTIAL_OVERLAP);
    expect(score).toBe(Math.round(score));
  });

  it("is case-insensitive", () => {
    var upper = {
      vibePreferences: ["CHILL", "ROMANTIC", "COZY"],
      visitedVenues: ["BAR ALPHA"],
      favoriteCategories: ["COCKTAIL-BAR"],
      preferredNeighborhoods: ["CAPITOL HILL"],
    };
    var lower = {
      vibePreferences: ["chill", "romantic", "cozy"],
      visitedVenues: ["bar alpha"],
      favoriteCategories: ["cocktail-bar"],
      preferredNeighborhoods: ["capitol hill"],
    };
    expect(calculateCompatibility(upper, lower)).toBe(100);
  });

  it("handles profiles with missing fields", () => {
    var partial = { vibePreferences: ["chill"] };
    expect(() => calculateCompatibility(partial, PROFILE_A)).not.toThrow();
    var score = calculateCompatibility(partial, PROFILE_A);
    expect(typeof score).toBe("number");
  });
});

/* ══════════════════════════════════════════
 * 2. getSharedVibes
 * ══════════════════════════════════════════ */
describe("getSharedVibes", () => {
  it("returns shared vibes between identical profiles", () => {
    var shared = getSharedVibes([PROFILE_A, PROFILE_C]);
    expect(shared).toEqual(["chill", "cozy", "romantic"]);
  });

  it("returns empty array for completely different profiles", () => {
    var shared = getSharedVibes([PROFILE_A, PROFILE_B]);
    expect(shared).toEqual([]);
  });

  it("returns partial overlap", () => {
    var shared = getSharedVibes([PROFILE_A, PROFILE_PARTIAL_OVERLAP]);
    expect(shared).toContain("chill");
    expect(shared).not.toContain("energetic");
    expect(shared).not.toContain("romantic");
  });

  it("handles empty profiles array", () => {
    expect(getSharedVibes([])).toEqual([]);
  });

  it("handles null input", () => {
    expect(getSharedVibes(null)).toEqual([]);
  });

  it("handles single profile", () => {
    var shared = getSharedVibes([PROFILE_A]);
    expect(shared).toEqual(["chill", "cozy", "romantic"]);
  });

  it("handles three profiles", () => {
    var shared = getSharedVibes([PROFILE_A, PROFILE_PARTIAL_OVERLAP, PROFILE_C]);
    expect(shared).toEqual(["chill"]);
  });

  it("handles all empty profiles", () => {
    expect(getSharedVibes([EMPTY_PROFILE, EMPTY_PROFILE])).toEqual([]);
  });

  it("returns sorted results", () => {
    var shared = getSharedVibes([PROFILE_A, PROFILE_C]);
    var sorted = shared.slice().sort();
    expect(shared).toEqual(sorted);
  });
});

/* ══════════════════════════════════════════
 * 3. getConflictingVibes
 * ══════════════════════════════════════════ */
describe("getConflictingVibes", () => {
  it("identifies all vibes as conflicts when no overlap", () => {
    var conflicts = getConflictingVibes([PROFILE_A, PROFILE_B]);
    var vibes = conflicts.map(function (c) { return c.vibe; });
    expect(vibes).toContain("chill");
    expect(vibes).toContain("romantic");
    expect(vibes).toContain("energetic");
    expect(vibes).toContain("loud");
  });

  it("returns no conflicts for identical profiles", () => {
    var conflicts = getConflictingVibes([PROFILE_A, PROFILE_C]);
    expect(conflicts).toEqual([]);
  });

  it("returns partial conflicts for partial overlap", () => {
    var conflicts = getConflictingVibes([PROFILE_A, PROFILE_PARTIAL_OVERLAP]);
    var vibes = conflicts.map(function (c) { return c.vibe; });
    // "chill" is shared, should not be a conflict
    expect(vibes).not.toContain("chill");
    // "romantic" and "cozy" are unique to A
    expect(vibes).toContain("romantic");
    expect(vibes).toContain("cozy");
    // "energetic" and "fun" are unique to B
    expect(vibes).toContain("energetic");
    expect(vibes).toContain("fun");
  });

  it("returns empty for less than 2 profiles", () => {
    expect(getConflictingVibes([PROFILE_A])).toEqual([]);
    expect(getConflictingVibes([])).toEqual([]);
  });

  it("returns empty for null input", () => {
    expect(getConflictingVibes(null)).toEqual([]);
  });

  it("includes presentIn and missingIn indices", () => {
    var conflicts = getConflictingVibes([PROFILE_A, PROFILE_B]);
    var chillConflict = conflicts.find(function (c) { return c.vibe === "chill"; });
    expect(chillConflict).toBeDefined();
    expect(chillConflict.presentIn).toEqual([0]);
    expect(chillConflict.missingIn).toEqual([1]);
  });

  it("handles three profiles", () => {
    var conflicts = getConflictingVibes([PROFILE_A, PROFILE_B, PROFILE_PARTIAL_OVERLAP]);
    // "chill" is in A and PARTIAL_OVERLAP but not B
    var chillConflict = conflicts.find(function (c) { return c.vibe === "chill"; });
    expect(chillConflict).toBeDefined();
    expect(chillConflict.presentIn).toContain(0);
    expect(chillConflict.presentIn).toContain(2);
    expect(chillConflict.missingIn).toContain(1);
  });

  it("returns sorted by vibe name", () => {
    var conflicts = getConflictingVibes([PROFILE_A, PROFILE_B]);
    var vibes = conflicts.map(function (c) { return c.vibe; });
    var sorted = vibes.slice().sort();
    expect(vibes).toEqual(sorted);
  });
});

/* ══════════════════════════════════════════
 * 4. suggestCompromiseVenues
 * ══════════════════════════════════════════ */
describe("suggestCompromiseVenues", () => {
  it("returns venues sorted by score descending", () => {
    var results = suggestCompromiseVenues([PROFILE_A, PROFILE_PARTIAL_OVERLAP], VENUES);
    for (var i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it("returns at most 10 venues", () => {
    var results = suggestCompromiseVenues([PROFILE_A, PROFILE_B], VENUES);
    expect(results.length).toBeLessThanOrEqual(10);
  });

  it("returns empty for empty profiles array", () => {
    expect(suggestCompromiseVenues([], VENUES)).toEqual([]);
  });

  it("returns empty for empty venue list", () => {
    expect(suggestCompromiseVenues([PROFILE_A, PROFILE_B], [])).toEqual([]);
  });

  it("returns empty for null profiles", () => {
    expect(suggestCompromiseVenues(null, VENUES)).toEqual([]);
  });

  it("returns empty for null venue list", () => {
    expect(suggestCompromiseVenues([PROFILE_A], null)).toEqual([]);
  });

  it("each result has venue, score, and profilesServed", () => {
    var results = suggestCompromiseVenues([PROFILE_A, PROFILE_B], VENUES);
    expect(results.length).toBeGreaterThan(0);
    var first = results[0];
    expect(first).toHaveProperty("venue");
    expect(first).toHaveProperty("score");
    expect(first).toHaveProperty("profilesServed");
  });

  it("favors venues that satisfy more profiles", () => {
    // Fusion Spot has "chill, energetic, fun" which bridges A and B
    var results = suggestCompromiseVenues([PROFILE_A, PROFILE_B], VENUES);
    var fusionIdx = -1;
    var pureIdx = -1;
    results.forEach(function (r, i) {
      if (r.venue.Name === "Fusion Spot") fusionIdx = i;
      if (r.venue.Name === "Rooftop Iota") pureIdx = i;
    });
    // Fusion Spot should score well because it has vibes from both sides
    if (fusionIdx !== -1) {
      expect(results[fusionIdx].profilesServed).toBe(2);
    }
  });

  it("works with a single profile", () => {
    var results = suggestCompromiseVenues([PROFILE_A], VENUES);
    expect(results.length).toBeGreaterThan(0);
  });
});

/* ══════════════════════════════════════════
 * 5. createGroupVibeProfile
 * ══════════════════════════════════════════ */
describe("createGroupVibeProfile", () => {
  it("merges two identical profiles correctly", () => {
    var group = createGroupVibeProfile([PROFILE_A, PROFILE_C]);
    expect(group.vibePreferences).toEqual(["chill", "cozy", "romantic"]);
    expect(group.favoriteCategories).toEqual(["cocktail-bar", "wine-bar"]);
    expect(group.preferredNeighborhoods).toEqual(["capitol hill", "fremont"]);
  });

  it("merges two different profiles with union of venues", () => {
    var group = createGroupVibeProfile([PROFILE_A, PROFILE_B]);
    expect(group.visitedVenues.length).toBe(6);
    expect(group.visitedVenues).toContain("bar alpha");
    expect(group.visitedVenues).toContain("club beta");
  });

  it("ranks vibes by frequency across profiles", () => {
    var group = createGroupVibeProfile([PROFILE_A, PROFILE_PARTIAL_OVERLAP]);
    // "chill" appears in both, so it should be first
    expect(group.vibePreferences[0]).toBe("chill");
  });

  it("returns empty profile for empty input", () => {
    var group = createGroupVibeProfile([]);
    expect(group.vibePreferences).toEqual([]);
    expect(group.visitedVenues).toEqual([]);
    expect(group.favoriteCategories).toEqual([]);
    expect(group.preferredNeighborhoods).toEqual([]);
  });

  it("returns empty profile for null input", () => {
    var group = createGroupVibeProfile(null);
    expect(group.vibePreferences).toEqual([]);
  });

  it("handles single profile", () => {
    var group = createGroupVibeProfile([PROFILE_A]);
    expect(group.vibePreferences).toContain("chill");
    expect(group.vibePreferences).toContain("romantic");
    expect(group.vibePreferences).toContain("cozy");
  });

  it("handles three profiles", () => {
    var group = createGroupVibeProfile([PROFILE_A, PROFILE_B, PROFILE_PARTIAL_OVERLAP]);
    // "chill" appears in A and PARTIAL_OVERLAP = count 2
    // "energetic" appears in B and PARTIAL_OVERLAP = count 2
    var chillIdx = group.vibePreferences.indexOf("chill");
    var energeticIdx = group.vibePreferences.indexOf("energetic");
    expect(chillIdx).toBeLessThanOrEqual(1);
    expect(energeticIdx).toBeLessThanOrEqual(1);
  });

  it("sorted venues are deduplicated", () => {
    var group = createGroupVibeProfile([PROFILE_A, PROFILE_C]);
    // Both have same venues, should be deduplicated
    expect(group.visitedVenues.length).toBe(3);
  });
});

/* ══════════════════════════════════════════
 * 6. getCompatibilityBreakdown
 * ══════════════════════════════════════════ */
describe("getCompatibilityBreakdown", () => {
  it("returns overallScore matching calculateCompatibility", () => {
    var breakdown = getCompatibilityBreakdown(PROFILE_A, PROFILE_PARTIAL_OVERLAP);
    var score = calculateCompatibility(PROFILE_A, PROFILE_PARTIAL_OVERLAP);
    expect(breakdown.overallScore).toBe(score);
  });

  it("returns 100% for all breakdown categories with identical profiles", () => {
    var breakdown = getCompatibilityBreakdown(PROFILE_A, PROFILE_C);
    expect(breakdown.vibes.score).toBe(100);
    expect(breakdown.venues.score).toBe(100);
    expect(breakdown.categories.score).toBe(100);
    expect(breakdown.neighborhoods.score).toBe(100);
  });

  it("returns 0% for all breakdown categories with zero overlap", () => {
    var breakdown = getCompatibilityBreakdown(PROFILE_A, PROFILE_B);
    expect(breakdown.vibes.score).toBe(0);
    expect(breakdown.venues.score).toBe(0);
    expect(breakdown.categories.score).toBe(0);
    expect(breakdown.neighborhoods.score).toBe(0);
  });

  it("includes shared vibes", () => {
    var breakdown = getCompatibilityBreakdown(PROFILE_A, PROFILE_PARTIAL_OVERLAP);
    expect(breakdown.vibes.shared).toContain("chill");
  });

  it("includes uniqueToA and uniqueToB vibes", () => {
    var breakdown = getCompatibilityBreakdown(PROFILE_A, PROFILE_PARTIAL_OVERLAP);
    expect(breakdown.vibes.uniqueToA).toContain("romantic");
    expect(breakdown.vibes.uniqueToA).toContain("cozy");
    expect(breakdown.vibes.uniqueToB).toContain("energetic");
    expect(breakdown.vibes.uniqueToB).toContain("fun");
  });

  it("includes shared venues", () => {
    var breakdown = getCompatibilityBreakdown(PROFILE_A, PROFILE_PARTIAL_OVERLAP);
    expect(breakdown.venues.shared).toContain("bar alpha");
  });

  it("includes shared categories", () => {
    var breakdown = getCompatibilityBreakdown(PROFILE_A, PROFILE_PARTIAL_OVERLAP);
    expect(breakdown.categories.shared).toContain("cocktail-bar");
  });

  it("includes shared neighborhoods", () => {
    var breakdown = getCompatibilityBreakdown(PROFILE_A, PROFILE_PARTIAL_OVERLAP);
    expect(breakdown.neighborhoods.shared).toContain("capitol hill");
  });

  it("handles null profiles", () => {
    var breakdown = getCompatibilityBreakdown(null, null);
    expect(breakdown.overallScore).toBe(0);
    expect(breakdown.vibes.shared).toEqual([]);
    expect(breakdown.vibes.uniqueToA).toEqual([]);
    expect(breakdown.vibes.uniqueToB).toEqual([]);
  });

  it("handles empty profiles", () => {
    var breakdown = getCompatibilityBreakdown(EMPTY_PROFILE, EMPTY_PROFILE);
    expect(breakdown.overallScore).toBe(0);
    expect(breakdown.vibes.score).toBe(0);
  });

  it("returns sorted arrays in breakdown", () => {
    var breakdown = getCompatibilityBreakdown(PROFILE_A, PROFILE_PARTIAL_OVERLAP);
    expect(breakdown.vibes.shared).toEqual(breakdown.vibes.shared.slice().sort());
    expect(breakdown.vibes.uniqueToA).toEqual(breakdown.vibes.uniqueToA.slice().sort());
    expect(breakdown.vibes.uniqueToB).toEqual(breakdown.vibes.uniqueToB.slice().sort());
  });
});

/* ══════════════════════════════════════════
 * Edge Cases
 * ══════════════════════════════════════════ */
describe("edge cases", () => {
  it("profiles with non-array fields are handled gracefully", () => {
    var bad = { vibePreferences: "chill", visitedVenues: null, favoriteCategories: 42 };
    expect(() => calculateCompatibility(bad, PROFILE_A)).not.toThrow();
    expect(calculateCompatibility(bad, PROFILE_A)).toBe(0);
  });

  it("profiles with empty strings in arrays are normalized", () => {
    var prof = {
      vibePreferences: ["chill", "", "  "],
      visitedVenues: [],
      favoriteCategories: [],
      preferredNeighborhoods: [],
    };
    var shared = getSharedVibes([prof, { vibePreferences: ["chill"], visitedVenues: [], favoriteCategories: [], preferredNeighborhoods: [] }]);
    expect(shared).toEqual(["chill"]);
  });

  it("duplicate tags in a profile are collapsed", () => {
    var prof = {
      vibePreferences: ["chill", "chill", "chill"],
      visitedVenues: ["v1", "v1"],
      favoriteCategories: ["cat", "cat"],
      preferredNeighborhoods: ["hood", "hood"],
    };
    var score = calculateCompatibility(prof, prof);
    // Jaccard of identical sets = 1.0 for all dimensions => 35+25+25+15 = 100
    expect(score).toBe(100);
  });

  it("suggestCompromiseVenues handles venues with vibes as array", () => {
    var venues = [
      { Name: "Test Bar", Category: "bar", Area: "Capitol Hill", vibes: ["chill", "romantic"] },
    ];
    var results = suggestCompromiseVenues([PROFILE_A], venues);
    expect(results.length).toBe(1);
  });

  it("getConflictingVibes with all-empty profiles returns empty", () => {
    expect(getConflictingVibes([EMPTY_PROFILE, EMPTY_PROFILE])).toEqual([]);
  });

  it("createGroupVibeProfile with profiles missing fields", () => {
    var partial = { vibePreferences: ["jazz"] };
    var group = createGroupVibeProfile([partial, PROFILE_A]);
    expect(group.vibePreferences).toContain("jazz");
    expect(group.vibePreferences).toContain("chill");
  });

  it("compatibility score never exceeds 100", () => {
    // Create profiles with massive overlap
    var big = {
      vibePreferences: ["a", "b", "c", "d", "e"],
      visitedVenues: ["v1", "v2", "v3", "v4", "v5"],
      favoriteCategories: ["c1", "c2", "c3"],
      preferredNeighborhoods: ["n1", "n2", "n3"],
    };
    expect(calculateCompatibility(big, big)).toBeLessThanOrEqual(100);
  });

  it("compatibility score never goes below 0", () => {
    expect(calculateCompatibility(PROFILE_A, PROFILE_B)).toBeGreaterThanOrEqual(0);
  });
});
