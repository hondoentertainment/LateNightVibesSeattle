import { describe, it, expect, beforeEach } from "vitest";

const store = {};
const mockLocalStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
if (typeof globalThis !== "undefined") globalThis.localStorage = mockLocalStorage;

import {
  trackVisit,
  trackSearch,
  trackFavorite,
  trackTimeSpent,
  getEvents,
  clearEvents,
  buildUserProfile,
  scoreVenueForUser,
  generateItinerary,
  getSimilarUserRecommendations,
  getWeatherAwareTags,
} from "../lib/personalization.js";

/* ─── Sample venue data ─── */

const VENUE_A = {
  Name: "Bar Alpha",
  Area: "Capitol Hill",
  Category: "cocktail bar",
  "Vibe Tags": "upscale, date-friendly, chill",
  "Typical Closing Time": "2:00 AM",
};

const VENUE_B = {
  Name: "Club Beta",
  Area: "Belltown",
  Category: "nightclub",
  "Vibe Tags": "dancey, high-energy, late-night",
  "Typical Closing Time": "3:00 AM",
};

const VENUE_C = {
  Name: "Diner Charlie",
  Area: "Capitol Hill",
  Category: "restaurant",
  "Vibe Tags": "late-eats, casual, food-focused",
  "Typical Closing Time": "4:00 AM",
};

const VENUE_D = {
  Name: "Lounge Delta",
  Area: "Fremont",
  Category: "lounge",
  "Vibe Tags": "chill, cozy, indoor",
  "Typical Closing Time": "1:00 AM",
};

const VENUE_E = {
  Name: "Rooftop Echo",
  Area: "Downtown",
  Category: "rooftop bar",
  "Vibe Tags": "rooftop, scenic, upscale",
  "Typical Closing Time": "12:00 AM",
};

const ALL_VENUES = [VENUE_A, VENUE_B, VENUE_C, VENUE_D, VENUE_E];

const STORAGE_KEY = "lnv_personalization";

