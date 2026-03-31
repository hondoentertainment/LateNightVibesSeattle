import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getViabilityBadges,
  getTrustBadge,
  estimateTravelMinutes,
  estimateTravelFromDistance,
  isLateArrivalHour,
  getPeakHintForArea,
  getBestForVerdict,
  normalizeValue,
  parseTimeToMinutes,
  getVibeSet,
  DATASET_VERIFIED,
} from "../lib/features.js";

describe("normalizeValue (features)", () => {
  it("trims whitespace", () => {
    expect(normalizeValue("  hello  ")).toBe("hello");
  });
});

describe("parseTimeToMinutes (features)", () => {
  it("parses 2:00 AM", () => {
    expect(parseTimeToMinutes("2:00 AM")).toBe(120);
  });
  it("parses 9:00 PM", () => {
    expect(parseTimeToMinutes("9:00 PM")).toBe(1260);
  });
});

describe("getVibeSet (features)", () => {
  it("returns Set of lowercase tags", () => {
    const venue = { "Vibe Tags": "Chill, Dancey" };
    expect(getVibeSet(venue)).toEqual(new Set(["chill", "dancey"]));
  });
});

describe("getTrustBadge", () => {
  it("returns verified badge with current dataset date", () => {
    const badge = getTrustBadge();
    expect(badge).toEqual({ label: "Verified " + DATASET_VERIFIED, class: "trust-verified" });
  });
  it("uses DATASET_VERIFIED constant", () => {
    expect(DATASET_VERIFIED).toBe("Feb 2026");
  });
});

describe("estimateTravelMinutes", () => {
  it("returns small value for nearby venues with coords (haversine)", () => {
    const a = { Area: "Capitol Hill", Latitude: "47.6253", Longitude: "-122.3222" };
    const b = { Area: "Capitol Hill", Latitude: "47.6260", Longitude: "-122.3230" };
    const mins = estimateTravelMinutes(a, b, "seattle");
    // Very close (~0.06 mi) — should be a short walk, 2 min minimum
    expect(mins).toBeGreaterThanOrEqual(2);
    expect(mins).toBeLessThanOrEqual(5);
  });

  it("returns driving estimate for distant venues with coords", () => {
    // Capitol Hill to Ballard (~3.5 mi)
    const a = { Area: "Capitol Hill", Latitude: "47.6253", Longitude: "-122.3222" };
    const b = { Area: "Ballard", Latitude: "47.6677", Longitude: "-122.3846" };
    const mins = estimateTravelMinutes(a, b, "seattle");
    // ~3.5 mi * 2 + 3 = ~10 min
    expect(mins).toBeGreaterThanOrEqual(8);
    expect(mins).toBeLessThanOrEqual(15);
  });

  it("falls back to area heuristic when coords unavailable", () => {
    const a = { Area: "Unknown Place" };
    const b = { Area: "Unknown Place" };
    expect(estimateTravelMinutes(a, b, "seattle")).toBe(5);
  });

  it("falls back to 15 for different unknown areas", () => {
    const a = { Area: "Nowhere A" };
    const b = { Area: "Nowhere B" };
    expect(estimateTravelMinutes(a, b, "seattle")).toBe(15);
  });

  it("handles empty/missing Area with fallback", () => {
    expect(estimateTravelMinutes({ Area: "" }, { Area: "Unknown Zone" })).toBe(15);
  });
});

describe("estimateTravelFromDistance", () => {
  it("returns 12 when either distance is null", () => {
    expect(estimateTravelFromDistance(null, 2)).toBe(12);
    expect(estimateTravelFromDistance(2, null)).toBe(12);
  });

  it("returns 5 when same distance (delta 0)", () => {
    expect(estimateTravelFromDistance(1.0, 1.0)).toBe(5); // ceil(5 + 0)
  });

  it("scales with distance delta", () => {
    expect(estimateTravelFromDistance(0, 1)).toBe(9);   // 5 + 4
    expect(estimateTravelFromDistance(1, 3)).toBe(13);  // 5 + 8
  });
});

