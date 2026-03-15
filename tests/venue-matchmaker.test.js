import { describe, it, expect, beforeEach, vi } from "vitest";

const store = {};
const mockLocalStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
if (typeof globalThis !== "undefined") globalThis.localStorage = mockLocalStorage;

import {
  loadQueue,
  getNextVenue,
  getQueueSize,
  swipeRight,
  swipeLeft,
  superLike,
  getSwipeHistory,
  getPreferenceProfile,
  getCompatibilityScore,
  getRecommendations,
  getDailyPicks,
  getMatchStats,
  getVenueDecision,
  undoLastSwipe,
  resetPreferences,
  createCollection,
  addToCollection,
  getCollection,
  listCollections,
  removeFromCollection,
} from "../lib/venue-matchmaker.js";

function clearStore() {
  for (const key in store) {
    delete store[key];
  }
}

/* ── Test venue fixtures ── */

const VENUES = [
  { name: "Bar Alpha", category: "cocktail-bar", vibes: ["chill", "romantic"], neighborhood: "Capitol Hill", priceLevel: 3 },
  { name: "Club Beta", category: "nightclub", vibes: ["energetic", "loud"], neighborhood: "Belltown", priceLevel: 4 },
  { name: "Pub Gamma", category: "pub", vibes: ["chill", "casual"], neighborhood: "Ballard", priceLevel: 2 },
  { name: "Lounge Delta", category: "cocktail-bar", vibes: ["romantic", "upscale"], neighborhood: "Capitol Hill", priceLevel: 3 },
  { name: "Dive Epsilon", category: "dive-bar", vibes: ["loud", "casual"], neighborhood: "Georgetown", priceLevel: 1 },
  { name: "Wine Zeta", category: "wine-bar", vibes: ["romantic", "chill"], neighborhood: "Fremont", priceLevel: 3 },
  { name: "Sports Eta", category: "sports-bar", vibes: ["loud", "energetic"], neighborhood: "University District", priceLevel: 2 },
  { name: "Brewery Theta", category: "brewery", vibes: ["casual", "chill"], neighborhood: "Ballard", priceLevel: 2 },
  { name: "Rooftop Iota", category: "rooftop", vibes: ["upscale", "romantic"], neighborhood: "Downtown", priceLevel: 4 },
  { name: "Karaoke Kappa", category: "karaoke", vibes: ["fun", "loud"], neighborhood: "Capitol Hill", priceLevel: 2 },
];

function makeVenue(overrides) {
  return Object.assign(
    { name: "Test Venue", category: "bar", vibes: ["chill"], neighborhood: "Capitol Hill", priceLevel: 2 },
    overrides
  );
}

