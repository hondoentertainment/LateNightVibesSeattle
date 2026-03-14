import { describe, it, expect, beforeEach, vi } from "vitest";

const store = {};
const mockLocalStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
if (typeof globalThis !== "undefined") globalThis.localStorage = mockLocalStorage;

import {
  submitPulseReport,
  getVenuePulse,
  canSubmitReport,
  getTrendingVenues,
  saveNotificationPrefs,
  getNotificationPrefs,
  getCapacityAlert,
} from "../lib/venue-pulse.js";

function clearStore() {
  for (const key in store) {
    delete store[key];
  }
}

describe("LNVVenuePulse", () => {
  beforeEach(() => {
    clearStore();
    vi.restoreAllMocks();
  });

  /* ──────────────────────────────────────────
   * submitPulseReport
   * ────────────────────────────────────────── */
  describe("submitPulseReport", () => {
    it("returns null when venueName is missing", () => {
      expect(submitPulseReport(null, { waitTime: 5 })).toBeNull();
      expect(submitPulseReport("", { waitTime: 5 })).toBeNull();
    });

    it("returns null when data is missing", () => {
      expect(submitPulseReport("Bar A", null)).toBeNull();
      expect(submitPulseReport("Bar A", undefined)).toBeNull();
    });

    it("creates a report with valid data", () => {
      const report = submitPulseReport("Bar A", {
        waitTime: 10,
        crowdLevel: "busy",
        coverCharge: 15,
        lineLength: "short",
        mood: ["chill", "romantic"],
      });
      expect(report).not.toBeNull();
      expect(report.venue).toBe("Bar A");
      expect(report.waitTime).toBe(10);
      expect(report.crowdLevel).toBe("busy");
      expect(report.coverCharge).toBe(15);
      expect(report.lineLength).toBe("short");
      expect(report.mood).toEqual(["chill", "romantic"]);
      expect(report.timestamp).toBeTypeOf("number");
    });

    it("clamps waitTime to 0-60 range", () => {
      const low = submitPulseReport("Bar A", { waitTime: -5 });
      expect(low.waitTime).toBe(0);
      const high = submitPulseReport("Bar A", { waitTime: 120 });
      expect(high.waitTime).toBe(60);
    });

    it("defaults waitTime to 0 when not a number", () => {
      const report = submitPulseReport("Bar A", { waitTime: "abc" });
      expect(report.waitTime).toBe(0);
    });

    it("defaults crowdLevel to 'moderate' for invalid values", () => {
      const report = submitPulseReport("Bar A", { crowdLevel: "insane" });
      expect(report.crowdLevel).toBe("moderate");
    });

    it("defaults lineLength to 'none' for invalid values", () => {
      const report = submitPulseReport("Bar A", { lineLength: "massive" });
      expect(report.lineLength).toBe("none");
    });

    it("sets coverCharge to null when not provided", () => {
      const report = submitPulseReport("Bar A", {});
      expect(report.coverCharge).toBeNull();
    });

    it("sets coverCharge to null for invalid values", () => {
      const report = submitPulseReport("Bar A", { coverCharge: "free" });
      expect(report.coverCharge).toBeNull();
    });

    it("sets coverCharge to null for negative values", () => {
      const report = submitPulseReport("Bar A", { coverCharge: -10 });
      expect(report.coverCharge).toBeNull();
    });

    it("accepts coverCharge of 0", () => {
      const report = submitPulseReport("Bar A", { coverCharge: 0 });
      expect(report.coverCharge).toBe(0);
    });

    it("defaults mood to empty array when not an array", () => {
      const report = submitPulseReport("Bar A", { mood: "chill" });
      expect(report.mood).toEqual([]);
    });

    it("persists reports across calls", () => {
      submitPulseReport("Bar A", { waitTime: 5 });
      submitPulseReport("Bar A", { waitTime: 10 });
      const pulse = getVenuePulse("Bar A");
      expect(pulse.reportCount).toBe(2);
    });

    it("accepts all valid crowd levels", () => {
      const levels = ["empty", "sparse", "moderate", "busy", "packed"];
      levels.forEach((level) => {
        clearStore();
        const report = submitPulseReport("Bar A", { crowdLevel: level });
        expect(report.crowdLevel).toBe(level);
      });
    });

    it("accepts all valid line lengths", () => {
      const lengths = ["none", "short", "long", "around-block"];
      lengths.forEach((len) => {
        clearStore();
        const report = submitPulseReport("Bar A", { lineLength: len });
        expect(report.lineLength).toBe(len);
      });
    });
  });

  /* ──────────────────────────────────────────
   * getVenuePulse
   * ────────────────────────────────────────── */
  describe("getVenuePulse", () => {
    it("returns null when no reports exist", () => {
      expect(getVenuePulse("NoSuchBar")).toBeNull();
    });

    it("returns aggregated data for a single report", () => {
      submitPulseReport("Bar A", {
        waitTime: 20,
        crowdLevel: "busy",
        coverCharge: 10,
        lineLength: "short",
        mood: ["lively"],
      });
      const pulse = getVenuePulse("Bar A");
      expect(pulse.avgWaitTime).toBe(20);
      expect(pulse.dominantCrowdLevel).toBe("busy");
      expect(pulse.avgCoverCharge).toBe(10);
      expect(pulse.dominantLineLength).toBe("short");
      expect(pulse.topMoods).toEqual(["lively"]);
      expect(pulse.reportCount).toBe(1);
      expect(pulse.freshness).toBe("just now");
    });

    it("computes average wait time across multiple reports", () => {
      submitPulseReport("Bar A", { waitTime: 10 });
      submitPulseReport("Bar A", { waitTime: 30 });
      const pulse = getVenuePulse("Bar A");
      expect(pulse.avgWaitTime).toBe(20);
    });

    it("picks dominant crowd level", () => {
      submitPulseReport("Bar A", { crowdLevel: "busy" });
      submitPulseReport("Bar A", { crowdLevel: "busy" });
      submitPulseReport("Bar A", { crowdLevel: "packed" });
      const pulse = getVenuePulse("Bar A");
      expect(pulse.dominantCrowdLevel).toBe("busy");
    });

    it("picks dominant line length", () => {
      submitPulseReport("Bar A", { lineLength: "long" });
      submitPulseReport("Bar A", { lineLength: "long" });
      submitPulseReport("Bar A", { lineLength: "short" });
      const pulse = getVenuePulse("Bar A");
      expect(pulse.dominantLineLength).toBe("long");
    });

    it("computes average cover charge excluding null values", () => {
      submitPulseReport("Bar A", { coverCharge: 10 });
      submitPulseReport("Bar A", { coverCharge: 20 });
      submitPulseReport("Bar A", { coverCharge: null });
      const pulse = getVenuePulse("Bar A");
      expect(pulse.avgCoverCharge).toBe(15);
    });

    it("returns null avgCoverCharge when all are null", () => {
      submitPulseReport("Bar A", { coverCharge: null });
      submitPulseReport("Bar A", {});
      const pulse = getVenuePulse("Bar A");
      expect(pulse.avgCoverCharge).toBeNull();
    });

    it("returns top 3 moods sorted by frequency", () => {
      submitPulseReport("Bar A", { mood: ["chill", "romantic", "lively"] });
      submitPulseReport("Bar A", { mood: ["chill", "romantic"] });
      submitPulseReport("Bar A", { mood: ["chill", "dark", "funky"] });
      const pulse = getVenuePulse("Bar A");
      expect(pulse.topMoods.length).toBeLessThanOrEqual(3);
      expect(pulse.topMoods[0]).toBe("chill"); // 3 occurrences
      expect(pulse.topMoods[1]).toBe("romantic"); // 2 occurrences
    });

    it("returns empty topMoods when no moods submitted", () => {
      submitPulseReport("Bar A", { mood: [] });
      const pulse = getVenuePulse("Bar A");
      expect(pulse.topMoods).toEqual([]);
    });

    it("only includes reports for the requested venue", () => {
      submitPulseReport("Bar A", { waitTime: 10 });
      submitPulseReport("Bar B", { waitTime: 30 });
      const pulseA = getVenuePulse("Bar A");
      expect(pulseA.reportCount).toBe(1);
      expect(pulseA.avgWaitTime).toBe(10);
    });

    it("excludes expired reports (older than 2 hours)", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now - 3 * 60 * 60 * 1000); // 3h ago
      submitPulseReport("Bar A", { waitTime: 10 });
      vi.spyOn(Date, "now").mockReturnValue(now); // restore to now
      expect(getVenuePulse("Bar A")).toBeNull();
    });

    it("shows freshness as 'just now' for very recent reports", () => {
      submitPulseReport("Bar A", { waitTime: 5 });
      const pulse = getVenuePulse("Bar A");
      expect(pulse.freshness).toBe("just now");
    });

    it("shows freshness as 'X min ago' for reports minutes old", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now - 30 * 60 * 1000);
      submitPulseReport("Bar A", { waitTime: 5 });
      vi.spyOn(Date, "now").mockReturnValue(now);
      const pulse = getVenuePulse("Bar A");
      expect(pulse.freshness).toBe("30 min ago");
    });

    it("shows freshness as 'Xh ago' for reports hours old", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now - 90 * 60 * 1000);
      submitPulseReport("Bar A", { waitTime: 5 });
      vi.spyOn(Date, "now").mockReturnValue(now);
      const pulse = getVenuePulse("Bar A");
      expect(pulse.freshness).toBe("1h ago");
    });
  });

  /* ──────────────────────────────────────────
   * canSubmitReport (rate limiting)
   * ────────────────────────────────────────── */
  describe("canSubmitReport", () => {
    it("returns true when no reports exist for the venue", () => {
      expect(canSubmitReport("Bar A")).toBe(true);
    });

    it("returns false immediately after submitting a report", () => {
      submitPulseReport("Bar A", { waitTime: 5 });
      expect(canSubmitReport("Bar A")).toBe(false);
    });

    it("returns true for a different venue", () => {
      submitPulseReport("Bar A", { waitTime: 5 });
      expect(canSubmitReport("Bar B")).toBe(true);
    });

    it("returns true after cooldown period has passed", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now - 16 * 60 * 1000);
      submitPulseReport("Bar A", { waitTime: 5 });
      vi.spyOn(Date, "now").mockReturnValue(now);
      expect(canSubmitReport("Bar A")).toBe(true);
    });

    it("returns false within cooldown period", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now - 10 * 60 * 1000);
      submitPulseReport("Bar A", { waitTime: 5 });
      vi.spyOn(Date, "now").mockReturnValue(now);
      expect(canSubmitReport("Bar A")).toBe(false);
    });
  });

  /* ──────────────────────────────────────────
   * getTrendingVenues
   * ────────────────────────────────────────── */
  describe("getTrendingVenues", () => {
    it("returns empty array when no venue names provided", () => {
      expect(getTrendingVenues([])).toEqual([]);
    });

    it("returns empty array for non-array input", () => {
      expect(getTrendingVenues(null)).toEqual([]);
      expect(getTrendingVenues(undefined)).toEqual([]);
    });

    it("returns empty array when no venue meets threshold", () => {
      submitPulseReport("Bar A", { waitTime: 5 });
      submitPulseReport("Bar A", { waitTime: 10 });
      const trending = getTrendingVenues(["Bar A", "Bar B"]);
      expect(trending).toEqual([]);
    });

    it("returns venues with 3+ reports", () => {
      submitPulseReport("Bar A", { waitTime: 5 });
      submitPulseReport("Bar A", { waitTime: 10 });
      submitPulseReport("Bar A", { waitTime: 15 });
      const trending = getTrendingVenues(["Bar A", "Bar B"]);
      expect(trending.length).toBe(1);
      expect(trending[0].venue).toBe("Bar A");
      expect(trending[0].reportCount).toBe(3);
      expect(trending[0].trending).toBe(true);
    });

    it("sorts by report count descending", () => {
      for (let i = 0; i < 5; i++) submitPulseReport("Bar A", { waitTime: 5 });
      for (let i = 0; i < 3; i++) submitPulseReport("Bar B", { waitTime: 5 });
      for (let i = 0; i < 4; i++) submitPulseReport("Bar C", { waitTime: 5 });
      const trending = getTrendingVenues(["Bar A", "Bar B", "Bar C"]);
      expect(trending.length).toBe(3);
      expect(trending[0].venue).toBe("Bar A");
      expect(trending[1].venue).toBe("Bar C");
      expect(trending[2].venue).toBe("Bar B");
    });

    it("only includes venues from the provided list", () => {
      for (let i = 0; i < 3; i++) submitPulseReport("Bar A", { waitTime: 5 });
      for (let i = 0; i < 3; i++) submitPulseReport("Bar B", { waitTime: 5 });
      const trending = getTrendingVenues(["Bar A"]);
      expect(trending.length).toBe(1);
      expect(trending[0].venue).toBe("Bar A");
    });

    it("excludes expired reports from trending count", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now - 3 * 60 * 60 * 1000);
      for (let i = 0; i < 5; i++) submitPulseReport("Bar A", { waitTime: 5 });
      vi.spyOn(Date, "now").mockReturnValue(now);
      const trending = getTrendingVenues(["Bar A"]);
      expect(trending).toEqual([]);
    });
  });

  /* ──────────────────────────────────────────
   * Notification Preferences
   * ────────────────────────────────────────── */
  describe("saveNotificationPrefs / getNotificationPrefs", () => {
    it("returns defaults when nothing saved", () => {
      const prefs = getNotificationPrefs();
      expect(prefs).toEqual({ favoriteVenues: [], alerts: false });
    });

    it("saves and loads preferences", () => {
      saveNotificationPrefs({ favoriteVenues: ["Bar A", "Bar B"], alerts: true });
      const prefs = getNotificationPrefs();
      expect(prefs.favoriteVenues).toEqual(["Bar A", "Bar B"]);
      expect(prefs.alerts).toBe(true);
    });

    it("defaults favoriteVenues to [] when not an array", () => {
      saveNotificationPrefs({ favoriteVenues: "Bar A", alerts: true });
      const prefs = getNotificationPrefs();
      expect(prefs.favoriteVenues).toEqual([]);
    });

    it("defaults alerts to false when not true", () => {
      saveNotificationPrefs({ favoriteVenues: [], alerts: "yes" });
      const prefs = getNotificationPrefs();
      expect(prefs.alerts).toBe(false);
    });

    it("does nothing when prefs is null", () => {
      saveNotificationPrefs(null);
      const prefs = getNotificationPrefs();
      expect(prefs).toEqual({ favoriteVenues: [], alerts: false });
    });

    it("overwrites previous preferences", () => {
      saveNotificationPrefs({ favoriteVenues: ["Bar A"], alerts: true });
      saveNotificationPrefs({ favoriteVenues: ["Bar B"], alerts: false });
      const prefs = getNotificationPrefs();
      expect(prefs.favoriteVenues).toEqual(["Bar B"]);
      expect(prefs.alerts).toBe(false);
    });
  });

  /* ──────────────────────────────────────────
   * getCapacityAlert
   * ────────────────────────────────────────── */
  describe("getCapacityAlert", () => {
    it("returns null when no reports exist", () => {
      expect(getCapacityAlert("Bar A")).toBeNull();
    });

    it("returns null for 'empty' crowd level", () => {
      submitPulseReport("Bar A", { crowdLevel: "empty" });
      expect(getCapacityAlert("Bar A")).toBeNull();
    });

    it("returns null for 'sparse' crowd level", () => {
      submitPulseReport("Bar A", { crowdLevel: "sparse" });
      expect(getCapacityAlert("Bar A")).toBeNull();
    });

    it("returns null for 'moderate' crowd level", () => {
      submitPulseReport("Bar A", { crowdLevel: "moderate" });
      expect(getCapacityAlert("Bar A")).toBeNull();
    });

    it("returns warning for 'busy' crowd level", () => {
      submitPulseReport("Bar A", { crowdLevel: "busy" });
      const alert = getCapacityAlert("Bar A");
      expect(alert).not.toBeNull();
      expect(alert.level).toBe("warning");
      expect(alert.message).toContain("Bar A");
      expect(alert.message).toContain("busy");
    });

    it("returns full for 'packed' crowd level", () => {
      submitPulseReport("Bar A", { crowdLevel: "packed" });
      const alert = getCapacityAlert("Bar A");
      expect(alert).not.toBeNull();
      expect(alert.level).toBe("full");
      expect(alert.message).toContain("Bar A");
      expect(alert.message).toContain("full capacity");
    });

    it("uses dominant crowd level for alert determination", () => {
      submitPulseReport("Bar A", { crowdLevel: "packed" });
      submitPulseReport("Bar A", { crowdLevel: "moderate" });
      submitPulseReport("Bar A", { crowdLevel: "moderate" });
      const alert = getCapacityAlert("Bar A");
      // dominant is moderate, so no alert
      expect(alert).toBeNull();
    });

    it("returns full alert when dominant is packed", () => {
      submitPulseReport("Bar A", { crowdLevel: "packed" });
      submitPulseReport("Bar A", { crowdLevel: "packed" });
      submitPulseReport("Bar A", { crowdLevel: "busy" });
      const alert = getCapacityAlert("Bar A");
      expect(alert.level).toBe("full");
    });
  });

  /* ──────────────────────────────────────────
   * Edge cases and integration
   * ────────────────────────────────────────── */
  describe("edge cases", () => {
    it("handles corrupted localStorage data gracefully", () => {
      store["lnv_venue_pulse_seattle"] = "not-valid-json{{{";
      expect(getVenuePulse("Bar A")).toBeNull();
      expect(canSubmitReport("Bar A")).toBe(true);
    });

    it("handles empty localStorage gracefully", () => {
      expect(getVenuePulse("Bar A")).toBeNull();
      expect(getTrendingVenues(["Bar A"])).toEqual([]);
      expect(canSubmitReport("Bar A")).toBe(true);
    });

    it("multiple venues do not interfere with each other", () => {
      submitPulseReport("Bar A", { waitTime: 10, crowdLevel: "busy" });
      submitPulseReport("Bar B", { waitTime: 30, crowdLevel: "empty" });
      const pulseA = getVenuePulse("Bar A");
      const pulseB = getVenuePulse("Bar B");
      expect(pulseA.avgWaitTime).toBe(10);
      expect(pulseA.dominantCrowdLevel).toBe("busy");
      expect(pulseB.avgWaitTime).toBe(30);
      expect(pulseB.dominantCrowdLevel).toBe("empty");
    });
  });
});
