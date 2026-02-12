import { describe, it, expect } from "vitest";
import { computeRecommendations } from "../lib/core.js";

/* ─── Test fixtures ─── */

function makeVenue(overrides) {
  return {
    Name: "Test Venue",
    Area: "Capitol Hill",
    Category: "Bar",
    "Vibe Tags": "chill, casual",
    "Driving Distance": "2.0 mi",
    "Typical Closing Time": "2:00 AM",
    "Google Maps Driving Link": "",
    ...overrides,
  };
}

const baseVenue = makeVenue({
  Name: "Home Base",
  Area: "Capitol Hill",
  Category: "Cocktail Bar",
  "Vibe Tags": "chill, date-friendly, upscale",
  "Driving Distance": "0.0 mi",
});

const venues = [
  baseVenue,
  makeVenue({
    Name: "Identical Vibes Bar",
    Area: "Capitol Hill",
    Category: "Cocktail Bar",
    "Vibe Tags": "chill, date-friendly, upscale",
    "Driving Distance": "0.5 mi",
  }),
  makeVenue({
    Name: "Same Area Different Vibes",
    Area: "Capitol Hill",
    Category: "Dive Bar",
    "Vibe Tags": "divey, rowdy, loud",
    "Driving Distance": "0.3 mi",
  }),
  makeVenue({
    Name: "Far Away Same Vibes",
    Area: "Ballard",
    Category: "Cocktail Bar",
    "Vibe Tags": "chill, date-friendly, upscale",
    "Driving Distance": "8.0 mi",
  }),
  makeVenue({
    Name: "Different Everything",
    Area: "Georgetown",
    Category: "Nightclub",
    "Vibe Tags": "dancey, high-energy, loud",
    "Driving Distance": "5.0 mi",
  }),
  makeVenue({
    Name: "Partial Match",
    Area: "Fremont",
    Category: "Bar",
    "Vibe Tags": "chill, loud, games",
    "Driving Distance": "3.0 mi",
  }),
];

