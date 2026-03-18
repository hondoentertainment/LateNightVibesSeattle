import { describe, it, expect, beforeEach, vi } from "vitest";

const store = {};
const mockLocalStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
if (typeof globalThis !== "undefined") globalThis.localStorage = mockLocalStorage;

// Set up _lnvData for venue→neighborhood mapping (on globalThis for Node/test env)
globalThis._lnvData = [
  { Name: "Bar Alpha", Area: "Capitol Hill" },
  { Name: "Club Beta", Area: "Capitol Hill" },
  { Name: "Lounge Gamma", Area: "Ballard" },
  { Name: "Dive Delta", Area: "Fremont" },
  { Name: "Pub Epsilon", Area: "Ballard" },
];

import {
  getNeighborhoodHeat,
  getHeatScore,
  getHottestNeighborhoods,
  getVenueHeatContribution,
  refreshHeatData,
  _timeDecayWeight,
  _computeHeatData,
} from "../lib/vibe-heatmap.js";

import { postActivity, getFeed } from "../lib/social-feed.js";
import { submitPulseReport } from "../lib/venue-pulse.js";

function clearStore() {
  for (const key in store) { delete store[key]; }
}

describe("LNVVibeHeatmap", () => {
  beforeEach(() => {
    clearStore();
    vi.restoreAllMocks();
  });

  /* ─── _timeDecayWeight ─── */
  describe("_timeDecayWeight", () => {
    it("returns 1.0 for activity happening right now", () => {
      const now = Date.now();
      expect(_timeDecayWeight(now, now)).toBeCloseTo(1.0, 2);
    });

    it("returns lower weight for older activity", () => {
      const now = Date.now();
      const thirtyMinAgo = now - 30 * 60 * 1000;
      const weight = _timeDecayWeight(thirtyMinAgo, now);
      expect(weight).toBeLessThan(1.0);
      expect(weight).toBeGreaterThan(0.3);
    });

    it("returns very low weight for 2-hour-old activity", () => {
      const now = Date.now();
      const twoHoursAgo = now - 120 * 60 * 1000;
      const weight = _timeDecayWeight(twoHoursAgo, now);
      expect(weight).toBeLessThan(0.2);
      expect(weight).toBeGreaterThan(0);
    });

    it("returns higher weight for 10-min-old vs 60-min-old", () => {
      const now = Date.now();
      const tenMin = _timeDecayWeight(now - 10 * 60 * 1000, now);
      const sixtyMin = _timeDecayWeight(now - 60 * 60 * 1000, now);
      expect(tenMin).toBeGreaterThan(sixtyMin);
    });

    it("handles future timestamps gracefully (weight 1.0)", () => {
      const now = Date.now();
      const weight = _timeDecayWeight(now + 5000, now);
      expect(weight).toBeCloseTo(1.0, 2);
    });

    it("weight decreases monotonically with age", () => {
      const now = Date.now();
      let prevWeight = 1.0;
      for (let mins = 0; mins <= 120; mins += 10) {
        const w = _timeDecayWeight(now - mins * 60 * 1000, now);
        expect(w).toBeLessThanOrEqual(prevWeight + 0.001);
        prevWeight = w;
      }
    });
  });

  /* ─── getNeighborhoodHeat — no data ─── */
  describe("getNeighborhoodHeat — empty state", () => {
    it("returns empty array when no activity data exists", () => {
      const result = getNeighborhoodHeat();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });

  /* ─── getHeatScore ─── */
  describe("getHeatScore", () => {
    it("returns 0 for unknown neighborhood", () => {
      expect(getHeatScore("Nonexistent Neighborhood")).toBe(0);
    });

    it("returns 0 for null neighborhood", () => {
      expect(getHeatScore(null)).toBe(0);
    });

    it("returns 0 for empty string", () => {
      expect(getHeatScore("")).toBe(0);
    });

    it("returns a positive score when there is activity", () => {
      postActivity("u1", { type: "checkin", venueName: "Bar Alpha" });
      refreshHeatData();
      const score = getHeatScore("Capitol Hill");
      expect(score).toBeGreaterThan(0);
    });
  });

  /* ─── getHottestNeighborhoods ─── */
  describe("getHottestNeighborhoods", () => {
    it("returns empty array with no data", () => {
      refreshHeatData();
      expect(getHottestNeighborhoods()).toEqual([]);
    });

    it("defaults limit to 5", () => {
      // Create activity in multiple neighborhoods
      postActivity("u1", { type: "checkin", venueName: "Bar Alpha" });
      postActivity("u2", { type: "checkin", venueName: "Lounge Gamma" });
      postActivity("u3", { type: "checkin", venueName: "Dive Delta" });
      refreshHeatData();
      const result = getHottestNeighborhoods();
      expect(result.length).toBeLessThanOrEqual(5);
    });

    it("respects custom limit", () => {
      postActivity("u1", { type: "checkin", venueName: "Bar Alpha" });
      postActivity("u2", { type: "checkin", venueName: "Lounge Gamma" });
      postActivity("u3", { type: "checkin", venueName: "Dive Delta" });
      refreshHeatData();
      const result = getHottestNeighborhoods(2);
      expect(result.length).toBeLessThanOrEqual(2);
    });

    it("returns neighborhoods sorted by score descending", () => {
      // Capitol Hill gets more activity
      postActivity("u1", { type: "checkin", venueName: "Bar Alpha" });
      postActivity("u2", { type: "checkin", venueName: "Bar Alpha" });
      postActivity("u3", { type: "checkin", venueName: "Club Beta" });
      // Ballard gets less
      postActivity("u4", { type: "checkin", venueName: "Lounge Gamma" });
      refreshHeatData();
      const result = getHottestNeighborhoods(5);
      if (result.length >= 2) {
        expect(result[0].score).toBeGreaterThanOrEqual(result[1].score);
      }
    });
  });

  /* ─── getVenueHeatContribution ─── */
  describe("getVenueHeatContribution", () => {
    it("returns null for unknown venue", () => {
      expect(getVenueHeatContribution("Nonexistent Venue")).toBeNull();
    });

    it("returns null for null venueName", () => {
      expect(getVenueHeatContribution(null)).toBeNull();
    });

    it("returns contribution data for an active venue", () => {
      postActivity("u1", { type: "checkin", venueName: "Bar Alpha" });
      refreshHeatData();
      const contrib = getVenueHeatContribution("Bar Alpha");
      expect(contrib).not.toBeNull();
      expect(contrib.neighborhood).toBe("Capitol Hill");
      expect(typeof contrib.heat).toBe("number");
      expect(typeof contrib.social).toBe("number");
      expect(typeof contrib.music).toBe("number");
      expect(typeof contrib.pulse).toBe("number");
    });

    it("social contribution is positive when venue has check-ins", () => {
      postActivity("u1", { type: "checkin", venueName: "Bar Alpha" });
      refreshHeatData();
      const contrib = getVenueHeatContribution("Bar Alpha");
      expect(contrib.social).toBeGreaterThan(0);
    });
  });

  /* ─── refreshHeatData ─── */
  describe("refreshHeatData", () => {
    it("returns heat data object", () => {
      const data = refreshHeatData();
      expect(typeof data).toBe("object");
    });

    it("recalculates after new activity", () => {
      refreshHeatData();
      const before = getHeatScore("Capitol Hill");
      postActivity("u1", { type: "checkin", venueName: "Bar Alpha" });
      postActivity("u2", { type: "checkin", venueName: "Club Beta" });
      refreshHeatData();
      const after = getHeatScore("Capitol Hill");
      expect(after).toBeGreaterThanOrEqual(before);
    });
  });

  /* ─── Score normalization ─── */
  describe("score normalization", () => {
    it("scores are between 0 and 100", () => {
      postActivity("u1", { type: "checkin", venueName: "Bar Alpha" });
      postActivity("u2", { type: "checkin", venueName: "Club Beta" });
      postActivity("u3", { type: "checkin", venueName: "Lounge Gamma" });
      refreshHeatData();
      const all = getNeighborhoodHeat();
      all.forEach((h) => {
        expect(h.score).toBeGreaterThanOrEqual(0);
        expect(h.score).toBeLessThanOrEqual(100);
      });
    });

    it("highest scoring neighborhood gets 100", () => {
      // Create lots of activity in Capitol Hill
      for (let i = 0; i < 10; i++) {
        postActivity("u" + i, { type: "checkin", venueName: "Bar Alpha" });
      }
      // Some in Ballard
      postActivity("uX", { type: "checkin", venueName: "Lounge Gamma" });
      refreshHeatData();
      const all = getNeighborhoodHeat();
      expect(all[0].score).toBe(100);
    });
  });

  /* ─── Neighborhood data shape ─── */
  describe("neighborhood data shape", () => {
    it("each neighborhood has required fields", () => {
      postActivity("u1", { type: "checkin", venueName: "Bar Alpha" });
      refreshHeatData();
      const all = getNeighborhoodHeat();
      expect(all.length).toBeGreaterThan(0);
      const hood = all[0];
      expect(typeof hood.name).toBe("string");
      expect(typeof hood.score).toBe("number");
      expect(typeof hood.venueCount).toBe("number");
      expect(typeof hood.topVibe).toBe("string");
      expect(typeof hood.trend).toBe("string");
      expect(Array.isArray(hood.venues)).toBe(true);
    });

    it("trend is a valid value", () => {
      postActivity("u1", { type: "checkin", venueName: "Bar Alpha" });
      refreshHeatData();
      const all = getNeighborhoodHeat();
      const validTrends = ["up", "rising", "steady", "cooling", "down"];
      all.forEach((h) => {
        expect(validTrends).toContain(h.trend);
      });
    });

    it("venueCount reflects number of active venues", () => {
      postActivity("u1", { type: "checkin", venueName: "Bar Alpha" });
      postActivity("u2", { type: "checkin", venueName: "Club Beta" });
      refreshHeatData();
      const all = getNeighborhoodHeat();
      const capHill = all.find((h) => h.name === "Capitol Hill");
      expect(capHill).toBeDefined();
      expect(capHill.venueCount).toBe(2);
    });
  });

  /* ─── Venue pulse integration ─── */
  describe("venue pulse integration", () => {
    it("incorporates pulse reports into heat score", () => {
      submitPulseReport("Bar Alpha", {
        crowdLevel: "packed",
        waitTime: 20,
        mood: ["energetic", "loud"],
      });
      refreshHeatData();
      const score = getHeatScore("Capitol Hill");
      expect(score).toBeGreaterThan(0);
    });

    it("busier crowds yield higher scores", () => {
      submitPulseReport("Bar Alpha", {
        crowdLevel: "packed",
        waitTime: 30,
        mood: ["wild"],
      });
      submitPulseReport("Lounge Gamma", {
        crowdLevel: "empty",
        waitTime: 0,
        mood: ["chill"],
      });
      refreshHeatData();
      const capHill = getHeatScore("Capitol Hill");
      const ballard = getHeatScore("Ballard");
      expect(capHill).toBeGreaterThan(ballard);
    });
  });

  /* ─── Grouping by neighborhood ─── */
  describe("grouping by neighborhood", () => {
    it("groups multiple venues in the same neighborhood", () => {
      postActivity("u1", { type: "checkin", venueName: "Bar Alpha" });
      postActivity("u2", { type: "checkin", venueName: "Club Beta" });
      refreshHeatData();
      const all = getNeighborhoodHeat();
      const capHill = all.find((h) => h.name === "Capitol Hill");
      expect(capHill).toBeDefined();
      expect(capHill.venues.length).toBe(2);
    });

    it("creates separate entries for different neighborhoods", () => {
      postActivity("u1", { type: "checkin", venueName: "Bar Alpha" });
      postActivity("u2", { type: "checkin", venueName: "Lounge Gamma" });
      postActivity("u3", { type: "checkin", venueName: "Dive Delta" });
      refreshHeatData();
      const all = getNeighborhoodHeat();
      const names = all.map((h) => h.name);
      expect(names).toContain("Capitol Hill");
      expect(names).toContain("Ballard");
      expect(names).toContain("Fremont");
    });
  });

  /* ─── Stale data handling ─── */
  describe("stale data", () => {
    it("old check-ins contribute less to heat score", () => {
      // Post with current timestamp
      postActivity("u1", { type: "checkin", venueName: "Bar Alpha" });
      refreshHeatData();
      const freshScore = getHeatScore("Capitol Hill");

      // Manually age the post to 100 minutes ago
      clearStore();
      const feedKey = Object.keys(store).find(k => k.includes("social_feed")) || "lnv_social_feed_seattle";
      const oldPost = {
        id: "old1",
        userId: "u1",
        type: "checkin",
        venueName: "Bar Alpha",
        message: null,
        rating: null,
        photo: null,
        timestamp: Date.now() - 100 * 60 * 1000,
        likes: [],
        comments: [],
      };
      store[feedKey] = JSON.stringify([oldPost]);
      refreshHeatData();
      const oldScore = getHeatScore("Capitol Hill");

      // Fresh activity should produce a score >= old activity's score
      expect(freshScore).toBeGreaterThanOrEqual(oldScore);
    });

    it("activity beyond 2 hour window is excluded from feed", () => {
      // Social feed getFeed returns based on storage, but posts older than
      // 2 hours may still appear. The time-decay makes them near-zero weight.
      const feedKey = "lnv_social_feed_seattle";
      const veryOldPost = {
        id: "ancient1",
        userId: "u1",
        type: "checkin",
        venueName: "Bar Alpha",
        message: null,
        rating: null,
        photo: null,
        timestamp: Date.now() - 3 * 60 * 60 * 1000, // 3 hours ago
        likes: [],
        comments: [],
      };
      store[feedKey] = JSON.stringify([veryOldPost]);
      refreshHeatData();
      // Score should be 0 because only post is filtered by 2h cutoff
      expect(getHeatScore("Capitol Hill")).toBe(0);
    });
  });

  /* ─── Venues without neighborhood mapping ─── */
  describe("unmapped venues", () => {
    it("ignores venues not in the venue map", () => {
      postActivity("u1", { type: "checkin", venueName: "Unknown Venue XYZ" });
      refreshHeatData();
      const all = getNeighborhoodHeat();
      // The unknown venue should not create a neighborhood entry
      const unknown = all.find((h) => h.venues && h.venues.some((v) => v.name === "Unknown Venue XYZ"));
      expect(unknown).toBeUndefined();
    });
  });

  /* ─── Top vibe ─── */
  describe("top vibe", () => {
    it("defaults to 'nightlife' when no mood data", () => {
      postActivity("u1", { type: "checkin", venueName: "Bar Alpha" });
      refreshHeatData();
      const all = getNeighborhoodHeat();
      const capHill = all.find((h) => h.name === "Capitol Hill");
      expect(capHill.topVibe).toBe("nightlife");
    });

    it("reflects pulse report moods when available", () => {
      postActivity("u1", { type: "checkin", venueName: "Bar Alpha" });
      submitPulseReport("Bar Alpha", {
        crowdLevel: "busy",
        mood: ["energetic", "dancey"],
      });
      submitPulseReport("Club Beta", {
        crowdLevel: "moderate",
        mood: ["energetic"],
      });
      refreshHeatData();
      const all = getNeighborhoodHeat();
      const capHill = all.find((h) => h.name === "Capitol Hill");
      expect(capHill.topVibe).toBe("energetic");
    });
  });

  /* ─── Multiple check-ins boost score ─── */
  describe("activity volume impact", () => {
    it("more check-ins yield higher heat score", () => {
      postActivity("u1", { type: "checkin", venueName: "Bar Alpha" });
      refreshHeatData();
      const scoreSingle = getHeatScore("Capitol Hill");

      postActivity("u2", { type: "checkin", venueName: "Bar Alpha" });
      postActivity("u3", { type: "checkin", venueName: "Club Beta" });
      postActivity("u4", { type: "checkin", venueName: "Club Beta" });
      refreshHeatData();
      const scoreMulti = getHeatScore("Capitol Hill");

      expect(scoreMulti).toBeGreaterThanOrEqual(scoreSingle);
    });
  });

  /* ─── Likes boost social heat ─── */
  describe("likes impact", () => {
    it("posts with likes contribute more heat than posts without", () => {
      // Post without likes in Ballard
      postActivity("u1", { type: "checkin", venueName: "Lounge Gamma" });

      // Post with likes in Capitol Hill — manually add likes
      const post = postActivity("u2", { type: "checkin", venueName: "Bar Alpha" });
      const feedKey = Object.keys(store).find(k => k.includes("social_feed"));
      if (feedKey) {
        const raw = JSON.parse(store[feedKey]);
        const target = raw.find(p => p.id === post.id);
        if (target) {
          target.likes = ["u3", "u4", "u5", "u6", "u7"];
          store[feedKey] = JSON.stringify(raw);
        }
      }

      refreshHeatData();
      const capHill = getHeatScore("Capitol Hill");
      const ballard = getHeatScore("Ballard");
      expect(capHill).toBeGreaterThan(ballard);
    });
  });
});
