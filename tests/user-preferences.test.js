import { describe, it, expect, beforeEach, afterEach } from "vitest";

const store = {};
const mockLocalStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
if (typeof globalThis !== "undefined") globalThis.localStorage = mockLocalStorage;

import {
  loadOnboardingPrefs,
  saveOnboardingPrefs,
  loadExcludedVibes,
  saveExcludedVibes,
  excludeVibe,
  unexcludeVibe,
  isVibeExcluded,
  loadPlanSeed,
  savePlanSeed,
  clearPlanSeed,
  loadAnchorArea,
  saveAnchorArea,
} from "../lib/user-preferences.js";

const PREFS_KEY = "lnv_onboarding_prefs";
const EXCLUDED_KEY = "lnv_excluded_vibes";
const PLAN_SEED_KEY = "lnv_plan_seed";
const ANCHOR_KEY = "lnv_anchor_area";

describe("LNVUserPrefs", () => {
  beforeEach(() => {
    store[PREFS_KEY] = undefined;
    store[EXCLUDED_KEY] = undefined;
    store[PLAN_SEED_KEY] = undefined;
    store[ANCHOR_KEY] = undefined;
    delete store[PREFS_KEY];
    delete store[EXCLUDED_KEY];
    delete store[PLAN_SEED_KEY];
    delete store[ANCHOR_KEY];
  });

  afterEach(() => {
    delete store[PREFS_KEY];
    delete store[EXCLUDED_KEY];
    delete store[PLAN_SEED_KEY];
    delete store[ANCHOR_KEY];
  });

  describe("onboarding prefs", () => {
    it("returns null when no prefs saved", () => {
      expect(loadOnboardingPrefs()).toBeNull();
    });

    it("saves and loads onboarding prefs", () => {
      const prefs = { who: "friends", energy: "high", area: "Capitol Hill" };
      saveOnboardingPrefs(prefs);
      expect(loadOnboardingPrefs()).toEqual(prefs);
    });
  });

  describe("excluded vibes", () => {
    it("returns empty array when none excluded", () => {
      expect(loadExcludedVibes()).toEqual([]);
    });

    it("excludeVibe adds vibe to list", () => {
      excludeVibe("divey");
      expect(loadExcludedVibes()).toContain("divey");
    });

    it("excludeVibe normalizes to lowercase", () => {
      excludeVibe("Divey");
      expect(loadExcludedVibes()).toContain("divey");
    });

    it("isVibeExcluded returns true for excluded vibe", () => {
      excludeVibe("divey");
      expect(isVibeExcluded("divey")).toBe(true);
    });

    it("unexcludeVibe removes vibe", () => {
      excludeVibe("divey");
      unexcludeVibe("divey");
      expect(loadExcludedVibes()).not.toContain("divey");
    });
  });

  describe("plan seed", () => {
    it("returns null when no seed", () => {
      expect(loadPlanSeed()).toBeNull();
    });

    it("savePlanSeed and loadPlanSeed roundtrip", () => {
      const venue = { Name: "Test Bar", Area: "Capitol Hill", Category: "Bar", "Typical Closing Time": "2:00 AM", "Google Maps Driving Link": "https://maps.com", "Vibe Tags": "chill", "Driving Distance": "2.1 mi" };
      savePlanSeed(venue);
      const loaded = loadPlanSeed();
      expect(loaded.n).toBe("Test Bar");
      expect(loaded.a).toBe("Capitol Hill");
      clearPlanSeed();
      expect(loadPlanSeed()).toBeNull();
    });
  });

  describe("anchor area", () => {
    it("returns null when not set", () => {
      expect(loadAnchorArea()).toBeNull();
    });

    it("saveAnchorArea and loadAnchorArea roundtrip", () => {
      saveAnchorArea("Ballard");
      expect(loadAnchorArea()).toBe("Ballard");
      saveAnchorArea(null);
      expect(loadAnchorArea()).toBeNull();
    });
  });
});