describe("computeRecommendations", () => {
  it("excludes the base venue from results", () => {
    const recs = computeRecommendations(venues, baseVenue, null, 10);
    const names = recs.map((r) => r.venue.Name);
    expect(names).not.toContain("Home Base");
  });

  it("returns at most maxResults items", () => {
    const recs = computeRecommendations(venues, baseVenue, null, 2);
    expect(recs.length).toBeLessThanOrEqual(2);
  });

  it("returns results sorted by score descending", () => {
    const recs = computeRecommendations(venues, baseVenue, null, 10);
    for (let i = 1; i < recs.length; i++) {
      expect(recs[i - 1].score).toBeGreaterThanOrEqual(recs[i].score);
    }
  });

  it("ranks identical vibes + same area + same category highest", () => {
    const recs = computeRecommendations(venues, baseVenue, null, 10);
    expect(recs[0].venue.Name).toBe("Identical Vibes Bar");
  });

  it("filters out venues beyond maxDist", () => {
    const recs = computeRecommendations(venues, baseVenue, 4, 10);
    const names = recs.map((r) => r.venue.Name);
    expect(names).not.toContain("Far Away Same Vibes"); // 8.0 mi
    expect(names).not.toContain("Different Everything"); // 5.0 mi
  });

  it("includes venues within maxDist", () => {
    const recs = computeRecommendations(venues, baseVenue, 4, 10);
    const names = recs.map((r) => r.venue.Name);
    expect(names).toContain("Identical Vibes Bar"); // 0.5 mi
    expect(names).toContain("Same Area Different Vibes"); // 0.3 mi
    expect(names).toContain("Partial Match"); // 3.0 mi
  });

  it("produces a breakdown with vibe, category, area, distance, and total", () => {
    const recs = computeRecommendations(venues, baseVenue, null, 10);
    const first = recs[0];
    expect(first.breakdown).toHaveProperty("vibe");
    expect(first.breakdown).toHaveProperty("category");
    expect(first.breakdown).toHaveProperty("area");
    expect(first.breakdown).toHaveProperty("distance");
    expect(first.breakdown).toHaveProperty("total");
    // All values should be numbers 0-100
    Object.values(first.breakdown).forEach((val) => {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(100);
    });
  });

  it("gives 100% vibe score when vibes are identical", () => {
    const recs = computeRecommendations(venues, baseVenue, null, 10);
    const identicalMatch = recs.find((r) => r.venue.Name === "Identical Vibes Bar");
    expect(identicalMatch.breakdown.vibe).toBe(100);
  });

  it("gives 0% vibe score when vibes are completely different", () => {
    const recs = computeRecommendations(venues, baseVenue, null, 10);
    const noOverlap = recs.find((r) => r.venue.Name === "Different Everything");
    expect(noOverlap.breakdown.vibe).toBe(0);
  });

  it("gives 100% category score for same category", () => {
    const recs = computeRecommendations(venues, baseVenue, null, 10);
    const sameCategory = recs.find((r) => r.venue.Name === "Identical Vibes Bar");
    expect(sameCategory.breakdown.category).toBe(100);
  });

  it("gives 0% category score for different category", () => {
    const recs = computeRecommendations(venues, baseVenue, null, 10);
    const diffCategory = recs.find((r) => r.venue.Name === "Different Everything");
    expect(diffCategory.breakdown.category).toBe(0);
  });

  it("gives 100% area score for same neighborhood", () => {
    const recs = computeRecommendations(venues, baseVenue, null, 10);
    const sameArea = recs.find((r) => r.venue.Name === "Same Area Different Vibes");
    expect(sameArea.breakdown.area).toBe(100);
  });

  it("gives 0% area score for different neighborhood", () => {
    const recs = computeRecommendations(venues, baseVenue, null, 10);
    const diffArea = recs.find((r) => r.venue.Name === "Different Everything");
    expect(diffArea.breakdown.area).toBe(0);
  });

  it("produces a human-readable reason string", () => {
    const recs = computeRecommendations(venues, baseVenue, null, 10);
    recs.forEach((r) => {
      expect(typeof r.reason).toBe("string");
      expect(r.reason.length).toBeGreaterThan(0);
    });
  });

  it("mentions shared vibes count in the reason when vibes overlap", () => {
    const recs = computeRecommendations(venues, baseVenue, null, 10);
    const identicalMatch = recs.find((r) => r.venue.Name === "Identical Vibes Bar");
    expect(identicalMatch.reason).toContain("shared vibe");
  });

  it("mentions 'Different vibe mix' when no vibes overlap", () => {
    const recs = computeRecommendations(venues, baseVenue, null, 10);
    const noOverlap = recs.find((r) => r.venue.Name === "Different Everything");
    expect(noOverlap.reason).toContain("Different vibe mix");
  });

  it("handles venues with no distance data gracefully", () => {
    const venuesWithMissing = [
      baseVenue,
      makeVenue({
        Name: "No Distance",
        "Driving Distance": "",
        "Vibe Tags": "chill",
      }),
    ];
    const recs = computeRecommendations(venuesWithMissing, baseVenue, null, 10);
    expect(recs).toHaveLength(1);
    expect(recs[0].venue.Name).toBe("No Distance");
    // Should use default distance score of 0.4
    expect(recs[0].breakdown.distance).toBe(40);
  });

  it("handles an empty venue list", () => {
    const recs = computeRecommendations([], baseVenue, null, 10);
    expect(recs).toEqual([]);
  });

  it("handles venue list containing only the base venue", () => {
    const recs = computeRecommendations([baseVenue], baseVenue, null, 10);
    expect(recs).toEqual([]);
  });

  it("returns empty array when maxResults is 0", () => {
    const recs = computeRecommendations(venues, baseVenue, null, 0);
    expect(recs).toEqual([]);
  });

  it("score weights sum to 1.0 (vibe=0.5 + cat=0.2 + area=0.2 + dist=0.1)", () => {
    // When everything matches perfectly, total should be 100%
    const perfectMatch = [
      baseVenue,
      makeVenue({
        Name: "Perfect Match",
        Area: "Capitol Hill",
        Category: "Cocktail Bar",
        "Vibe Tags": "chill, date-friendly, upscale",
        "Driving Distance": "0.0 mi",
      }),
    ];
    const recs = computeRecommendations(perfectMatch, baseVenue, 10, 1);
    expect(recs[0].breakdown.total).toBe(100);
  });
});
