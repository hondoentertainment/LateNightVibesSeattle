import { describe, it, expect } from "vitest";
import {
  normalizeValue,
  parseTimeToMinutes,
  parseHHMM,
  minutesToLabel,
  parseDistanceMiles,
  getVibeSet,
  collectVibes,
} from "../lib/core.js";

describe("normalizeValue", () => {
  it("trims whitespace", () => {
    expect(normalizeValue("  hello  ")).toBe("hello");
  });

  it("converts numbers to string", () => {
    expect(normalizeValue(42)).toBe("42");
  });

  it("returns empty string for null", () => {
    expect(normalizeValue(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(normalizeValue(undefined)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(normalizeValue("")).toBe("");
  });

  it("handles zero", () => {
    expect(normalizeValue(0)).toBe("0");
  });
});

describe("parseTimeToMinutes", () => {
  it("parses 2:00 AM", () => {
    expect(parseTimeToMinutes("2:00 AM")).toBe(120);
  });

  it("parses 12:00 AM (midnight)", () => {
    expect(parseTimeToMinutes("12:00 AM")).toBe(0);
  });

  it("parses 12:00 PM (noon)", () => {
    expect(parseTimeToMinutes("12:00 PM")).toBe(720);
  });

  it("parses 9:00 PM", () => {
    expect(parseTimeToMinutes("9:00 PM")).toBe(1260);
  });

  it("parses 11:30 PM", () => {
    expect(parseTimeToMinutes("11:30 PM")).toBe(1410);
  });

  it("parses time without minutes (e.g. '2 AM')", () => {
    expect(parseTimeToMinutes("2 AM")).toBe(120);
  });

  it("parses lowercase am/pm", () => {
    expect(parseTimeToMinutes("2:00 am")).toBe(120);
    expect(parseTimeToMinutes("2:00 pm")).toBe(840);
  });

  it("returns null for invalid time strings", () => {
    expect(parseTimeToMinutes("")).toBeNull();
    expect(parseTimeToMinutes("Late")).toBeNull();
    expect(parseTimeToMinutes("unknown")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(parseTimeToMinutes(null)).toBeNull();
  });

  it("parses 1:00 AM", () => {
    expect(parseTimeToMinutes("1:00 AM")).toBe(60);
  });

  it("parses 12:30 PM", () => {
    expect(parseTimeToMinutes("12:30 PM")).toBe(750);
  });
});

describe("parseHHMM", () => {
  it("parses 21:00 to 1260 minutes", () => {
    expect(parseHHMM("21:00")).toBe(1260);
  });

  it("parses 00:00 to 0 minutes", () => {
    expect(parseHHMM("00:00")).toBe(0);
  });

  it("parses 02:30 to 150 minutes", () => {
    expect(parseHHMM("02:30")).toBe(150);
  });

  it("parses 23:59 to 1439 minutes", () => {
    expect(parseHHMM("23:59")).toBe(1439);
  });
});

describe("minutesToLabel", () => {
  it("formats 0 minutes as 12:00 AM", () => {
    expect(minutesToLabel(0)).toBe("12:00 AM");
  });

  it("formats 720 minutes as 12:00 PM", () => {
    expect(minutesToLabel(720)).toBe("12:00 PM");
  });

  it("formats 1260 minutes as 9:00 PM", () => {
    expect(minutesToLabel(1260)).toBe("9:00 PM");
  });

  it("formats 60 minutes as 1:00 AM", () => {
    expect(minutesToLabel(60)).toBe("1:00 AM");
  });

  it("formats 1410 minutes as 11:30 PM", () => {
    expect(minutesToLabel(1410)).toBe("11:30 PM");
  });

  it("handles values >= 1440 by wrapping around", () => {
    expect(minutesToLabel(1500)).toBe("1:00 AM"); // 1440 + 60
  });

  it("handles negative values by wrapping around", () => {
    expect(minutesToLabel(-60)).toBe("11:00 PM"); // -60 + 1440 = 1380
  });
});

describe("parseDistanceMiles", () => {
  it("parses '2.1 mi'", () => {
    expect(parseDistanceMiles("2.1 mi")).toBe(2.1);
  });

  it("parses '0.5 mi'", () => {
    expect(parseDistanceMiles("0.5 mi")).toBe(0.5);
  });

  it("parses '10 mi'", () => {
    expect(parseDistanceMiles("10 mi")).toBe(10);
  });

  it("parses '3.7 miles'", () => {
    // regex matches 'mi' in 'miles' — this should work
    expect(parseDistanceMiles("3.7 miles")).toBe(3.7);
  });

  it("returns null for empty string", () => {
    expect(parseDistanceMiles("")).toBeNull();
  });

  it("returns null for non-distance strings", () => {
    expect(parseDistanceMiles("Distance TBD")).toBeNull();
    expect(parseDistanceMiles("unknown")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(parseDistanceMiles(null)).toBeNull();
  });

  it("handles extra whitespace", () => {
    expect(parseDistanceMiles("  2.1  mi  ")).toBe(2.1);
  });
});

describe("getVibeSet", () => {
  it("returns a Set of lowercase vibe tags", () => {
    const venue = { "Vibe Tags": "Chill, Dancey, Loud" };
    const vibes = getVibeSet(venue);
    expect(vibes).toEqual(new Set(["chill", "dancey", "loud"]));
  });

  it("handles empty vibe tags", () => {
    const venue = { "Vibe Tags": "" };
    const vibes = getVibeSet(venue);
    expect(vibes.size).toBe(0);
  });

  it("handles missing vibe tags", () => {
    const venue = {};
    const vibes = getVibeSet(venue);
    expect(vibes.size).toBe(0);
  });

  it("handles single vibe tag", () => {
    const venue = { "Vibe Tags": "upscale" };
    const vibes = getVibeSet(venue);
    expect(vibes).toEqual(new Set(["upscale"]));
  });

  it("trims whitespace from individual tags", () => {
    const venue = { "Vibe Tags": " chill , dancey , loud " };
    const vibes = getVibeSet(venue);
    expect(vibes).toEqual(new Set(["chill", "dancey", "loud"]));
  });
});

describe("collectVibes", () => {
  it("collects unique vibes across multiple venues", () => {
    const venues = [
      { "Vibe Tags": "chill, dancey" },
      { "Vibe Tags": "dancey, loud" },
      { "Vibe Tags": "upscale" },
    ];
    const vibes = collectVibes(venues);
    expect(vibes).toEqual(new Set(["chill", "dancey", "loud", "upscale"]));
  });

  it("returns empty set for empty venue list", () => {
    expect(collectVibes([]).size).toBe(0);
  });

  it("returns empty set when venues have no tags", () => {
    const venues = [{ "Vibe Tags": "" }, { "Vibe Tags": "" }];
    expect(collectVibes(venues).size).toBe(0);
  });
});
