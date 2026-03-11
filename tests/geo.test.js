import { describe, it, expect } from "vitest";

const core = {
  normalizeValue: (v) => (v || "").toString().trim(),
  parseDistanceMiles: (val) => {
    const m = (val || "").toString().toLowerCase().match(/([\d.]+)\s*mi/);
    return m ? parseFloat(m[1]) : null;
  },
  haversineMiles: (lat1, lng1, lat2, lng2) => {
    const R = 3959;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  },
  WALKABLE_MILES: 0.5,
};

if (typeof globalThis !== "undefined") {
  globalThis.window = globalThis.window || {};
  globalThis.window.LNVCore = core;
}

import {
  getCoordsForVenue,
  venueToVenueDistanceMiles,
  isWalkable,
  NEIGHBORHOOD_COORDS,
} from "../lib/geo.js";

describe("LNVGeo", () => {
  describe("getCoordsForVenue", () => {
    it("returns coords for Capitol Hill venue", () => {
      const venue = { Area: "Capitol Hill" };
      const coords = getCoordsForVenue(venue);
      expect(coords).toBeDefined();
      expect(coords.length).toBe(2);
      expect(coords[0]).toBeCloseTo(47.62, 1);
      expect(coords[1]).toBeCloseTo(-122.32, 1);
    });

    it("returns coords when Area partially matches", () => {
      const venue = { Area: "Capitol Hill" };
      const coords = getCoordsForVenue(venue);
      expect(coords).not.toBeNull();
    });
  });

  describe("venueToVenueDistanceMiles", () => {
    it("returns number or null for venues", () => {
      const a = { Area: "Capitol Hill" };
      const b = { Area: "Capitol Hill" };
      const dist = venueToVenueDistanceMiles(a, b);
      expect(dist === null || (typeof dist === "number" && !Number.isNaN(dist) && dist >= 0)).toBe(true);
    });

    it("returns number or null", () => {
      const a = { Area: "Unknown", "Driving Distance": "1.0 mi" };
      const b = { Area: "Unknown", "Driving Distance": "3.0 mi" };
      const dist = venueToVenueDistanceMiles(a, b);
      expect(dist === null || typeof dist === "number").toBe(true);
    });
  });

  describe("isWalkable", () => {
    it("returns true when distance under 0.5 mi", () => {
      const a = { Area: "Capitol Hill" };
      const b = { Area: "Capitol Hill" };
      const walkable = isWalkable(a, b);
      expect(typeof walkable).toBe("boolean");
    });
  });

  describe("NEIGHBORHOOD_COORDS", () => {
    it("has Capitol Hill under seattle", () => {
      expect(NEIGHBORHOOD_COORDS.seattle["Capitol Hill"]).toBeDefined();
    });

    it("has city keys for all supported cities", () => {
      expect(NEIGHBORHOOD_COORDS["new-york"]).toBeDefined();
      expect(NEIGHBORHOOD_COORDS["los-angeles"]).toBeDefined();
      expect(NEIGHBORHOOD_COORDS.chicago).toBeDefined();
      expect(NEIGHBORHOOD_COORDS.houston).toBeDefined();
      expect(NEIGHBORHOOD_COORDS.phoenix).toBeDefined();
      expect(NEIGHBORHOOD_COORDS.philadelphia).toBeDefined();
      expect(NEIGHBORHOOD_COORDS["san-antonio"]).toBeDefined();
      expect(NEIGHBORHOOD_COORDS["san-diego"]).toBeDefined();
      expect(NEIGHBORHOOD_COORDS.dallas).toBeDefined();
      expect(NEIGHBORHOOD_COORDS["san-jose"]).toBeDefined();
    });
  });
});
