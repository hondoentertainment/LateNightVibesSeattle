import { describe, it, expect } from "vitest";
import { encodeSharePlan, decodeSharePlan } from "../lib/share-plan.js";

function makeVenue(overrides = {}) {
  return {
    Name: "Test Bar",
    Area: "Capitol Hill",
    Category: "Cocktail Bar",
    "Typical Closing Time": "2:00 AM",
    "Google Maps Driving Link": "https://maps.example.com/bar",
    "Vibe Tags": "chill, date-friendly",
    "Driving Distance": "1.2 mi",
    ...overrides,
  };
}

describe("encodeSharePlan", () => {
  it("encodes stops with start and duration", () => {
    const stops = [makeVenue({ Name: "Bar A" }), makeVenue({ Name: "Bar B" })];
    const encoded = encodeSharePlan(stops, 22 * 60, 45);
    expect(typeof encoded).toBe("string");
    expect(encoded.length).toBeGreaterThan(0);
    expect(encoded).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it("produces valid base64 that decodes", () => {
    const stops = [makeVenue()];
    const encoded = encodeSharePlan(stops, 1260, 60);
    const decoded = decodeSharePlan(encoded);
    expect(decoded.start).toBe(1260);
    expect(decoded.dur).toBe(60);
    expect(decoded.s).toHaveLength(1);
    expect(decoded.s[0].n).toBe("Test Bar");
    expect(decoded.s[0].a).toBe("Capitol Hill");
  });
});

describe("decodeSharePlan", () => {
  it("decodes encoded plan to original structure", () => {
    const stops = [
      makeVenue({ Name: "Venue 1", Area: "Ballard" }),
      makeVenue({ Name: "Venue 2", "Google Maps Driving Link": "" }),
    ];
    const encoded = encodeSharePlan(stops, 21 * 60, 30);
    const decoded = decodeSharePlan(encoded);
    expect(decoded.s).toHaveLength(2);
    expect(decoded.s[0]).toEqual({ n: "Venue 1", a: "Ballard", c: "Cocktail Bar", t: "2:00 AM", l: "https://maps.example.com/bar" });
    expect(decoded.s[1].l).toBe("");
    expect(decoded.start).toBe(1260);
    expect(decoded.dur).toBe(30);
  });

  it("handles empty stops", () => {
    const encoded = encodeSharePlan([], 0, 60);
    const decoded = decodeSharePlan(encoded);
    expect(decoded.s).toEqual([]);
    expect(decoded.start).toBe(0);
    expect(decoded.dur).toBe(60);
  });

  it("normalizes venue values (trim, empty string for missing)", () => {
    const stops = [makeVenue({ Name: "  Trimmed  ", Area: "", "Typical Closing Time": null })];
    const encoded = encodeSharePlan(stops, 0, 0);
    const decoded = decodeSharePlan(encoded);
    expect(decoded.s[0].n).toBe("Trimmed");
    expect(decoded.s[0].a).toBe("");
  });
});

describe("encodeSharePlan + decodeSharePlan roundtrip", () => {
  it("roundtrips multi-stop plan", () => {
    const stops = [
      makeVenue({ Name: "First Stop" }),
      makeVenue({ Name: "Second Stop", Area: "Fremont" }),
    ];
    const encoded = encodeSharePlan(stops, 22 * 60, 40);
    const decoded = decodeSharePlan(encoded);
    expect(decoded.s[0].n).toBe("First Stop");
    expect(decoded.s[1].n).toBe("Second Stop");
    expect(decoded.s[1].a).toBe("Fremont");
    expect(decoded.start).toBe(22 * 60);
    expect(decoded.dur).toBe(40);
  });
});