describe("getViabilityBadges", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("adds Cover likely for nightclub category", () => {
    vi.setSystemTime(new Date("2026-02-08T22:00:00")); // 10 PM
    const venue = {
      Category: "Nightclub",
      "Vibe Tags": "",
      "Typical Closing Time": "2:00 AM",
    };
    const badges = getViabilityBadges(venue);
    expect(badges.some((b) => b.label === "Cover likely")).toBe(true);
  });

  it("adds Kitchen open for late-eats when between 9pm and 30min before close", () => {
    vi.setSystemTime(new Date("2026-02-08T22:00:00")); // 10 PM
    const venue = {
      Category: "Bar",
      "Vibe Tags": "late-eats, chill",
      "Typical Closing Time": "2:00 AM", // 120 min, closeAdj = 120 + 1440 = 1560
    };
    const badges = getViabilityBadges(venue);
    expect(badges.some((b) => b.label === "Kitchen open")).toBe(true);
  });

  it("adds Kitchen closes in ~X min when within 30 min of kitchen close", () => {
    vi.setSystemTime(new Date("2026-02-08T01:20:00")); // 1:20 AM, 40 min before 2 AM close (kitchen ~30 min before)
    const venue = {
      Category: "Bar",
      "Vibe Tags": "late-eats, chill",
      "Typical Closing Time": "2:00 AM",
    };
    const badges = getViabilityBadges(venue);
    expect(badges.some((b) => b.label && b.label.startsWith("Kitchen closes in"))).toBe(true);
  });

  it("adds Likely busy for nightclub between 10pm–2am", () => {
    vi.setSystemTime(new Date("2026-02-08T23:30:00")); // 11:30 PM
    const venue = {
      Category: "Nightclub",
      "Vibe Tags": "",
      "Typical Closing Time": "2:00 AM",
    };
    const badges = getViabilityBadges(venue);
    expect(badges.some((b) => b.label === "Likely busy")).toBe(true);
  });

  it("adds Line risk for nightclub after 11pm", () => {
    vi.setSystemTime(new Date("2026-02-08T23:30:00")); // 11:30 PM
    const venue = {
      Category: "Nightclub",
      "Vibe Tags": "",
      "Typical Closing Time": "2:00 AM",
    };
    const badges = getViabilityBadges(venue);
    expect(badges.some((b) => b.label === "Line risk")).toBe(true);
  });

  it("returns no badges for a regular bar at 8pm", () => {
    vi.setSystemTime(new Date("2026-02-08T20:00:00")); // 8 PM
    const venue = {
      Category: "Bar",
      "Vibe Tags": "chill",
      "Typical Closing Time": "2:00 AM",
    };
    const badges = getViabilityBadges(venue);
    expect(badges).toHaveLength(0);
  });

  it("adds Likely busy for dancey+high-energy between 10pm–2am", () => {
    vi.setSystemTime(new Date("2026-02-08T23:00:00")); // 11 PM
    const venue = {
      Category: "Bar",
      "Vibe Tags": "dancey, high-energy",
      "Typical Closing Time": "2:00 AM",
    };
    const badges = getViabilityBadges(venue);
    expect(badges.some((b) => b.label === "Likely busy")).toBe(true);
  });
});

describe("isLateArrivalHour", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns true at 10 PM", () => {
    vi.setSystemTime(new Date("2026-02-08T22:00:00"));
    expect(isLateArrivalHour()).toBe(true);
  });

  it("returns true at 11:30 PM", () => {
    vi.setSystemTime(new Date("2026-02-08T23:30:00"));
    expect(isLateArrivalHour()).toBe(true);
  });

  it("returns false at 9 PM", () => {
    vi.setSystemTime(new Date("2026-02-08T21:00:00"));
    expect(isLateArrivalHour()).toBe(false);
  });
});

describe("getPeakHintForArea", () => {
  it("returns peak hint for Capitol Hill", () => {
    expect(getPeakHintForArea("Capitol Hill")).toContain("Peak");
  });

  it("returns peak hint for Belltown", () => {
    expect(getPeakHintForArea("Belltown")).toContain("Peak");
  });

  it("returns null for unknown area", () => {
    expect(getPeakHintForArea("Random Area")).toBeNull();
  });
});

describe("getBestForVerdict", () => {
  it("returns late eats when food-focused or late-eats in top vibes", () => {
    const verdict = getBestForVerdict([["late-eats", 5], ["chill", 3]], [["Restaurant", 2]]);
    expect(verdict).toContain("late eats");
  });

  it("returns dive bars when divey in top vibes", () => {
    const verdict = getBestForVerdict([["divey", 5], ["casual", 3]], []);
    expect(verdict).toContain("dive bars");
  });

  it("returns date night when upscale in top vibes", () => {
    const verdict = getBestForVerdict([["upscale", 5], ["date-friendly", 3]], []);
    expect(verdict).toContain("date night");
  });

  it("returns varied vibes when no strong signal", () => {
    const verdict = getBestForVerdict([["general", 1]], []);
    expect(verdict).toBe("varied vibes");
  });
});
