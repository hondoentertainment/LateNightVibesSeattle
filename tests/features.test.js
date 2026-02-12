import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getViabilityBadges,
  getTrustBadge,
  estimateTravelMinutes,
  estimateTravelFromDistance,
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
  it("returns 5 when same area", () => {
    const a = { Area: "Capitol Hill" };
    const b = { Area: "Capitol Hill" };
    expect(estimateTravelMinutes(a, b)).toBe(5);
  });

  it("returns 15 when different area", () => {
    const a = { Area: "Capitol Hill" };
    const b = { Area: "Ballard" };
    expect(estimateTravelMinutes(a, b)).toBe(15);
  });

  it("handles empty/missing Area", () => {
    expect(estimateTravelMinutes({ Area: "" }, { Area: "Capitol Hill" })).toBe(15);
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
