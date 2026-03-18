import { describe, it, expect, beforeEach, vi } from "vitest";

const store = {};
const mockLocalStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
if (typeof globalThis !== "undefined") globalThis.localStorage = mockLocalStorage;

import {
  predictCrowdLevel,
  estimateWaitTime,
  reportCrowdLevel,
  getCrowdHistory,
  getBestTimeToVisit,
  getCurrentPrediction,
  getQuietVenuesNow,
  getPeakHours,
  LEVELS,
  HOURS,
  DAY_NAMES,
} from "../lib/crowd-predictor.js";

function clearStore() {
  for (const key in store) {
    delete store[key];
  }
}

describe("LNVCrowdPredictor", () => {
  beforeEach(() => {
    clearStore();
    vi.restoreAllMocks();
  });

  /* ──────────────────────────────────────────
   * Constants
   * ────────────────────────────────────────── */
  describe("constants", () => {
    it("exports LEVELS with 5 entries", () => {
      expect(LEVELS).toEqual(["Dead", "Quiet", "Moderate", "Busy", "Packed"]);
    });

    it("exports HOURS covering 6 PM to 3 AM", () => {
      expect(HOURS).toEqual([18, 19, 20, 21, 22, 23, 0, 1, 2, 3]);
    });

    it("exports DAY_NAMES for all 7 days", () => {
      expect(DAY_NAMES.length).toBe(7);
      expect(DAY_NAMES[0]).toBe("Sunday");
      expect(DAY_NAMES[5]).toBe("Friday");
      expect(DAY_NAMES[6]).toBe("Saturday");
    });
  });

  /* ──────────────────────────────────────────
   * reportCrowdLevel — validation
   * ────────────────────────────────────────── */
  describe("reportCrowdLevel — validation", () => {
    it("returns null when venueName is null", () => {
      expect(reportCrowdLevel(null, 3)).toBeNull();
    });

    it("returns null when venueName is empty string", () => {
      expect(reportCrowdLevel("", 3)).toBeNull();
    });

    it("returns null when venueName is not a string", () => {
      expect(reportCrowdLevel(123, 3)).toBeNull();
    });

    it("returns null when level is below 1", () => {
      expect(reportCrowdLevel("Bar A", 0)).toBeNull();
    });

    it("returns null when level is above 5", () => {
      expect(reportCrowdLevel("Bar A", 6)).toBeNull();
    });

    it("returns null when level is NaN", () => {
      expect(reportCrowdLevel("Bar A", "busy")).toBeNull();
    });

    it("accepts boundary level values (1 and 5)", () => {
      const r1 = reportCrowdLevel("Bar A", 1);
      expect(r1).not.toBeNull();
      expect(r1.level).toBe(1);
      expect(r1.label).toBe("Dead");

      const r2 = reportCrowdLevel("Bar B", 5);
      expect(r2).not.toBeNull();
      expect(r2.level).toBe(5);
      expect(r2.label).toBe("Packed");
    });
  });

  /* ──────────────────────────────────────────
   * reportCrowdLevel — success
   * ────────────────────────────────────────── */
  describe("reportCrowdLevel — success", () => {
    it("creates a report with correct fields", () => {
      const report = reportCrowdLevel("Club X", 3);
      expect(report).not.toBeNull();
      expect(report.venueName).toBe("Club X");
      expect(report.level).toBe(3);
      expect(report.label).toBe("Moderate");
      expect(report.timestamp).toBeTypeOf("number");
    });

    it("persists the report to storage", () => {
      reportCrowdLevel("Club X", 4);
      const history = getCrowdHistory("Club X");
      expect(history.length).toBe(1);
      expect(history[0].level).toBe(4);
    });

    it("rounds fractional levels", () => {
      const report = reportCrowdLevel("Club X", 2.7);
      expect(report).not.toBeNull();
      expect(report.level).toBe(3);
    });
  });

  /* ──────────────────────────────────────────
   * reportCrowdLevel — cooldown
   * ────────────────────────────────────────── */
  describe("reportCrowdLevel — cooldown", () => {
    it("returns null when submitting within 10 minute cooldown for same venue", () => {
      reportCrowdLevel("Club X", 3);
      const second = reportCrowdLevel("Club X", 4);
      expect(second).toBeNull();
    });

    it("allows submission to a different venue during cooldown", () => {
      reportCrowdLevel("Club X", 3);
      const second = reportCrowdLevel("Club Y", 4);
      expect(second).not.toBeNull();
    });

    it("allows submission after cooldown period has passed", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now - 11 * 60 * 1000);
      reportCrowdLevel("Club X", 3);
      vi.spyOn(Date, "now").mockReturnValue(now);
      const second = reportCrowdLevel("Club X", 4);
      expect(second).not.toBeNull();
      expect(second.level).toBe(4);
    });

    it("blocks submission within cooldown period", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now - 5 * 60 * 1000);
      reportCrowdLevel("Club X", 3);
      vi.spyOn(Date, "now").mockReturnValue(now);
      const second = reportCrowdLevel("Club X", 4);
      expect(second).toBeNull();
    });
  });

  /* ──────────────────────────────────────────
   * getCrowdHistory
   * ────────────────────────────────────────── */
  describe("getCrowdHistory", () => {
    it("returns empty array when no reports exist", () => {
      expect(getCrowdHistory("Club X")).toEqual([]);
    });

    it("returns empty array for null venueName", () => {
      expect(getCrowdHistory(null)).toEqual([]);
      expect(getCrowdHistory("")).toEqual([]);
    });

    it("returns reports newest first", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now - 11 * 60 * 1000);
      reportCrowdLevel("Club X", 2);
      vi.spyOn(Date, "now").mockReturnValue(now);
      reportCrowdLevel("Club X", 4);
      const history = getCrowdHistory("Club X");
      expect(history.length).toBe(2);
      expect(history[0].level).toBe(4);
      expect(history[1].level).toBe(2);
    });

    it("defaults limit to 20", () => {
      const now = Date.now();
      for (let i = 0; i < 25; i++) {
        vi.spyOn(Date, "now").mockReturnValue(now - (25 - i) * 11 * 60 * 1000);
        reportCrowdLevel("Club X", (i % 5) + 1);
      }
      vi.spyOn(Date, "now").mockReturnValue(now);
      const history = getCrowdHistory("Club X");
      expect(history.length).toBe(20);
    });

    it("respects custom limit", () => {
      const now = Date.now();
      for (let i = 0; i < 5; i++) {
        vi.spyOn(Date, "now").mockReturnValue(now - (5 - i) * 11 * 60 * 1000);
        reportCrowdLevel("Club X", (i % 5) + 1);
      }
      vi.spyOn(Date, "now").mockReturnValue(now);
      const history = getCrowdHistory("Club X", 3);
      expect(history.length).toBe(3);
    });

    it("includes expired reports in history", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now - 3 * 60 * 60 * 1000);
      reportCrowdLevel("Club X", 2);
      vi.spyOn(Date, "now").mockReturnValue(now);
      reportCrowdLevel("Club X", 4);
      const history = getCrowdHistory("Club X");
      expect(history.length).toBe(2);
    });

    it("only returns reports for the specified venue", () => {
      reportCrowdLevel("Club X", 3);
      reportCrowdLevel("Club Y", 4);
      const history = getCrowdHistory("Club X");
      expect(history.length).toBe(1);
      expect(history[0].venueName).toBe("Club X");
    });
  });

  /* ──────────────────────────────────────────
   * predictCrowdLevel — default predictions
   * ────────────────────────────────────────── */
  describe("predictCrowdLevel — defaults", () => {
    it("returns level and label for valid input", () => {
      const result = predictCrowdLevel("Bar A", 5, 22, "Bar");
      expect(result).toHaveProperty("level");
      expect(result).toHaveProperty("label");
      expect(result.level).toBeGreaterThanOrEqual(1);
      expect(result.level).toBeLessThanOrEqual(5);
      expect(LEVELS).toContain(result.label);
    });

    it("returns Dead (level 1) for invalid venue name", () => {
      expect(predictCrowdLevel(null, 5, 22)).toEqual({ level: 1, label: "Dead" });
      expect(predictCrowdLevel("", 5, 22)).toEqual({ level: 1, label: "Dead" });
    });

    it("returns Dead (level 1) for hour outside nightlife range", () => {
      const result = predictCrowdLevel("Bar A", 5, 10, "Bar");
      expect(result).toEqual({ level: 1, label: "Dead" });
    });

    it("gives higher predictions for Friday/Saturday", () => {
      /* Friday (5) vs Monday (1) at 22:00 for a Club */
      const friday = predictCrowdLevel("Club X", 5, 22, "Club");
      const monday = predictCrowdLevel("Club X", 1, 22, "Club");
      expect(friday.level).toBeGreaterThanOrEqual(monday.level);
    });

    it("uses Club defaults for Club category", () => {
      /* Club at peak hour on Saturday should be busy */
      const result = predictCrowdLevel("Club X", 6, 23, "Club");
      expect(result.level).toBeGreaterThanOrEqual(3);
    });

    it("uses generic defaults for unknown category", () => {
      const result = predictCrowdLevel("Unknown Place", 5, 22, "SomeUnknownType");
      expect(result.level).toBeGreaterThanOrEqual(1);
      expect(result.level).toBeLessThanOrEqual(5);
    });

    it("clamps predictions to 1-5 range", () => {
      const result = predictCrowdLevel("Bar A", 0, 18, "Bar");
      expect(result.level).toBeGreaterThanOrEqual(1);
      expect(result.level).toBeLessThanOrEqual(5);
    });
  });

  /* ──────────────────────────────────────────
   * predictCrowdLevel — with historical data
   * ────────────────────────────────────────── */
  describe("predictCrowdLevel — with history", () => {
    it("uses historical reports when available", () => {
      /* Submit reports timestamped on a Friday at 10 PM */
      const friday10pm = new Date();
      friday10pm.setDate(friday10pm.getDate() - ((friday10pm.getDay() + 2) % 7)); // last Friday
      friday10pm.setHours(22, 0, 0, 0);

      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(friday10pm.getTime() - 11 * 60 * 1000);
      reportCrowdLevel("Club X", 5);
      vi.spyOn(Date, "now").mockReturnValue(friday10pm.getTime());
      reportCrowdLevel("Club X", 5);
      vi.spyOn(Date, "now").mockReturnValue(now);

      const result = predictCrowdLevel("Club X", 5, 22, "Club");
      /* With multiple level-5 reports, prediction should be high */
      expect(result.level).toBeGreaterThanOrEqual(3);
    });

    it("factors in live reports more heavily", () => {
      /* Submit a live report saying packed, use a known nightlife hour */
      reportCrowdLevel("Bar A", 5);
      /* Use Friday at 22:00 — guaranteed to be in nightlife range */
      const result = predictCrowdLevel("Bar A", 5, 22, "Bar");
      /* Live data (level 5) blended with default should push prediction up */
      expect(result.level).toBeGreaterThanOrEqual(3);
    });
  });

  /* ──────────────────────────────────────────
   * predictCrowdLevel — day-of-week adjustments
   * ────────────────────────────────────────── */
  describe("predictCrowdLevel — day-of-week adjustments", () => {
    it("Saturday has higher multiplier than Sunday", () => {
      const sat = predictCrowdLevel("Club X", 6, 22, "Club");
      const sun = predictCrowdLevel("Club X", 0, 22, "Club");
      expect(sat.level).toBeGreaterThanOrEqual(sun.level);
    });

    it("Friday has higher multiplier than Wednesday", () => {
      const fri = predictCrowdLevel("Club X", 5, 22, "Club");
      const wed = predictCrowdLevel("Club X", 3, 22, "Club");
      expect(fri.level).toBeGreaterThanOrEqual(wed.level);
    });

    it("Monday has lowest multiplier", () => {
      const mon = predictCrowdLevel("Club X", 1, 22, "Club");
      /* Monday prediction at any hour should be moderate or lower for default profiles */
      expect(mon.level).toBeLessThanOrEqual(3);
    });
  });

  /* ──────────────────────────────────────────
   * estimateWaitTime
   * ────────────────────────────────────────── */
  describe("estimateWaitTime", () => {
    it("returns minutes and label", () => {
      const result = estimateWaitTime("Bar A", 5, 22, "Bar");
      expect(result).toHaveProperty("minutes");
      expect(result).toHaveProperty("label");
      expect(result.minutes).toBeGreaterThanOrEqual(0);
    });

    it("returns no wait for Dead level", () => {
      /* Monday at 6 PM for a Bar — should be Dead or Quiet */
      const result = estimateWaitTime("Bar A", 1, 18, "Bar");
      expect(result.minutes).toBe(0);
      expect(result.label).toBe("No wait");
    });

    it("returns higher wait for Club category", () => {
      /* Saturday at 11 PM — Club should have higher wait than Brewery */
      const clubWait = estimateWaitTime("Club X", 6, 23, "Club");
      const breweryWait = estimateWaitTime("Brewery X", 6, 23, "Brewery");
      expect(clubWait.minutes).toBeGreaterThanOrEqual(breweryWait.minutes);
    });

    it("formats label with tilde for short waits", () => {
      /* If wait is 1-5 minutes, should have ~ prefix */
      const result = estimateWaitTime("Lounge A", 3, 22, "Lounge");
      if (result.minutes > 0 && result.minutes <= 5) {
        expect(result.label).toMatch(/^~\d+ min$/);
      }
    });

    it("formats label with + suffix for longer waits", () => {
      /* If wait is > 5 minutes */
      const result = estimateWaitTime("Club X", 6, 23, "Club");
      if (result.minutes > 5) {
        expect(result.label).toMatch(/\d+\+ min$/);
      }
    });
  });

  /* ──────────────────────────────────────────
   * getBestTimeToVisit
   * ────────────────────────────────────────── */
  describe("getBestTimeToVisit", () => {
    it("returns null for empty venueName", () => {
      expect(getBestTimeToVisit("")).toBeNull();
      expect(getBestTimeToVisit(null)).toBeNull();
    });

    it("returns correct shape", () => {
      const result = getBestTimeToVisit("Bar A", "Bar");
      expect(result).toHaveProperty("hour");
      expect(result).toHaveProperty("dayOfWeek");
      expect(result).toHaveProperty("dayName");
      expect(result).toHaveProperty("label");
      expect(result).toHaveProperty("level");
    });

    it("returns hour within nightlife range", () => {
      const result = getBestTimeToVisit("Bar A", "Bar");
      expect(HOURS).toContain(result.hour);
    });

    it("returns dayOfWeek between 0-6", () => {
      const result = getBestTimeToVisit("Bar A", "Bar");
      expect(result.dayOfWeek).toBeGreaterThanOrEqual(0);
      expect(result.dayOfWeek).toBeLessThanOrEqual(6);
    });

    it("returns dayName matching dayOfWeek", () => {
      const result = getBestTimeToVisit("Bar A", "Bar");
      expect(result.dayName).toBe(DAY_NAMES[result.dayOfWeek]);
    });

    it("returns the lowest busyness level time slot", () => {
      const result = getBestTimeToVisit("Bar A", "Bar");
      /* The best time should have level 1 (Dead) for default profiles on quiet days */
      expect(result.level).toBeLessThanOrEqual(2);
    });

    it("label includes day name and time", () => {
      const result = getBestTimeToVisit("Bar A", "Bar");
      expect(result.label).toContain(result.dayName);
      expect(result.label).toContain("at");
    });
  });

  /* ──────────────────────────────────────────
   * getCurrentPrediction
   * ────────────────────────────────────────── */
  describe("getCurrentPrediction", () => {
    it("returns null for empty venueName", () => {
      expect(getCurrentPrediction("")).toBeNull();
      expect(getCurrentPrediction(null)).toBeNull();
    });

    it("returns correct shape", () => {
      const result = getCurrentPrediction("Bar A", "Bar");
      expect(result).toHaveProperty("level");
      expect(result).toHaveProperty("label");
      expect(result).toHaveProperty("hour");
      expect(result).toHaveProperty("dayOfWeek");
      expect(result).toHaveProperty("hasLiveData");
      expect(result).toHaveProperty("reportCount");
    });

    it("shows hasLiveData=false when no recent reports", () => {
      const result = getCurrentPrediction("Bar A", "Bar");
      expect(result.hasLiveData).toBe(false);
      expect(result.reportCount).toBe(0);
    });

    it("shows hasLiveData=true when recent reports exist", () => {
      reportCrowdLevel("Bar A", 4);
      const result = getCurrentPrediction("Bar A", "Bar");
      expect(result.hasLiveData).toBe(true);
      expect(result.reportCount).toBeGreaterThan(0);
    });

    it("shows hasLiveData=false when all reports are expired", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now - 3 * 60 * 60 * 1000);
      reportCrowdLevel("Bar A", 4);
      vi.spyOn(Date, "now").mockReturnValue(now);
      const result = getCurrentPrediction("Bar A", "Bar");
      expect(result.hasLiveData).toBe(false);
    });
  });

  /* ──────────────────────────────────────────
   * getQuietVenuesNow
   * ────────────────────────────────────────── */
  describe("getQuietVenuesNow", () => {
    it("returns empty array for non-array input", () => {
      expect(getQuietVenuesNow(null)).toEqual([]);
      expect(getQuietVenuesNow(undefined)).toEqual([]);
      expect(getQuietVenuesNow("string")).toEqual([]);
    });

    it("returns empty array for empty venues list", () => {
      expect(getQuietVenuesNow([])).toEqual([]);
    });

    it("returns venues sorted by level ascending (quietest first)", () => {
      const venues = [
        { Name: "Bar A", Category: "Bar" },
        { Name: "Club B", Category: "Club" },
        { Name: "Lounge C", Category: "Lounge" },
      ];
      const results = getQuietVenuesNow(venues);
      expect(results.length).toBe(3);
      for (let i = 1; i < results.length; i++) {
        expect(results[i].level).toBeGreaterThanOrEqual(results[i - 1].level);
      }
    });

    it("returns correct shape for each venue", () => {
      const venues = [{ Name: "Bar A", Category: "Bar" }];
      const results = getQuietVenuesNow(venues);
      expect(results[0]).toHaveProperty("venueName", "Bar A");
      expect(results[0]).toHaveProperty("level");
      expect(results[0]).toHaveProperty("label");
    });

    it("skips venues without a Name", () => {
      const venues = [
        { Name: "Bar A", Category: "Bar" },
        { Category: "Club" },
        { Name: "", Category: "Lounge" },
      ];
      const results = getQuietVenuesNow(venues);
      expect(results.length).toBe(1);
    });

    it("also accepts lowercase name property", () => {
      const venues = [{ name: "Bar A", category: "Bar" }];
      const results = getQuietVenuesNow(venues);
      expect(results.length).toBe(1);
      expect(results[0].venueName).toBe("Bar A");
    });
  });

  /* ──────────────────────────────────────────
   * getPeakHours
   * ────────────────────────────────────────── */
  describe("getPeakHours", () => {
    it("returns empty array for empty venueName", () => {
      expect(getPeakHours("")).toEqual([]);
      expect(getPeakHours(null)).toEqual([]);
    });

    it("returns array of { hour, level, label } objects", () => {
      const peaks = getPeakHours("Club X", 6, "Club");
      if (peaks.length > 0) {
        expect(peaks[0]).toHaveProperty("hour");
        expect(peaks[0]).toHaveProperty("level");
        expect(peaks[0]).toHaveProperty("label");
      }
    });

    it("only includes hours with level >= 4", () => {
      const peaks = getPeakHours("Club X", 6, "Club");
      peaks.forEach((p) => {
        expect(p.level).toBeGreaterThanOrEqual(4);
      });
    });

    it("returns results sorted by level descending", () => {
      const peaks = getPeakHours("Club X", 6, "Club");
      for (let i = 1; i < peaks.length; i++) {
        expect(peaks[i].level).toBeLessThanOrEqual(peaks[i - 1].level);
      }
    });

    it("Saturday Club has peak hours", () => {
      const peaks = getPeakHours("Club X", 6, "Club");
      /* Club on Saturday should have at least some peak hours */
      expect(peaks.length).toBeGreaterThan(0);
    });

    it("Monday Bar has fewer or no peak hours", () => {
      const peaks = getPeakHours("Bar A", 1, "Bar");
      /* Monday bar shouldn't have many peak hours */
      expect(peaks.length).toBeLessThanOrEqual(1);
    });
  });

  /* ──────────────────────────────────────────
   * Report expiry
   * ────────────────────────────────────────── */
  describe("report expiry", () => {
    it("expired reports do not affect live predictions", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now - 3 * 60 * 60 * 1000);
      reportCrowdLevel("Bar A", 5);
      vi.spyOn(Date, "now").mockReturnValue(now);

      const result = getCurrentPrediction("Bar A", "Bar");
      expect(result.hasLiveData).toBe(false);
    });

    it("reports just under 2 hours are still active", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now - (2 * 60 * 60 * 1000 - 1000));
      reportCrowdLevel("Bar A", 5);
      vi.spyOn(Date, "now").mockReturnValue(now);

      const result = getCurrentPrediction("Bar A", "Bar");
      expect(result.hasLiveData).toBe(true);
    });

    it("reports at exactly 2 hours are expired", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now - 2 * 60 * 60 * 1000);
      reportCrowdLevel("Bar A", 5);
      vi.spyOn(Date, "now").mockReturnValue(now);

      const result = getCurrentPrediction("Bar A", "Bar");
      expect(result.hasLiveData).toBe(false);
    });

    it("expired reports are still in history", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now - 3 * 60 * 60 * 1000);
      reportCrowdLevel("Bar A", 5);
      vi.spyOn(Date, "now").mockReturnValue(now);

      const history = getCrowdHistory("Bar A");
      expect(history.length).toBe(1);
    });
  });

  /* ──────────────────────────────────────────
   * Edge cases
   * ────────────────────────────────────────── */
  describe("edge cases", () => {
    it("handles corrupted localStorage data gracefully", () => {
      store["lnv_crowd_reports_seattle"] = "not-valid-json{{{";
      expect(getCrowdHistory("Bar A")).toEqual([]);
      const result = predictCrowdLevel("Bar A", 5, 22, "Bar");
      expect(result).toHaveProperty("level");
      expect(result).toHaveProperty("label");
    });

    it("handles empty localStorage gracefully", () => {
      expect(getCrowdHistory("Bar A")).toEqual([]);
      expect(getCurrentPrediction("Bar A", "Bar")).not.toBeNull();
      expect(getQuietVenuesNow([])).toEqual([]);
      expect(getPeakHours("Bar A", 5, "Bar")).toBeDefined();
    });

    it("multiple venues do not interfere with each other", () => {
      reportCrowdLevel("Bar A", 2);
      reportCrowdLevel("Bar B", 5);
      const historyA = getCrowdHistory("Bar A");
      const historyB = getCrowdHistory("Bar B");
      expect(historyA.length).toBe(1);
      expect(historyA[0].level).toBe(2);
      expect(historyB.length).toBe(1);
      expect(historyB[0].level).toBe(5);
    });

    it("predictCrowdLevel uses current day/hour when not provided", () => {
      const result = predictCrowdLevel("Bar A");
      expect(result).toHaveProperty("level");
      expect(result).toHaveProperty("label");
    });

    it("handles single data point without errors", () => {
      reportCrowdLevel("Bar A", 3);
      const prediction = predictCrowdLevel("Bar A", new Date().getDay(), new Date().getHours(), "Bar");
      expect(prediction.level).toBeGreaterThanOrEqual(1);
      expect(prediction.level).toBeLessThanOrEqual(5);

      const best = getBestTimeToVisit("Bar A", "Bar");
      expect(best).not.toBeNull();

      const current = getCurrentPrediction("Bar A", "Bar");
      expect(current).not.toBeNull();
    });

    it("no history still provides default predictions", () => {
      const result = predictCrowdLevel("NewVenue", 5, 22, "Club");
      expect(result.level).toBeGreaterThanOrEqual(1);
      expect(result.level).toBeLessThanOrEqual(5);
    });

    it("getBestTimeToVisit works with no history", () => {
      const result = getBestTimeToVisit("NewVenue", "Bar");
      expect(result).not.toBeNull();
      expect(result.level).toBeLessThanOrEqual(5);
    });

    it("getPeakHours uses current day when dayOfWeek is omitted", () => {
      const peaks = getPeakHours("Club X", undefined, "Club");
      /* Should not throw */
      expect(Array.isArray(peaks)).toBe(true);
    });

    it("getQuietVenuesNow handles mixed venue data", () => {
      const venues = [
        { Name: "Bar A", Category: "Bar" },
        { name: "Bar B", category: "Club" },
        {},
        null,
      ].filter(Boolean);
      const results = getQuietVenuesNow(venues);
      expect(results.length).toBe(2);
    });
  });
});