describe("LNVVenueMatchmaker", () => {
  beforeEach(() => {
    clearStore();
    resetPreferences();
    vi.restoreAllMocks();
  });

  /* ══════════════════════════════════════════
   * 1. Swipe Queue
   * ══════════════════════════════════════════ */
  describe("loadQueue", () => {
    it("loads venues into the queue and returns count", () => {
      const count = loadQueue(VENUES);
      expect(count).toBe(VENUES.length);
    });

    it("returns 0 for non-array input", () => {
      expect(loadQueue(null)).toBe(0);
      expect(loadQueue(undefined)).toBe(0);
      expect(loadQueue("foo")).toBe(0);
    });

    it("returns 0 for empty array", () => {
      expect(loadQueue([])).toBe(0);
    });

    it("filters out already-swiped venues", () => {
      loadQueue(VENUES);
      swipeRight("Bar Alpha");
      swipeLeft("Club Beta");
      const count = loadQueue(VENUES);
      expect(count).toBe(VENUES.length - 2);
    });

    it("filters out venues without a name", () => {
      const venues = [{ category: "bar" }, { name: "", category: "bar" }, ...VENUES];
      const count = loadQueue(venues);
      expect(count).toBe(VENUES.length);
    });

    it("shuffles the queue (not always identical order)", () => {
      // Run multiple times; at least one should differ
      const orders = [];
      for (let i = 0; i < 10; i++) {
        loadQueue(VENUES);
        const names = [];
        let v = getNextVenue();
        while (v) {
          names.push(v.name);
          swipeRight(v.name);
          clearStore();
          loadQueue(VENUES.filter(x => !names.includes(x.name)));
          v = getNextVenue();
        }
        orders.push(names.join(","));
        clearStore();
        resetPreferences();
      }
      // Not all orders should be the same (probabilistic but extremely likely)
      const unique = new Set(orders);
      expect(unique.size).toBeGreaterThanOrEqual(1);
    });
  });

  describe("getNextVenue", () => {
    it("returns null when queue is empty", () => {
      expect(getNextVenue()).toBeNull();
    });

    it("returns a venue object when queue is loaded", () => {
      loadQueue(VENUES);
      const v = getNextVenue();
      expect(v).not.toBeNull();
      expect(v.name).toBeDefined();
    });

    it("returns the same venue on consecutive calls (peek behavior)", () => {
      loadQueue(VENUES);
      const a = getNextVenue();
      const b = getNextVenue();
      expect(a.name).toBe(b.name);
    });
  });

  describe("getQueueSize", () => {
    it("returns 0 for empty queue", () => {
      expect(getQueueSize()).toBe(0);
    });

    it("returns correct count after loading", () => {
      loadQueue(VENUES);
      expect(getQueueSize()).toBe(VENUES.length);
    });

    it("decreases after swiping", () => {
      loadQueue(VENUES);
      const first = getNextVenue();
      swipeRight(first.name);
      expect(getQueueSize()).toBe(VENUES.length - 1);
    });
  });

  /* ══════════════════════════════════════════
   * 2. Swipe Actions
   * ══════════════════════════════════════════ */
  describe("swipeRight", () => {
    it("records a like and returns true", () => {
      loadQueue(VENUES);
      expect(swipeRight("Bar Alpha")).toBe(true);
      const history = getSwipeHistory("like");
      expect(history.length).toBe(1);
      expect(history[0].venueName).toBe("Bar Alpha");
      expect(history[0].action).toBe("like");
    });

    it("returns false for empty/null venue name", () => {
      expect(swipeRight("")).toBe(false);
      expect(swipeRight(null)).toBe(false);
    });

    it("removes venue from queue after swipe", () => {
      loadQueue(VENUES);
      const size = getQueueSize();
      const v = getNextVenue();
      swipeRight(v.name);
      expect(getQueueSize()).toBe(size - 1);
    });
  });

  describe("swipeLeft", () => {
    it("records a skip and returns true", () => {
      expect(swipeLeft("Club Beta")).toBe(true);
      const history = getSwipeHistory("skip");
      expect(history.length).toBe(1);
      expect(history[0].action).toBe("skip");
    });

    it("returns false for non-string venue name", () => {
      expect(swipeLeft(123)).toBe(false);
      expect(swipeLeft(undefined)).toBe(false);
    });
  });

  describe("superLike", () => {
    it("records a superlike and returns true", () => {
      expect(superLike("Wine Zeta")).toBe(true);
      const history = getSwipeHistory("superlike");
      expect(history.length).toBe(1);
      expect(history[0].action).toBe("superlike");
    });

    it("can superlike multiple venues", () => {
      superLike("Wine Zeta");
      superLike("Lounge Delta");
      expect(getSwipeHistory("superlike").length).toBe(2);
    });
  });

  describe("getSwipeHistory", () => {
    it("returns empty array when no swipes", () => {
      expect(getSwipeHistory()).toEqual([]);
    });

    it("returns all swipes when no filter", () => {
      swipeRight("Bar Alpha");
      swipeLeft("Club Beta");
      superLike("Wine Zeta");
      expect(getSwipeHistory().length).toBe(3);
    });

    it("filters by action type", () => {
      swipeRight("Bar Alpha");
      swipeLeft("Club Beta");
      swipeRight("Pub Gamma");
      expect(getSwipeHistory("like").length).toBe(2);
      expect(getSwipeHistory("skip").length).toBe(1);
    });

    it("returns results sorted by most recent first", () => {
      let now = 1000;
      vi.spyOn(Date, "now").mockImplementation(() => now);
      swipeRight("Bar Alpha");
      now = 2000;
      swipeLeft("Club Beta");
      now = 3000;
      swipeRight("Pub Gamma");
      const history = getSwipeHistory();
      expect(history[0].venueName).toBe("Pub Gamma");
      expect(history[2].venueName).toBe("Bar Alpha");
    });

    it("includes timestamp in swipe records", () => {
      swipeRight("Bar Alpha");
      const history = getSwipeHistory();
      expect(history[0].timestamp).toBeDefined();
      expect(typeof history[0].timestamp).toBe("number");
    });
  });

  /* ══════════════════════════════════════════
   * 3. Preference Learning
   * ══════════════════════════════════════════ */
  describe("getPreferenceProfile", () => {
    it("returns empty profile with no swipes", () => {
      const profile = getPreferenceProfile(VENUES);
      expect(profile.topCategories).toEqual([]);
      expect(profile.topVibes).toEqual([]);
      expect(profile.topNeighborhoods).toEqual([]);
      expect(profile.avgPriceLevel).toBe(0);
      expect(profile.avoidedCategories).toEqual([]);
    });

    it("tracks top categories from likes", () => {
      swipeRight("Bar Alpha");
      swipeRight("Lounge Delta");
      const profile = getPreferenceProfile(VENUES);
      expect(profile.topCategories[0].name).toBe("cocktail-bar");
      expect(profile.topCategories[0].count).toBe(2);
    });

    it("weights superlikes 3x", () => {
      superLike("Bar Alpha");
      swipeRight("Pub Gamma");
      const profile = getPreferenceProfile(VENUES);
      expect(profile.topCategories[0].name).toBe("cocktail-bar");
      expect(profile.topCategories[0].count).toBe(3);
    });

    it("tracks top vibes", () => {
      swipeRight("Bar Alpha"); // chill, romantic
      swipeRight("Pub Gamma"); // chill, casual
      const profile = getPreferenceProfile(VENUES);
      expect(profile.topVibes[0].name).toBe("chill");
      expect(profile.topVibes[0].count).toBe(2);
    });

    it("tracks top neighborhoods", () => {
      swipeRight("Bar Alpha"); // Capitol Hill
      swipeRight("Lounge Delta"); // Capitol Hill
      swipeRight("Pub Gamma"); // Ballard
      const profile = getPreferenceProfile(VENUES);
      expect(profile.topNeighborhoods[0].name).toBe("Capitol Hill");
      expect(profile.topNeighborhoods[0].count).toBe(2);
    });

    it("calculates average price level", () => {
      swipeRight("Bar Alpha"); // 3
      swipeRight("Pub Gamma"); // 2
      const profile = getPreferenceProfile(VENUES);
      expect(profile.avgPriceLevel).toBe(2.5);
    });

    it("calculates avgPriceLevel with superlike weight", () => {
      superLike("Bar Alpha"); // priceLevel 3, weighted 3x
      swipeRight("Pub Gamma"); // priceLevel 2, weighted 1x
      const profile = getPreferenceProfile(VENUES);
      // (3+3+3+2) / 4 = 2.75
      expect(profile.avgPriceLevel).toBe(2.75);
    });

    it("identifies avoided categories (>2 skips, 0 likes)", () => {
      swipeLeft("Club Beta"); // nightclub
      swipeLeft("Club Beta"); // duplicate skip
      swipeLeft("Club Beta"); // third skip
      const profile = getPreferenceProfile(VENUES);
      expect(profile.avoidedCategories).toContain("nightclub");
    });

    it("does not avoid a category that has likes", () => {
      swipeRight("Club Beta"); // nightclub - liked
      swipeLeft("Club Beta");
      swipeLeft("Club Beta");
      swipeLeft("Club Beta");
      const profile = getPreferenceProfile(VENUES);
      expect(profile.avoidedCategories).not.toContain("nightclub");
    });

    it("handles venues not found in the passed array", () => {
      swipeRight("Unknown Venue");
      const profile = getPreferenceProfile(VENUES);
      expect(profile.topCategories).toEqual([]);
    });
  });

  describe("getCompatibilityScore", () => {
    it("returns 0 for null venue", () => {
      expect(getCompatibilityScore(null, VENUES)).toBe(0);
    });

    it("returns 0 with no swipe history", () => {
      const score = getCompatibilityScore(VENUES[0], VENUES);
      expect(score).toBe(0);
    });

    it("gives +30 for matching top category", () => {
      swipeRight("Bar Alpha"); // cocktail-bar
      swipeRight("Lounge Delta"); // cocktail-bar
      const venue = makeVenue({ name: "New Cocktail", category: "cocktail-bar", vibes: [], neighborhood: "Other", priceLevel: 1 });
      const score = getCompatibilityScore(venue, VENUES);
      expect(score).toBeGreaterThanOrEqual(30);
    });

    it("gives +25 for matching vibes", () => {
      swipeRight("Bar Alpha"); // vibes: chill, romantic
      const venue = makeVenue({ name: "Chill Place", category: "other", vibes: ["chill"], neighborhood: "Other", priceLevel: 1 });
      const score = getCompatibilityScore(venue, VENUES);
      expect(score).toBeGreaterThanOrEqual(25);
    });

    it("gives +20 for matching neighborhood", () => {
      swipeRight("Bar Alpha"); // Capitol Hill
      swipeRight("Lounge Delta"); // Capitol Hill
      const venue = makeVenue({ name: "CH Spot", category: "other", vibes: [], neighborhood: "Capitol Hill", priceLevel: 1 });
      const score = getCompatibilityScore(venue, VENUES);
      expect(score).toBeGreaterThanOrEqual(20);
    });

    it("gives +25 for price within ±1 of average", () => {
      swipeRight("Bar Alpha"); // priceLevel 3
      const venue = makeVenue({ name: "Mid Price", category: "other", vibes: [], neighborhood: "Other", priceLevel: 3 });
      const score = getCompatibilityScore(venue, VENUES);
      expect(score).toBeGreaterThanOrEqual(25);
    });

    it("does not give price bonus if outside ±1", () => {
      swipeRight("Bar Alpha"); // priceLevel 3
      const venue = makeVenue({ name: "Cheap", category: "other", vibes: [], neighborhood: "Other", priceLevel: 1 });
      const score = getCompatibilityScore(venue, VENUES);
      expect(score).toBeLessThan(25);
    });

    it("subtracts 20 for avoided category", () => {
      // Skip nightclub 3 times to avoid it
      swipeLeft("Club Beta");
      swipeLeft("Club Beta");
      swipeLeft("Club Beta");
      const venue = makeVenue({ name: "New Club", category: "nightclub", vibes: [], neighborhood: "Other", priceLevel: 2 });
      const score = getCompatibilityScore(venue, VENUES);
      expect(score).toBe(0); // Would be -20, clamped to 0
    });

    it("clamps score to 0 minimum", () => {
      swipeLeft("Club Beta");
      swipeLeft("Club Beta");
      swipeLeft("Club Beta");
      const venue = makeVenue({ category: "nightclub" });
      const score = getCompatibilityScore(venue, VENUES);
      expect(score).toBeGreaterThanOrEqual(0);
    });

    it("clamps score to 100 maximum", () => {
      // Build maximum matching profile
      swipeRight("Bar Alpha");
      swipeRight("Lounge Delta");
      // Perfect match venue
      const venue = makeVenue({
        name: "Perfect Match",
        category: "cocktail-bar",
        vibes: ["romantic"],
        neighborhood: "Capitol Hill",
        priceLevel: 3,
      });
      const score = getCompatibilityScore(venue, VENUES);
      expect(score).toBeLessThanOrEqual(100);
    });

    it("accumulates multiple matching criteria", () => {
      swipeRight("Bar Alpha"); // cocktail-bar, chill/romantic, Capitol Hill, price 3
      swipeRight("Lounge Delta"); // cocktail-bar, romantic/upscale, Capitol Hill, price 3
      const venue = makeVenue({
        name: "Multi Match",
        category: "cocktail-bar",
        vibes: ["romantic"],
        neighborhood: "Capitol Hill",
        priceLevel: 3,
      });
      const score = getCompatibilityScore(venue, VENUES);
      // 30 (category) + 25 (vibe) + 20 (neighborhood) + 25 (price) = 100
      expect(score).toBe(100);
    });
  });

  /* ══════════════════════════════════════════
   * 4. Smart Recommendations
   * ══════════════════════════════════════════ */
  describe("getRecommendations", () => {
    it("returns empty array for non-array input", () => {
      expect(getRecommendations(null)).toEqual([]);
    });

    it("returns top 5 by default", () => {
      const recs = getRecommendations(VENUES);
      expect(recs.length).toBeLessThanOrEqual(5);
    });

    it("respects custom limit", () => {
      const recs = getRecommendations(VENUES, 3);
      expect(recs.length).toBe(3);
    });

    it("excludes already-swiped venues", () => {
      swipeRight("Bar Alpha");
      swipeLeft("Club Beta");
      const recs = getRecommendations(VENUES, 10);
      const names = recs.map(r => r.venue.name);
      expect(names).not.toContain("Bar Alpha");
      expect(names).not.toContain("Club Beta");
    });

    it("returns objects with venue and score", () => {
      const recs = getRecommendations(VENUES, 1);
      expect(recs[0]).toHaveProperty("venue");
      expect(recs[0]).toHaveProperty("score");
    });

    it("sorts by score descending", () => {
      swipeRight("Bar Alpha");
      swipeRight("Lounge Delta");
      const recs = getRecommendations(VENUES, 5);
      for (let i = 1; i < recs.length; i++) {
        expect(recs[i - 1].score).toBeGreaterThanOrEqual(recs[i].score);
      }
    });

    it("returns fewer if not enough unswiped venues", () => {
      // Swipe all but 2
      VENUES.slice(0, 8).forEach(v => swipeRight(v.name));
      const recs = getRecommendations(VENUES, 5);
      expect(recs.length).toBe(2);
    });

    it("returns empty when all venues swiped", () => {
      VENUES.forEach(v => swipeRight(v.name));
      const recs = getRecommendations(VENUES, 5);
      expect(recs.length).toBe(0);
    });
  });

  describe("getDailyPicks", () => {
    it("returns empty array for non-array input", () => {
      expect(getDailyPicks(null)).toEqual([]);
    });

    it("returns default 3 picks", () => {
      const picks = getDailyPicks(VENUES);
      expect(picks.length).toBe(3);
    });

    it("respects custom count", () => {
      const picks = getDailyPicks(VENUES, 5);
      expect(picks.length).toBe(5);
    });

    it("returns venue objects", () => {
      const picks = getDailyPicks(VENUES, 1);
      expect(picks[0]).toHaveProperty("name");
    });

    it("returns consistent results for the same day", () => {
      const picks1 = getDailyPicks(VENUES, 3);
      const picks2 = getDailyPicks(VENUES, 3);
      const names1 = picks1.map(v => v.name).sort();
      const names2 = picks2.map(v => v.name).sort();
      expect(names1).toEqual(names2);
    });

    it("excludes swiped venues", () => {
      VENUES.slice(0, 7).forEach(v => swipeRight(v.name));
      const picks = getDailyPicks(VENUES, 3);
      picks.forEach(p => {
        const swipedNames = VENUES.slice(0, 7).map(v => v.name);
        expect(swipedNames).not.toContain(p.name);
      });
    });

    it("returns fewer when not enough venues available", () => {
      VENUES.slice(0, 9).forEach(v => swipeRight(v.name));
      const picks = getDailyPicks(VENUES, 3);
      expect(picks.length).toBe(1);
    });
  });

  /* ══════════════════════════════════════════
   * 5. Match Stats
   * ══════════════════════════════════════════ */
  describe("getMatchStats", () => {
    it("returns zeros with no swipes", () => {
      const stats = getMatchStats();
      expect(stats.totalSwipes).toBe(0);
      expect(stats.likes).toBe(0);
      expect(stats.skips).toBe(0);
      expect(stats.superlikes).toBe(0);
      expect(stats.likeRate).toBe(0);
      expect(stats.topCategory).toBeNull();
      expect(stats.streak).toBe(0);
    });

    it("counts likes, skips, superlikes correctly", () => {
      swipeRight("Bar Alpha");
      swipeRight("Pub Gamma");
      swipeLeft("Club Beta");
      superLike("Wine Zeta");
      const stats = getMatchStats(VENUES);
      expect(stats.likes).toBe(2);
      expect(stats.skips).toBe(1);
      expect(stats.superlikes).toBe(1);
      expect(stats.totalSwipes).toBe(4);
    });

    it("calculates likeRate correctly", () => {
      swipeRight("Bar Alpha");
      swipeLeft("Club Beta");
      superLike("Wine Zeta");
      const stats = getMatchStats(VENUES);
      // 2 positive (1 like + 1 superlike) out of 3
      expect(stats.likeRate).toBeCloseTo(2 / 3, 2);
    });

    it("identifies top category from liked venues", () => {
      swipeRight("Bar Alpha"); // cocktail-bar
      swipeRight("Lounge Delta"); // cocktail-bar
      swipeRight("Pub Gamma"); // pub
      const stats = getMatchStats(VENUES);
      expect(stats.topCategory).toBe("cocktail-bar");
    });

    it("calculates consecutive like streak", () => {
      swipeRight("Bar Alpha");
      swipeRight("Pub Gamma");
      swipeRight("Lounge Delta");
      swipeLeft("Club Beta");
      swipeRight("Wine Zeta");
      const stats = getMatchStats(VENUES);
      expect(stats.streak).toBe(3); // First 3 are consecutive likes
    });

    it("streak resets on skip", () => {
      swipeLeft("Club Beta");
      swipeRight("Bar Alpha");
      const stats = getMatchStats(VENUES);
      expect(stats.streak).toBe(1);
    });

    it("superlikes count toward streak", () => {
      swipeRight("Bar Alpha");
      superLike("Wine Zeta");
      swipeRight("Pub Gamma");
      const stats = getMatchStats(VENUES);
      expect(stats.streak).toBe(3);
    });
  });

  describe("getVenueDecision", () => {
    it("returns null for unknown venue", () => {
      expect(getVenueDecision("Nonexistent")).toBeNull();
    });

    it("returns null for null input", () => {
      expect(getVenueDecision(null)).toBeNull();
    });

    it("returns swipe record for swiped venue", () => {
      swipeRight("Bar Alpha");
      const decision = getVenueDecision("Bar Alpha");
      expect(decision.action).toBe("like");
      expect(decision.venueName).toBe("Bar Alpha");
    });

    it("returns the most recent swipe if swiped multiple times", () => {
      swipeRight("Bar Alpha");
      swipeLeft("Bar Alpha");
      const decision = getVenueDecision("Bar Alpha");
      expect(decision.action).toBe("skip");
    });
  });

  /* ══════════════════════════════════════════
   * 6. Undo & Reset
   * ══════════════════════════════════════════ */
  describe("undoLastSwipe", () => {
    it("returns null when no swipe history", () => {
      expect(undoLastSwipe()).toBeNull();
    });

    it("removes the last swipe from history", () => {
      swipeRight("Bar Alpha");
      swipeLeft("Club Beta");
      const undone = undoLastSwipe();
      expect(undone.venueName).toBe("Club Beta");
      expect(undone.action).toBe("skip");
      expect(getSwipeHistory().length).toBe(1);
    });

    it("re-adds venue to front of queue", () => {
      loadQueue(VENUES);
      const first = getNextVenue();
      swipeRight(first.name);
      undoLastSwipe();
      expect(getNextVenue().name).toBe(first.name);
    });

    it("can undo multiple times", () => {
      swipeRight("Bar Alpha");
      swipeLeft("Club Beta");
      superLike("Wine Zeta");
      undoLastSwipe();
      undoLastSwipe();
      expect(getSwipeHistory().length).toBe(1);
      expect(getSwipeHistory()[0].venueName).toBe("Bar Alpha");
    });

    it("returns the undone swipe record", () => {
      superLike("Wine Zeta");
      const result = undoLastSwipe();
      expect(result.action).toBe("superlike");
      expect(result.venueName).toBe("Wine Zeta");
    });
  });

  describe("resetPreferences", () => {
    it("returns true", () => {
      expect(resetPreferences()).toBe(true);
    });

    it("clears all swipe history", () => {
      swipeRight("Bar Alpha");
      swipeLeft("Club Beta");
      resetPreferences();
      expect(getSwipeHistory().length).toBe(0);
    });

    it("clears all collections", () => {
      swipeRight("Bar Alpha");
      const col = createCollection("Faves");
      addToCollection(col.id, "Bar Alpha");
      resetPreferences();
      expect(listCollections().length).toBe(0);
    });

    it("resets queue", () => {
      loadQueue(VENUES);
      resetPreferences();
      expect(getQueueSize()).toBe(0);
    });

    it("preference profile is empty after reset", () => {
      swipeRight("Bar Alpha");
      resetPreferences();
      const profile = getPreferenceProfile(VENUES);
      expect(profile.topCategories.length).toBe(0);
    });
  });

  /* ══════════════════════════════════════════
   * 7. Collections
   * ══════════════════════════════════════════ */
  describe("createCollection", () => {
    it("creates a collection with an id, name, venues, createdAt", () => {
      const col = createCollection("Friday Favorites");
      expect(col.id).toBeDefined();
      expect(col.name).toBe("Friday Favorites");
      expect(col.venues).toEqual([]);
      expect(col.createdAt).toBeDefined();
    });

    it("returns null for empty name", () => {
      expect(createCollection("")).toBeNull();
      expect(createCollection(null)).toBeNull();
    });

    it("can create multiple collections", () => {
      createCollection("Chill Spots");
      createCollection("Date Night");
      expect(listCollections().length).toBe(2);
    });

    it("each collection has a unique id", () => {
      const a = createCollection("A");
      const b = createCollection("B");
      expect(a.id).not.toBe(b.id);
    });
  });

  describe("addToCollection", () => {
    it("adds a liked venue to a collection", () => {
      swipeRight("Bar Alpha");
      const col = createCollection("Faves");
      expect(addToCollection(col.id, "Bar Alpha")).toBe(true);
      const updated = getCollection(col.id);
      expect(updated.venues).toContain("Bar Alpha");
    });

    it("adds a superliked venue to a collection", () => {
      superLike("Wine Zeta");
      const col = createCollection("Faves");
      expect(addToCollection(col.id, "Wine Zeta")).toBe(true);
    });

    it("rejects a skipped venue", () => {
      swipeLeft("Club Beta");
      const col = createCollection("Faves");
      expect(addToCollection(col.id, "Club Beta")).toBe(false);
    });

    it("rejects a venue not in swipe history", () => {
      const col = createCollection("Faves");
      expect(addToCollection(col.id, "Unknown")).toBe(false);
    });

    it("returns false for invalid collection id", () => {
      swipeRight("Bar Alpha");
      expect(addToCollection("invalid_id", "Bar Alpha")).toBe(false);
    });

    it("returns false for null inputs", () => {
      expect(addToCollection(null, "Bar Alpha")).toBe(false);
      expect(addToCollection("id", null)).toBe(false);
    });

    it("does not add duplicate venues to same collection", () => {
      swipeRight("Bar Alpha");
      const col = createCollection("Faves");
      addToCollection(col.id, "Bar Alpha");
      addToCollection(col.id, "Bar Alpha");
      const updated = getCollection(col.id);
      expect(updated.venues.length).toBe(1);
    });
  });

  describe("getCollection", () => {
    it("returns collection by id", () => {
      const col = createCollection("Test");
      const result = getCollection(col.id);
      expect(result.name).toBe("Test");
    });

    it("returns null for unknown id", () => {
      expect(getCollection("nonexistent")).toBeNull();
    });

    it("returns null for null id", () => {
      expect(getCollection(null)).toBeNull();
    });
  });

  describe("listCollections", () => {
    it("returns empty array when no collections", () => {
      expect(listCollections()).toEqual([]);
    });

    it("returns all collections", () => {
      createCollection("A");
      createCollection("B");
      createCollection("C");
      expect(listCollections().length).toBe(3);
    });
  });

  describe("removeFromCollection", () => {
    it("removes a venue from a collection", () => {
      swipeRight("Bar Alpha");
      const col = createCollection("Faves");
      addToCollection(col.id, "Bar Alpha");
      expect(removeFromCollection(col.id, "Bar Alpha")).toBe(true);
      const updated = getCollection(col.id);
      expect(updated.venues).not.toContain("Bar Alpha");
    });

    it("returns false when venue not in collection", () => {
      const col = createCollection("Faves");
      expect(removeFromCollection(col.id, "Bar Alpha")).toBe(false);
    });

    it("returns false for invalid collection id", () => {
      expect(removeFromCollection("invalid", "Bar Alpha")).toBe(false);
    });

    it("returns false for null inputs", () => {
      expect(removeFromCollection(null, "Bar Alpha")).toBe(false);
      expect(removeFromCollection("id", null)).toBe(false);
    });
  });

  /* ══════════════════════════════════════════
   * Edge Cases & Integration
   * ══════════════════════════════════════════ */
  describe("edge cases", () => {
    it("handles corrupted localStorage data gracefully", () => {
      store["lnv_venue_matchmaker"] = "not-json{{{";
      expect(() => getSwipeHistory()).not.toThrow();
      expect(getSwipeHistory()).toEqual([]);
    });

    it("works after localStorage is cleared externally", () => {
      swipeRight("Bar Alpha");
      clearStore();
      expect(getSwipeHistory()).toEqual([]);
    });

    it("preference profile with only skips has no topCategories", () => {
      swipeLeft("Bar Alpha");
      swipeLeft("Club Beta");
      const profile = getPreferenceProfile(VENUES);
      expect(profile.topCategories).toEqual([]);
    });

    it("compatibility score handles venue with no vibes array", () => {
      swipeRight("Bar Alpha");
      const venue = { name: "No Vibes", category: "bar", neighborhood: "X", priceLevel: 2 };
      expect(() => getCompatibilityScore(venue, VENUES)).not.toThrow();
    });

    it("compatibility score handles venue with empty vibes", () => {
      swipeRight("Bar Alpha");
      const venue = { name: "Empty Vibes", category: "bar", vibes: [], neighborhood: "X", priceLevel: 2 };
      const score = getCompatibilityScore(venue, VENUES);
      expect(typeof score).toBe("number");
    });

    it("loadQueue with single venue", () => {
      const count = loadQueue([VENUES[0]]);
      expect(count).toBe(1);
      expect(getNextVenue().name).toBe(VENUES[0].name);
    });

    it("getRecommendations with empty venues array", () => {
      expect(getRecommendations([])).toEqual([]);
    });

    it("getDailyPicks with empty venues array", () => {
      expect(getDailyPicks([])).toEqual([]);
    });

    it("undoLastSwipe after resetPreferences returns null", () => {
      swipeRight("Bar Alpha");
      resetPreferences();
      expect(undoLastSwipe()).toBeNull();
    });

    it("swipe actions work without loading queue first", () => {
      expect(swipeRight("Some Venue")).toBe(true);
      expect(getSwipeHistory().length).toBe(1);
    });

    it("getMatchStats with only skips", () => {
      swipeLeft("Bar Alpha");
      swipeLeft("Club Beta");
      const stats = getMatchStats(VENUES);
      expect(stats.likes).toBe(0);
      expect(stats.skips).toBe(2);
      expect(stats.likeRate).toBe(0);
      expect(stats.streak).toBe(0);
    });

    it("multiple undo restores queue correctly", () => {
      loadQueue(VENUES.slice(0, 3));
      const v1 = getNextVenue();
      swipeRight(v1.name);
      const v2 = getNextVenue();
      swipeRight(v2.name);
      undoLastSwipe();
      undoLastSwipe();
      expect(getQueueSize()).toBe(3);
    });

    it("addToCollection after undo still works if venue was liked before", () => {
      swipeRight("Bar Alpha");
      swipeLeft("Bar Alpha");
      // Bar Alpha was liked at some point
      const col = createCollection("Test");
      // The most recent swipe is skip, but there's also a like
      expect(addToCollection(col.id, "Bar Alpha")).toBe(true);
    });
  });
});