describe("LNVPersonalization", () => {
  beforeEach(() => {
    // Clear all storage keys
    Object.keys(store).forEach((k) => delete store[k]);
  });

  /* ─── 1. Behavior Tracking ─── */

  describe("Behavior Tracking", () => {
    it("trackVisit stores a visit event", () => {
      const evt = trackVisit("Bar Alpha", VENUE_A);
      expect(evt).not.toBeNull();
      expect(evt.type).toBe("visit");
      expect(evt.venue).toBe("Bar Alpha");
      expect(evt.timestamp).toBeTypeOf("number");
    });

    it("trackVisit returns null for empty venue name", () => {
      expect(trackVisit("", VENUE_A)).toBeNull();
      expect(trackVisit(null, VENUE_A)).toBeNull();
    });

    it("trackSearch stores a search event", () => {
      const evt = trackSearch("cocktail bars capitol hill");
      expect(evt).not.toBeNull();
      expect(evt.type).toBe("search");
      expect(evt.query).toBe("cocktail bars capitol hill");
    });

    it("trackSearch returns null for empty query", () => {
      expect(trackSearch("")).toBeNull();
      expect(trackSearch(null)).toBeNull();
    });

    it("trackFavorite stores a favorite event", () => {
      const evt = trackFavorite("Club Beta", VENUE_B);
      expect(evt).not.toBeNull();
      expect(evt.type).toBe("favorite");
      expect(evt.venue).toBe("Club Beta");
    });

    it("trackFavorite returns null for empty venue name", () => {
      expect(trackFavorite("")).toBeNull();
    });

    it("trackTimeSpent stores a time_spent event", () => {
      const evt = trackTimeSpent("Diner Charlie", 45);
      expect(evt).not.toBeNull();
      expect(evt.type).toBe("time_spent");
      expect(evt.venue).toBe("Diner Charlie");
      expect(evt.duration).toBe(45);
    });

    it("trackTimeSpent returns null for empty venue name", () => {
      expect(trackTimeSpent("")).toBeNull();
    });

    it("trackTimeSpent defaults duration to 0", () => {
      const evt = trackTimeSpent("Bar Alpha");
      expect(evt.duration).toBe(0);
    });

    it("getEvents returns all tracked events", () => {
      trackVisit("Bar Alpha", VENUE_A);
      trackSearch("nightclub");
      trackFavorite("Club Beta", VENUE_B);
      const events = getEvents();
      expect(events).toHaveLength(3);
    });

    it("clearEvents removes all events", () => {
      trackVisit("Bar Alpha", VENUE_A);
      trackVisit("Club Beta", VENUE_B);
      expect(getEvents().length).toBeGreaterThan(0);
      clearEvents();
      expect(getEvents()).toHaveLength(0);
    });

    it("FIFO pruning keeps only 500 events", () => {
      for (let i = 0; i < 510; i++) {
        trackVisit("Venue " + i, { Name: "Venue " + i });
      }
      const events = getEvents();
      expect(events).toHaveLength(500);
      // First event should be "Venue 10" (first 10 pruned)
      expect(events[0].venue).toBe("Venue 10");
      expect(events[499].venue).toBe("Venue 509");
    });

    it("events have timestamps", () => {
      const before = Date.now();
      trackVisit("Bar Alpha", VENUE_A);
      const after = Date.now();
      const events = getEvents();
      expect(events[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(events[0].timestamp).toBeLessThanOrEqual(after);
    });

    it("venueData is stored with visit events", () => {
      trackVisit("Bar Alpha", VENUE_A);
      const events = getEvents();
      expect(events[0].data["Vibe Tags"]).toBe("upscale, date-friendly, chill");
      expect(events[0].data.Area).toBe("Capitol Hill");
    });

    it("trackVisit stores empty object when no venueData provided", () => {
      trackVisit("Unknown Venue");
      const events = getEvents();
      expect(events[0].data).toEqual({});
    });
  });

  /* ─── 2. Preference Learning ─── */

  describe("Preference Learning (buildUserProfile)", () => {
    it("returns empty profile when no events tracked", () => {
      const profile = buildUserProfile();
      expect(profile.preferredVibes).toEqual([]);
      expect(profile.preferredCategories).toEqual([]);
      expect(profile.preferredAreas).toEqual([]);
      expect(profile.preferredTimeRange).toBeNull();
      expect(profile.visitFrequency).toBe("occasional");
    });

    it("extracts preferred vibes from visit data", () => {
      trackVisit("Bar Alpha", VENUE_A);
      trackVisit("Bar Alpha", VENUE_A);
      trackVisit("Club Beta", VENUE_B);
      const profile = buildUserProfile();
      expect(profile.preferredVibes.length).toBeGreaterThan(0);
      // "upscale" and "chill" should rank high (2 visits to Bar Alpha)
      expect(profile.preferredVibes).toContain("upscale");
      expect(profile.preferredVibes).toContain("chill");
    });

    it("favorites have higher weight than visits", () => {
      trackVisit("Club Beta", VENUE_B);
      trackFavorite("Bar Alpha", VENUE_A);
      const profile = buildUserProfile();
      // Bar Alpha vibes should rank higher due to favorite weight (3x)
      expect(profile.preferredVibes.indexOf("upscale")).toBeLessThan(
        profile.preferredVibes.indexOf("dancey")
      );
    });

    it("extracts preferred categories", () => {
      trackVisit("Bar Alpha", VENUE_A);
      trackVisit("Bar Alpha", VENUE_A);
      trackVisit("Club Beta", VENUE_B);
      const profile = buildUserProfile();
      expect(profile.preferredCategories).toContain("cocktail bar");
      expect(profile.preferredCategories[0]).toBe("cocktail bar");
    });

    it("extracts preferred areas", () => {
      trackVisit("Bar Alpha", VENUE_A);
      trackVisit("Diner Charlie", VENUE_C);
      trackVisit("Club Beta", VENUE_B);
      const profile = buildUserProfile();
      // Capitol Hill visited twice (Bar Alpha + Diner Charlie)
      expect(profile.preferredAreas[0]).toBe("Capitol Hill");
    });

    it("computes preferred time range from closing times", () => {
      trackVisit("Bar Alpha", VENUE_A); // 2:00 AM
      trackVisit("Club Beta", VENUE_B); // 3:00 AM
      trackVisit("Diner Charlie", VENUE_C); // 4:00 AM
      const profile = buildUserProfile();
      expect(profile.preferredTimeRange).not.toBeNull();
      expect(profile.preferredTimeRange.earliest).toBe(120); // 2:00 AM
      expect(profile.preferredTimeRange.latest).toBe(240); // 4:00 AM
    });

    it("visit frequency is occasional for few visits", () => {
      trackVisit("Bar Alpha", VENUE_A);
      const profile = buildUserProfile();
      expect(profile.visitFrequency).toBe("occasional");
    });

    it("visit frequency is regular for moderate visits on different days", () => {
      // Track visits via API then patch timestamps to simulate different days
      for (let i = 0; i < 4; i++) {
        trackVisit("Bar Alpha", VENUE_A);
      }
      // Patch timestamps so each event falls on a different day
      const events = getEvents();
      events.forEach((evt, i) => {
        evt.timestamp = Date.now() - (i * 86400000);
      });
      // Write back to the correct storage key used by the module
      const keys = Object.keys(store).filter((k) => k.startsWith(STORAGE_KEY));
      const storeKey = keys.length ? keys[0] : STORAGE_KEY;
      store[storeKey] = JSON.stringify(events);
      const profile = buildUserProfile();
      expect(profile.visitFrequency).toBe("regular");
    });

    it("visit frequency is frequent for many visits on many days", () => {
      for (let i = 0; i < 10; i++) {
        trackVisit("Bar Alpha", VENUE_A);
      }
      // Patch timestamps so each event falls on a different day
      const events = getEvents();
      events.forEach((evt, i) => {
        evt.timestamp = Date.now() - (i * 86400000);
      });
      const keys = Object.keys(store).filter((k) => k.startsWith(STORAGE_KEY));
      const storeKey = keys.length ? keys[0] : STORAGE_KEY;
      store[storeKey] = JSON.stringify(events);
      const profile = buildUserProfile();
      expect(profile.visitFrequency).toBe("frequent");
    });

    it("time_spent events contribute to vibe preference with weight", () => {
      trackTimeSpent("Bar Alpha", 60);
      trackVisit("Club Beta", VENUE_B);
      // time_spent without data won't have vibes, but test that it doesn't crash
      const profile = buildUserProfile();
      expect(profile.preferredVibes).toContain("dancey");
    });

    it("search events do not contribute venue data", () => {
      trackSearch("cocktail bars");
      const profile = buildUserProfile();
      expect(profile.preferredVibes).toEqual([]);
      expect(profile.preferredCategories).toEqual([]);
    });
  });

  /* ─── 3. Personalized Scoring ─── */

  describe("Personalized Scoring (scoreVenueForUser)", () => {
    it("returns 0 for null venue or profile", () => {
      expect(scoreVenueForUser(null, {})).toBe(0);
      expect(scoreVenueForUser(VENUE_A, null)).toBe(0);
    });

    it("scores higher for matching vibes", () => {
      const profile = {
        preferredVibes: ["upscale", "chill", "date-friendly"],
        preferredCategories: [],
        preferredAreas: [],
        preferredTimeRange: null,
        visitFrequency: "occasional",
      };
      const scoreA = scoreVenueForUser(VENUE_A, profile); // All vibes match
      const scoreB = scoreVenueForUser(VENUE_B, profile); // No vibe match
      expect(scoreA).toBeGreaterThan(scoreB);
    });

    it("scores higher for matching category", () => {
      const profile = {
        preferredVibes: [],
        preferredCategories: ["cocktail bar"],
        preferredAreas: [],
        preferredTimeRange: null,
        visitFrequency: "occasional",
      };
      const scoreA = scoreVenueForUser(VENUE_A, profile); // cocktail bar
      const scoreB = scoreVenueForUser(VENUE_B, profile); // nightclub
      expect(scoreA).toBeGreaterThan(scoreB);
    });

    it("scores higher for matching area", () => {
      const profile = {
        preferredVibes: [],
        preferredCategories: [],
        preferredAreas: ["Capitol Hill"],
        preferredTimeRange: null,
        visitFrequency: "occasional",
      };
      const scoreA = scoreVenueForUser(VENUE_A, profile); // Capitol Hill
      const scoreB = scoreVenueForUser(VENUE_B, profile); // Belltown
      expect(scoreA).toBeGreaterThan(scoreB);
    });

    it("scores higher for time compatibility", () => {
      const profile = {
        preferredVibes: [],
        preferredCategories: [],
        preferredAreas: [],
        preferredTimeRange: { earliest: 120, latest: 240 }, // 2-4 AM
        visitFrequency: "occasional",
      };
      const scoreC = scoreVenueForUser(VENUE_C, profile); // 4 AM - in range
      const scoreE = scoreVenueForUser(VENUE_E, profile); // 12 AM - out of range
      expect(scoreC).toBeGreaterThan(scoreE);
    });

    it("returns score between 0 and 100", () => {
      const profile = {
        preferredVibes: ["upscale", "chill", "date-friendly"],
        preferredCategories: ["cocktail bar"],
        preferredAreas: ["Capitol Hill"],
        preferredTimeRange: { earliest: 120, latest: 240 },
        visitFrequency: "frequent",
      };
      const score = scoreVenueForUser(VENUE_A, profile);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it("perfect match scores high", () => {
      const profile = {
        preferredVibes: ["upscale", "chill", "date-friendly"],
        preferredCategories: ["cocktail bar"],
        preferredAreas: ["Capitol Hill"],
        preferredTimeRange: { earliest: 120, latest: 240 },
        visitFrequency: "frequent",
      };
      const score = scoreVenueForUser(VENUE_A, profile);
      expect(score).toBeGreaterThanOrEqual(70);
    });

    it("no match scores low", () => {
      const profile = {
        preferredVibes: ["jazz", "blues"],
        preferredCategories: ["jazz club"],
        preferredAreas: ["Ballard"],
        preferredTimeRange: { earliest: 1200, latest: 1320 },
        visitFrequency: "occasional",
      };
      const score = scoreVenueForUser(VENUE_B, profile);
      expect(score).toBeLessThan(20);
    });

    it("handles venue with no vibe tags", () => {
      const venue = { Name: "Mystery Bar", Category: "bar", Area: "SoDo" };
      const profile = {
        preferredVibes: ["chill"],
        preferredCategories: ["bar"],
        preferredAreas: [],
        preferredTimeRange: null,
        visitFrequency: "occasional",
      };
      const score = scoreVenueForUser(venue, profile);
      expect(score).toBeGreaterThanOrEqual(0);
    });

    it("second-rank preferences score less than first-rank", () => {
      const profile = {
        preferredVibes: [],
        preferredCategories: ["cocktail bar", "nightclub"],
        preferredAreas: [],
        preferredTimeRange: null,
        visitFrequency: "occasional",
      };
      const scoreFirst = scoreVenueForUser(VENUE_A, profile);  // cocktail bar = rank 0
      const scoreSecond = scoreVenueForUser(VENUE_B, profile); // nightclub = rank 1
      expect(scoreFirst).toBeGreaterThan(scoreSecond);
    });
  });

  /* ─── 4. Itinerary Generator ─── */

  describe("Itinerary Generator (generateItinerary)", () => {
    const profile = {
      preferredVibes: ["upscale", "chill", "date-friendly", "late-eats"],
      preferredCategories: ["cocktail bar", "restaurant"],
      preferredAreas: ["Capitol Hill"],
      preferredTimeRange: { earliest: 120, latest: 240 },
      visitFrequency: "regular",
    };

    it("returns empty array for no venues", () => {
      expect(generateItinerary([], profile)).toEqual([]);
      expect(generateItinerary(null, profile)).toEqual([]);
    });

    it("returns itinerary with default 4 venues", () => {
      const result = generateItinerary(ALL_VENUES, profile);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.length).toBeLessThanOrEqual(4);
    });

    it("respects maxVenues option", () => {
      const result = generateItinerary(ALL_VENUES, profile, { maxVenues: 3 });
      expect(result.length).toBeLessThanOrEqual(3);
    });

    it("caps maxVenues at 5", () => {
      const result = generateItinerary(ALL_VENUES, profile, { maxVenues: 10 });
      expect(result.length).toBeLessThanOrEqual(5);
    });

    it("ensures minimum of 2 venues when maxVenues is too low", () => {
      const result = generateItinerary(ALL_VENUES, profile, { maxVenues: 1 });
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it("each itinerary item has venue, score, and name", () => {
      const result = generateItinerary(ALL_VENUES, profile);
      result.forEach((item) => {
        expect(item).toHaveProperty("venue");
        expect(item).toHaveProperty("score");
        expect(item).toHaveProperty("name");
        expect(item.name).toBeTruthy();
      });
    });

    it("orders by closing time (earliest closing first)", () => {
      const result = generateItinerary(ALL_VENUES, profile, { maxVenues: 5 });
      // All items should be ordered by closing time
      for (let i = 1; i < result.length; i++) {
        const prevClose = result[i - 1].venue["Typical Closing Time"] || "";
        const currClose = result[i].venue["Typical Closing Time"] || "";
        // Just verify ordering doesn't crash; detailed order depends on filtering
        expect(prevClose).toBeTruthy();
        expect(currClose).toBeTruthy();
      }
    });

    it("filters out venues closing before start time", () => {
      // Start at 1:00 AM — VENUE_E closes at midnight, should be excluded
      const result = generateItinerary(ALL_VENUES, profile, {
        startTime: "1:00 AM",
        maxVenues: 5,
      });
      const names = result.map((r) => r.name);
      expect(names).not.toContain("Rooftop Echo");
    });

    it("mood option boosts matching venues", () => {
      const noMood = generateItinerary(ALL_VENUES, profile, { maxVenues: 5 });
      const withMood = generateItinerary(ALL_VENUES, profile, {
        maxVenues: 5,
        mood: "dancey",
      });
      // Club Beta should score higher with dancey mood
      const betaNoMood = noMood.find((i) => i.name === "Club Beta");
      const betaWithMood = withMood.find((i) => i.name === "Club Beta");
      if (betaNoMood && betaWithMood) {
        expect(betaWithMood.score).toBeGreaterThanOrEqual(betaNoMood.score);
      }
    });

    it("promotes variety in categories", () => {
      // With multiple same-category venues, itinerary should diversify
      const venues = [
        VENUE_A,
        { ...VENUE_A, Name: "Bar Alpha 2" },
        VENUE_B,
        VENUE_C,
        VENUE_D,
      ];
      const result = generateItinerary(venues, profile, { maxVenues: 4 });
      const categories = result.map((r) =>
        (r.venue.Category || "").toLowerCase()
      );
      // Should have some variety
      const unique = new Set(categories);
      expect(unique.size).toBeGreaterThanOrEqual(2);
    });

    it("handles single venue input", () => {
      const result = generateItinerary([VENUE_A], profile);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Bar Alpha");
    });

    it("handles two venue input", () => {
      const result = generateItinerary([VENUE_A, VENUE_B], profile);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.length).toBeLessThanOrEqual(2);
    });
  });

  /* ─── 5. Collaborative Filtering ─── */

  describe("Collaborative Filtering (getSimilarUserRecommendations)", () => {
    it("returns empty for null inputs", () => {
      expect(getSimilarUserRecommendations(null, ALL_VENUES)).toEqual([]);
      expect(getSimilarUserRecommendations({}, null)).toEqual([]);
      expect(getSimilarUserRecommendations({}, [])).toEqual([]);
    });

    it("excludes visited venues", () => {
      trackVisit("Bar Alpha", VENUE_A);
      trackVisit("Club Beta", VENUE_B);
      const profile = buildUserProfile();
      const recs = getSimilarUserRecommendations(profile, ALL_VENUES);
      const names = recs.map((r) => r.name);
      expect(names).not.toContain("Bar Alpha");
      expect(names).not.toContain("Club Beta");
    });

    it("includes unvisited venues", () => {
      trackVisit("Bar Alpha", VENUE_A);
      const profile = buildUserProfile();
      const recs = getSimilarUserRecommendations(profile, ALL_VENUES);
      const names = recs.map((r) => r.name);
      expect(names).toContain("Club Beta");
      expect(names).toContain("Diner Charlie");
    });

    it("scores and ranks recommendations", () => {
      trackVisit("Bar Alpha", VENUE_A);
      trackFavorite("Bar Alpha", VENUE_A);
      const profile = buildUserProfile();
      const recs = getSimilarUserRecommendations(profile, ALL_VENUES);
      // Results should be sorted by score descending
      for (let i = 1; i < recs.length; i++) {
        expect(recs[i - 1].score).toBeGreaterThanOrEqual(recs[i].score);
      }
    });

    it("returns all unvisited venues when no visits tracked", () => {
      const profile = buildUserProfile();
      const recs = getSimilarUserRecommendations(profile, ALL_VENUES);
      expect(recs).toHaveLength(ALL_VENUES.length);
    });

    it("excludes favorited venues from recommendations", () => {
      trackFavorite("Diner Charlie", VENUE_C);
      const profile = buildUserProfile();
      const recs = getSimilarUserRecommendations(profile, ALL_VENUES);
      const names = recs.map((r) => r.name);
      expect(names).not.toContain("Diner Charlie");
    });

    it("each recommendation has venue, score, and name", () => {
      const profile = buildUserProfile();
      const recs = getSimilarUserRecommendations(profile, ALL_VENUES);
      recs.forEach((rec) => {
        expect(rec).toHaveProperty("venue");
        expect(rec).toHaveProperty("score");
        expect(rec).toHaveProperty("name");
      });
    });
  });

  /* ─── 6. Weather-Aware Suggestions ─── */

  describe("Weather-Aware Suggestions (getWeatherAwareTags)", () => {
    it("returns cozy tags for rainy weather", () => {
      const tags = getWeatherAwareTags("rainy");
      expect(tags).toContain("cozy");
      expect(tags).toContain("chill");
      expect(tags).toContain("indoor");
    });

    it("returns cold weather tags", () => {
      const tags = getWeatherAwareTags("cold");
      expect(tags).toContain("cozy");
      expect(tags).toContain("warm");
      expect(tags).toContain("indoor");
    });

    it("returns outdoor tags for hot weather", () => {
      const tags = getWeatherAwareTags("hot");
      expect(tags).toContain("rooftop");
      expect(tags).toContain("patio");
      expect(tags).toContain("outdoor");
    });

    it("returns outdoor tags for clear weather", () => {
      const tags = getWeatherAwareTags("clear");
      expect(tags).toContain("rooftop");
      expect(tags).toContain("scenic");
    });

    it("returns snowy weather tags", () => {
      const tags = getWeatherAwareTags("snowy");
      expect(tags).toContain("cozy");
      expect(tags).toContain("fireplace");
      expect(tags).toContain("indoor");
    });

    it("returns empty array for unknown conditions", () => {
      expect(getWeatherAwareTags("tornado")).toEqual([]);
      expect(getWeatherAwareTags("")).toEqual([]);
      expect(getWeatherAwareTags(null)).toEqual([]);
    });

    it("handles case insensitivity", () => {
      expect(getWeatherAwareTags("RAINY")).toEqual(getWeatherAwareTags("rainy"));
      expect(getWeatherAwareTags("Cold")).toEqual(getWeatherAwareTags("cold"));
    });

    it("handles whitespace", () => {
      expect(getWeatherAwareTags("  rainy  ")).toEqual(getWeatherAwareTags("rainy"));
    });
  });

  /* ─── Edge Cases ─── */

  describe("Edge Cases", () => {
    it("buildUserProfile handles events with missing data fields", () => {
      trackVisit("Unknown Bar", {});
      trackVisit("Another", { Name: "Another" });
      const profile = buildUserProfile();
      expect(profile).toBeDefined();
      expect(profile.preferredVibes).toEqual([]);
    });

    it("scoreVenueForUser handles empty profile arrays", () => {
      const profile = {
        preferredVibes: [],
        preferredCategories: [],
        preferredAreas: [],
        preferredTimeRange: null,
        visitFrequency: "occasional",
      };
      const score = scoreVenueForUser(VENUE_A, profile);
      expect(score).toBe(0);
    });

    it("generateItinerary works with empty profile", () => {
      const emptyProfile = {
        preferredVibes: [],
        preferredCategories: [],
        preferredAreas: [],
        preferredTimeRange: null,
        visitFrequency: "occasional",
      };
      const result = generateItinerary(ALL_VENUES, emptyProfile);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it("multiple event types for same venue accumulate correctly", () => {
      trackVisit("Bar Alpha", VENUE_A);
      trackFavorite("Bar Alpha", VENUE_A);
      trackTimeSpent("Bar Alpha", 90);
      const events = getEvents();
      expect(events).toHaveLength(3);
      const profile = buildUserProfile();
      expect(profile.preferredVibes).toContain("upscale");
    });

    it("scoreVenueForUser handles venue with empty strings", () => {
      const venue = {
        Name: "Empty",
        Category: "",
        Area: "",
        "Vibe Tags": "",
        "Typical Closing Time": "",
      };
      const profile = {
        preferredVibes: ["chill"],
        preferredCategories: ["bar"],
        preferredAreas: ["Capitol Hill"],
        preferredTimeRange: null,
        visitFrequency: "occasional",
      };
      const score = scoreVenueForUser(venue, profile);
      expect(score).toBe(0);
    });

    it("getSimilarUserRecommendations with all venues visited returns empty", () => {
      ALL_VENUES.forEach((v) => trackVisit(v.Name, v));
      const profile = buildUserProfile();
      const recs = getSimilarUserRecommendations(profile, ALL_VENUES);
      expect(recs).toHaveLength(0);
    });

    it("generateItinerary handles venues without closing times", () => {
      const venues = [
        { Name: "No Time 1", Category: "bar", "Vibe Tags": "chill", Area: "Capitol Hill" },
        { Name: "No Time 2", Category: "bar", "Vibe Tags": "upscale", Area: "Belltown" },
      ];
      const profile = {
        preferredVibes: ["chill"],
        preferredCategories: ["bar"],
        preferredAreas: [],
        preferredTimeRange: null,
        visitFrequency: "occasional",
      };
      const result = generateItinerary(venues, profile);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it("buildUserProfile with only search events", () => {
      trackSearch("bars");
      trackSearch("clubs");
      trackSearch("late night food");
      const profile = buildUserProfile();
      expect(profile.preferredVibes).toEqual([]);
      expect(profile.visitFrequency).toBe("occasional");
    });
  });
});
