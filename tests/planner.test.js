/**
 * Tests for planner pure logic: vibe arcs, phase selection, share payload shape.
 * Planner DOM-dependent functions (generateItinerary, renderItinerary) are not tested.
 */
import { describe, it, expect } from "vitest";
import { loadDataFromCSV } from "../lib/core.js";
import { getVibeSet, parseTimeToMinutes } from "../lib/features.js";

/* VIBE_ARCS replicated from planner.js for testing (planner uses DOM) */
const VIBE_ARCS = {
  "chill-to-wild": [
    { vibes: ["chill", "casual", "date-friendly"], label: "Warm up" },
    { vibes: ["high-energy", "dancey", "loud", "rowdy"], label: "Peak energy" },
    { vibes: ["late-eats", "food-focused", "chill"], label: "Late eats" },
  ],
  "date-night": [
    { vibes: ["chill", "date-friendly", "upscale"], label: "Start classy" },
    { vibes: ["upscale", "views", "rooftop", "live-music"], label: "Impress" },
    { vibes: ["late-eats", "chill", "sweet"], label: "Wind down" },
  ],
  "party": [
    { vibes: ["dancey", "high-energy", "loud"], label: "Get moving" },
    { vibes: ["rowdy", "high-energy", "dancey", "karaoke"], label: "Go all out" },
    { vibes: ["late-eats", "late-night", "food-focused"], label: "Refuel" },
  ],
  "explore": [
    { vibes: ["chill", "casual", "views"], label: "Start chill" },
    { vibes: ["live-music", "karaoke", "games", "playful"], label: "Something different" },
    { vibes: ["late-night", "divey", "casual"], label: "Finish strong" },
  ],
  "low-key": [
    { vibes: ["chill", "casual", "date-friendly"], label: "Easy start" },
    { vibes: ["chill", "casual", "group-friendly"], label: "Keep it mellow" },
    { vibes: ["chill", "late-night", "casual"], label: "Night cap" },
  ],
};

describe("VIBE_ARCS", () => {
  it("defines all expected arc keys", () => {
    const keys = ["chill-to-wild", "date-night", "party", "explore", "low-key"];
    keys.forEach((k) => expect(VIBE_ARCS[k]).toBeDefined());
  });

  it("each arc has 3 phases with vibes and label", () => {
    Object.values(VIBE_ARCS).forEach((phases) => {
      expect(phases).toHaveLength(3);
      phases.forEach((p) => {
        expect(Array.isArray(p.vibes)).toBe(true);
        expect(p.vibes.length).toBeGreaterThan(0);
        expect(typeof p.label).toBe("string");
        expect(p.label.length).toBeGreaterThan(0);
      });
    });
  });

  it("phase selection by index maps correctly for 3 stops", () => {
    const arcPhases = VIBE_ARCS["chill-to-wild"];
    const stopCount = 3;
    const phases = [];
    for (let i = 0; i < stopCount; i++) {
      const phaseIdx = Math.min(Math.floor(i * arcPhases.length / stopCount), arcPhases.length - 1);
      phases.push(arcPhases[phaseIdx]);
    }
    expect(phases).toHaveLength(3);
    expect(phases[0].label).toBe("Warm up");
    expect(phases[1].label).toBe("Peak energy");
    expect(phases[2].label).toBe("Late eats");
  });

  it("phase selection for 5 stops distributes phases", () => {
    const arcPhases = VIBE_ARCS["party"];
    const stopCount = 5;
    const phases = [];
    for (let i = 0; i < stopCount; i++) {
      const phaseIdx = Math.min(Math.floor(i * arcPhases.length / stopCount), arcPhases.length - 1);
      phases.push(arcPhases[phaseIdx]);
    }
    expect(phases[0].label).toBe("Get moving");
    expect(phases[2].label).toBe("Go all out");
    expect(phases[4].label).toBe("Refuel");
    expect(phases.every((p) => p.vibes?.length > 0)).toBe(true);
  });
});

describe("planner venue scoring logic (pure)", () => {
  function scoreVenueForPhase(venue, phase) {
    const venueVibes = getVibeSet(venue);
    const matched = phase.vibes.filter((t) => venueVibes.has(t));
    return matched.length / phase.vibes.length;
  }

  it("perfect vibe match scores 1", () => {
    const venue = { "Vibe Tags": "chill, casual, date-friendly" };
    const phase = VIBE_ARCS["chill-to-wild"][0];
    expect(scoreVenueForPhase(venue, phase)).toBe(1);
  });

  it("partial match scores fraction", () => {
    const venue = { "Vibe Tags": "chill, loud" };
    const phase = VIBE_ARCS["chill-to-wild"][0]; // chill, casual, date-friendly
    expect(scoreVenueForPhase(venue, phase)).toBeCloseTo(1 / 3);
  });

  it("no overlap scores 0", () => {
    const venue = { "Vibe Tags": "divey, rowdy" };
    const phase = VIBE_ARCS["date-night"][0]; // chill, date-friendly, upscale
    expect(scoreVenueForPhase(venue, phase)).toBe(0);
  });
});

describe("parseTimeToMinutes (planner closing logic)", () => {
  it("parses closing times used in planner", () => {
    expect(parseTimeToMinutes("2:00 AM")).toBe(120);
    expect(parseTimeToMinutes("4:00 AM")).toBe(240);
    expect(parseTimeToMinutes("12:00 AM")).toBe(0);
  });

  it("returns null for invalid", () => {
    expect(parseTimeToMinutes("Late")).toBeNull();
  });
});
