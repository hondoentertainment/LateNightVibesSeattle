import { describe, it, expect, beforeEach, vi } from "vitest";

const store = {};
const mockLocalStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
if (typeof globalThis !== "undefined") globalThis.localStorage = mockLocalStorage;

import {
  submitNowPlaying,
  getVenueMusic,
  getVenueMusicHistory,
  findVenuesByGenre,
  getDJSchedule,
  getActiveDJs,
  getEnergyMap,
  getHighEnergyVenues,
  getGenreTrends,
  getTopGenres,
  saveMusicPrefs,
  getMusicPrefs,
  getPersonalizedVenues,
} from "../lib/music-tracker.js";

function clearStore() {
  for (const key in store) {
    delete store[key];
  }
}

describe("LNVMusicTracker", () => {
  beforeEach(() => {
    clearStore();
    vi.restoreAllMocks();
  });

  /* ──────────────────────────────────────────
   * 1. submitNowPlaying — validation
   * ────────────────────────────────────────── */
  describe("submitNowPlaying — validation", () => {
    it("returns null when venueName is null", () => {
      expect(submitNowPlaying(null, { genre: "Jazz" })).toBeNull();
    });

    it("returns null when venueName is empty string", () => {
      expect(submitNowPlaying("", { genre: "Jazz" })).toBeNull();
    });

    it("returns null when venueName is not a string", () => {
      expect(submitNowPlaying(123, { genre: "Jazz" })).toBeNull();
    });

    it("returns null when report is null", () => {
      expect(submitNowPlaying("Bar A", null)).toBeNull();
    });

    it("returns null when report is undefined", () => {
      expect(submitNowPlaying("Bar A", undefined)).toBeNull();
    });

    it("returns null when genre is missing", () => {
      expect(submitNowPlaying("Bar A", { artist: "Someone" })).toBeNull();
    });

    it("returns null when genre is empty string", () => {
      expect(submitNowPlaying("Bar A", { genre: "" })).toBeNull();
    });

    it("returns null when genre is not a string", () => {
      expect(submitNowPlaying("Bar A", { genre: 42 })).toBeNull();
    });

    it("returns null when energy is below 1", () => {
      expect(submitNowPlaying("Bar A", { genre: "Jazz", energy: 0 })).toBeNull();
    });

    it("returns null when energy is above 5", () => {
      expect(submitNowPlaying("Bar A", { genre: "Jazz", energy: 6 })).toBeNull();
    });

    it("returns null when energy is not a valid number", () => {
      expect(submitNowPlaying("Bar A", { genre: "Jazz", energy: "high" })).toBeNull();
    });

    it("returns null when bpm is below 60", () => {
      expect(submitNowPlaying("Bar A", { genre: "Jazz", bpm: 30 })).toBeNull();
    });

    it("returns null when bpm is above 200", () => {
      expect(submitNowPlaying("Bar A", { genre: "Jazz", bpm: 250 })).toBeNull();
    });

    it("returns null when bpm is not a valid number", () => {
      expect(submitNowPlaying("Bar A", { genre: "Jazz", bpm: "fast" })).toBeNull();
    });

    it("accepts valid energy boundary values (1 and 5)", () => {
      const r1 = submitNowPlaying("Bar A", { genre: "Jazz", energy: 1 });
      expect(r1).not.toBeNull();
      expect(r1.energy).toBe(1);

      // Need to wait for cooldown or use different venue
      const r2 = submitNowPlaying("Bar B", { genre: "Jazz", energy: 5 });
      expect(r2).not.toBeNull();
      expect(r2.energy).toBe(5);
    });

    it("accepts valid bpm boundary values (60 and 200)", () => {
      const r1 = submitNowPlaying("Bar A", { genre: "Jazz", bpm: 60 });
      expect(r1).not.toBeNull();
      expect(r1.bpm).toBe(60);

      const r2 = submitNowPlaying("Bar B", { genre: "Jazz", bpm: 200 });
      expect(r2).not.toBeNull();
      expect(r2.bpm).toBe(200);
    });
  });

  /* ──────────────────────────────────────────
   * 1. submitNowPlaying — success cases
   * ────────────────────────────────────────── */
  describe("submitNowPlaying — success", () => {
    it("creates a report with all fields", () => {
      const report = submitNowPlaying("Club X", {
        genre: "House",
        artist: "DJ Shadow",
        dj: "DJ Shadow",
        song: "Deep Vibes",
        energy: 4,
        bpm: 128,
      });
      expect(report).not.toBeNull();
      expect(report.venueName).toBe("Club X");
      expect(report.genre).toBe("House");
      expect(report.artist).toBe("DJ Shadow");
      expect(report.dj).toBe("DJ Shadow");
      expect(report.song).toBe("Deep Vibes");
      expect(report.energy).toBe(4);
      expect(report.bpm).toBe(128);
      expect(report.timestamp).toBeTypeOf("number");
    });

    it("defaults optional fields to null", () => {
      const report = submitNowPlaying("Club X", { genre: "Techno" });
      expect(report.artist).toBeNull();
      expect(report.dj).toBeNull();
      expect(report.song).toBeNull();
      expect(report.energy).toBeNull();
      expect(report.bpm).toBeNull();
    });

    it("allows energy and bpm to be omitted", () => {
      const report = submitNowPlaying("Club X", { genre: "Jazz" });
      expect(report).not.toBeNull();
      expect(report.energy).toBeNull();
      expect(report.bpm).toBeNull();
    });

    it("persists the report to storage", () => {
      submitNowPlaying("Club X", { genre: "Jazz" });
      const music = getVenueMusic("Club X");
      expect(music).not.toBeNull();
      expect(music.genre).toBe("Jazz");
    });
  });

  /* ──────────────────────────────────────────
   * 1. submitNowPlaying — cooldown
   * ────────────────────────────────────────── */
  describe("submitNowPlaying — cooldown", () => {
    it("returns null when submitting within 10 minute cooldown for same venue", () => {
      submitNowPlaying("Club X", { genre: "Jazz" });
      const second = submitNowPlaying("Club X", { genre: "Blues" });
      expect(second).toBeNull();
    });

    it("allows submission to a different venue during cooldown", () => {
      submitNowPlaying("Club X", { genre: "Jazz" });
      const second = submitNowPlaying("Club Y", { genre: "Blues" });
      expect(second).not.toBeNull();
    });

    it("allows submission after cooldown period has passed", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now - 11 * 60 * 1000);
      submitNowPlaying("Club X", { genre: "Jazz" });
      vi.spyOn(Date, "now").mockReturnValue(now);
      const second = submitNowPlaying("Club X", { genre: "Blues" });
      expect(second).not.toBeNull();
      expect(second.genre).toBe("Blues");
    });

    it("blocks submission within cooldown period", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now - 5 * 60 * 1000);
      submitNowPlaying("Club X", { genre: "Jazz" });
      vi.spyOn(Date, "now").mockReturnValue(now);
      const second = submitNowPlaying("Club X", { genre: "Blues" });
      expect(second).toBeNull();
    });
  });

  /* ──────────────────────────────────────────
   * 2. getVenueMusic
   * ────────────────────────────────────────── */
  describe("getVenueMusic", () => {
    it("returns null when no reports exist", () => {
      expect(getVenueMusic("Club X")).toBeNull();
    });

    it("returns null for empty venueName", () => {
      expect(getVenueMusic("")).toBeNull();
      expect(getVenueMusic(null)).toBeNull();
    });

    it("returns the latest non-expired report", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now - 11 * 60 * 1000);
      submitNowPlaying("Club X", { genre: "Jazz" });
      vi.spyOn(Date, "now").mockReturnValue(now);
      submitNowPlaying("Club X", { genre: "Blues" });
      const music = getVenueMusic("Club X");
      expect(music.genre).toBe("Blues");
    });

    it("returns null when all reports are expired", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now - 4 * 60 * 60 * 1000);
      submitNowPlaying("Club X", { genre: "Jazz" });
      vi.spyOn(Date, "now").mockReturnValue(now);
      expect(getVenueMusic("Club X")).toBeNull();
    });

    it("returns report only for requested venue", () => {
      submitNowPlaying("Club X", { genre: "Jazz" });
      submitNowPlaying("Club Y", { genre: "Blues" });
      const music = getVenueMusic("Club X");
      expect(music.genre).toBe("Jazz");
    });
  });

  /* ──────────────────────────────────────────
   * 2. getVenueMusicHistory
   * ────────────────────────────────────────── */
  describe("getVenueMusicHistory", () => {
    it("returns empty array when no reports exist", () => {
      expect(getVenueMusicHistory("Club X")).toEqual([]);
    });

    it("returns empty array for empty venueName", () => {
      expect(getVenueMusicHistory("")).toEqual([]);
    });

    it("returns reports newest first", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now - 11 * 60 * 1000);
      submitNowPlaying("Club X", { genre: "Jazz" });
      vi.spyOn(Date, "now").mockReturnValue(now);
      submitNowPlaying("Club X", { genre: "Blues" });
      const history = getVenueMusicHistory("Club X");
      expect(history.length).toBe(2);
      expect(history[0].genre).toBe("Blues");
      expect(history[1].genre).toBe("Jazz");
    });

    it("defaults limit to 10", () => {
      const now = Date.now();
      for (let i = 0; i < 12; i++) {
        vi.spyOn(Date, "now").mockReturnValue(now - (12 - i) * 11 * 60 * 1000);
        submitNowPlaying("Club X", { genre: "Genre" + i });
      }
      vi.spyOn(Date, "now").mockReturnValue(now);
      const history = getVenueMusicHistory("Club X");
      expect(history.length).toBe(10);
    });

    it("respects custom limit", () => {
      const now = Date.now();
      for (let i = 0; i < 5; i++) {
        vi.spyOn(Date, "now").mockReturnValue(now - (5 - i) * 11 * 60 * 1000);
        submitNowPlaying("Club X", { genre: "Genre" + i });
      }
      vi.spyOn(Date, "now").mockReturnValue(now);
      const history = getVenueMusicHistory("Club X", 3);
      expect(history.length).toBe(3);
    });

    it("includes expired reports in history", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now - 4 * 60 * 60 * 1000);
      submitNowPlaying("Club X", { genre: "OldJazz" });
      vi.spyOn(Date, "now").mockReturnValue(now);
      submitNowPlaying("Club X", { genre: "NewBlues" });
      const history = getVenueMusicHistory("Club X");
      expect(history.length).toBe(2);
    });

    it("only returns reports for the specified venue", () => {
      submitNowPlaying("Club X", { genre: "Jazz" });
      submitNowPlaying("Club Y", { genre: "Blues" });
      const history = getVenueMusicHistory("Club X");
      expect(history.length).toBe(1);
      expect(history[0].genre).toBe("Jazz");
    });
  });

  /* ──────────────────────────────────────────
   * 3. findVenuesByGenre
   * ────────────────────────────────────────── */
  describe("findVenuesByGenre", () => {
    it("returns empty array for empty/null genre", () => {
      expect(findVenuesByGenre("")).toEqual([]);
      expect(findVenuesByGenre(null)).toEqual([]);
    });

    it("returns empty array for non-string genre", () => {
      expect(findVenuesByGenre(42)).toEqual([]);
    });

    it("finds venues with case-insensitive partial match", () => {
      submitNowPlaying("Club X", { genre: "Deep House" });
      submitNowPlaying("Club Y", { genre: "Tech House" });
      const results = findVenuesByGenre("house");
      expect(results.length).toBe(2);
    });

    it("does not return venues with expired reports", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now - 4 * 60 * 60 * 1000);
      submitNowPlaying("Club X", { genre: "Jazz" });
      vi.spyOn(Date, "now").mockReturnValue(now);
      const results = findVenuesByGenre("Jazz");
      expect(results.length).toBe(0);
    });

    it("returns results sorted by most recent", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now - 30 * 60 * 1000);
      submitNowPlaying("Club X", { genre: "Jazz" });
      vi.spyOn(Date, "now").mockReturnValue(now);
      submitNowPlaying("Club Y", { genre: "Jazz Fusion" });
      const results = findVenuesByGenre("jazz");
      expect(results[0].venueName).toBe("Club Y");
    });

    it("returns one entry per venue with the latest report", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now - 11 * 60 * 1000);
      submitNowPlaying("Club X", { genre: "Jazz Trio" });
      vi.spyOn(Date, "now").mockReturnValue(now);
      submitNowPlaying("Club X", { genre: "Jazz Quartet" });
      const results = findVenuesByGenre("jazz");
      expect(results.length).toBe(1);
      expect(results[0].report.genre).toBe("Jazz Quartet");
    });

    it("returns empty array when no genres match", () => {
      submitNowPlaying("Club X", { genre: "Techno" });
      expect(findVenuesByGenre("Country")).toEqual([]);
    });
  });

  /* ──────────────────────────────────────────
   * 4. getDJSchedule
   * ────────────────────────────────────────── */
  describe("getDJSchedule", () => {
    it("returns empty array for null/empty djName", () => {
      expect(getDJSchedule("")).toEqual([]);
      expect(getDJSchedule(null)).toEqual([]);
    });

    it("returns empty array for non-string djName", () => {
      expect(getDJSchedule(123)).toEqual([]);
    });

    it("finds DJ with case-insensitive exact match", () => {
      submitNowPlaying("Club X", { genre: "House", dj: "DJ Shadow" });
      const results = getDJSchedule("dj shadow");
      expect(results.length).toBe(1);
      expect(results[0].venueName).toBe("Club X");
    });

    it("does not find partial DJ name matches", () => {
      submitNowPlaying("Club X", { genre: "House", dj: "DJ Shadow" });
      const results = getDJSchedule("Shadow");
      expect(results.length).toBe(0);
    });

    it("returns results sorted by most recent", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now - 11 * 60 * 1000);
      submitNowPlaying("Club X", { genre: "House", dj: "DJ Shadow" });
      vi.spyOn(Date, "now").mockReturnValue(now);
      submitNowPlaying("Club Y", { genre: "Techno", dj: "DJ Shadow" });
      const results = getDJSchedule("DJ Shadow");
      expect(results[0].venueName).toBe("Club Y");
    });

    it("includes expired reports in DJ schedule", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now - 4 * 60 * 60 * 1000);
      submitNowPlaying("Club X", { genre: "House", dj: "DJ Shadow" });
      vi.spyOn(Date, "now").mockReturnValue(now);
      const results = getDJSchedule("DJ Shadow");
      expect(results.length).toBe(1);
    });
  });

  /* ──────────────────────────────────────────
   * 4. getActiveDJs
   * ────────────────────────────────────────── */
  describe("getActiveDJs", () => {
    it("returns empty array when no reports", () => {
      expect(getActiveDJs()).toEqual([]);
    });

    it("only includes reports with a dj field", () => {
      submitNowPlaying("Club X", { genre: "Jazz" }); // no dj
      submitNowPlaying("Club Y", { genre: "House", dj: "DJ Night" });
      const djs = getActiveDJs();
      expect(djs.length).toBe(1);
      expect(djs[0].dj).toBe("DJ Night");
    });

    it("excludes expired reports", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now - 4 * 60 * 60 * 1000);
      submitNowPlaying("Club X", { genre: "House", dj: "DJ Shadow" });
      vi.spyOn(Date, "now").mockReturnValue(now);
      expect(getActiveDJs()).toEqual([]);
    });

    it("returns correct shape with dj, venueName, genre, timestamp", () => {
      submitNowPlaying("Club X", { genre: "House", dj: "DJ Shadow" });
      const djs = getActiveDJs();
      expect(djs[0]).toHaveProperty("dj", "DJ Shadow");
      expect(djs[0]).toHaveProperty("venueName", "Club X");
      expect(djs[0]).toHaveProperty("genre", "House");
      expect(djs[0]).toHaveProperty("timestamp");
    });

    it("sorts by most recent first", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now - 11 * 60 * 1000);
      submitNowPlaying("Club X", { genre: "House", dj: "DJ Alpha" });
      vi.spyOn(Date, "now").mockReturnValue(now);
      submitNowPlaying("Club Y", { genre: "Techno", dj: "DJ Beta" });
      const djs = getActiveDJs();
      expect(djs[0].dj).toBe("DJ Beta");
      expect(djs[1].dj).toBe("DJ Alpha");
    });
  });

  /* ──────────────────────────────────────────
   * 5. getEnergyMap
   * ────────────────────────────────────────── */
  describe("getEnergyMap", () => {
    it("returns empty array when no reports", () => {
      expect(getEnergyMap()).toEqual([]);
    });

    it("excludes reports without energy", () => {
      submitNowPlaying("Club X", { genre: "Jazz" }); // no energy
      expect(getEnergyMap()).toEqual([]);
    });

    it("returns latest report per venue sorted by energy descending", () => {
      submitNowPlaying("Club X", { genre: "Techno", energy: 5 });
      submitNowPlaying("Club Y", { genre: "Jazz", energy: 2 });
      submitNowPlaying("Club Z", { genre: "House", energy: 4 });
      const map = getEnergyMap();
      expect(map.length).toBe(3);
      expect(map[0].energy).toBe(5);
      expect(map[1].energy).toBe(4);
      expect(map[2].energy).toBe(2);
    });

    it("excludes expired reports", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now - 4 * 60 * 60 * 1000);
      submitNowPlaying("Club X", { genre: "Techno", energy: 5 });
      vi.spyOn(Date, "now").mockReturnValue(now);
      expect(getEnergyMap()).toEqual([]);
    });

    it("returns correct shape", () => {
      submitNowPlaying("Club X", { genre: "Techno", energy: 4 });
      const map = getEnergyMap();
      expect(map[0]).toHaveProperty("venueName", "Club X");
      expect(map[0]).toHaveProperty("energy", 4);
      expect(map[0]).toHaveProperty("genre", "Techno");
      expect(map[0]).toHaveProperty("timestamp");
    });

    it("uses latest report per venue", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now - 11 * 60 * 1000);
      submitNowPlaying("Club X", { genre: "Jazz", energy: 2 });
      vi.spyOn(Date, "now").mockReturnValue(now);
      submitNowPlaying("Club X", { genre: "Techno", energy: 5 });
      const map = getEnergyMap();
      expect(map.length).toBe(1);
      expect(map[0].energy).toBe(5);
    });
  });

  /* ──────────────────────────────────────────
   * 5. getHighEnergyVenues
   * ────────────────────────────────────────── */
  describe("getHighEnergyVenues", () => {
    it("defaults minEnergy to 4", () => {
      submitNowPlaying("Club X", { genre: "Techno", energy: 3 });
      submitNowPlaying("Club Y", { genre: "House", energy: 4 });
      submitNowPlaying("Club Z", { genre: "Trance", energy: 5 });
      const results = getHighEnergyVenues();
      expect(results.length).toBe(2);
    });

    it("filters by custom minEnergy", () => {
      submitNowPlaying("Club X", { genre: "Techno", energy: 3 });
      submitNowPlaying("Club Y", { genre: "House", energy: 4 });
      submitNowPlaying("Club Z", { genre: "Trance", energy: 5 });
      const results = getHighEnergyVenues(5);
      expect(results.length).toBe(1);
      expect(results[0].venueName).toBe("Club Z");
    });

    it("returns empty array for invalid minEnergy below 1", () => {
      expect(getHighEnergyVenues(0)).toEqual([]);
    });

    it("returns empty array for invalid minEnergy above 5", () => {
      expect(getHighEnergyVenues(6)).toEqual([]);
    });

    it("returns venues sorted by energy descending", () => {
      submitNowPlaying("Club X", { genre: "Techno", energy: 5 });
      submitNowPlaying("Club Y", { genre: "House", energy: 4 });
      const results = getHighEnergyVenues(4);
      expect(results[0].energy).toBe(5);
      expect(results[1].energy).toBe(4);
    });

    it("includes venues at exactly the minEnergy threshold", () => {
      submitNowPlaying("Club X", { genre: "House", energy: 3 });
      const results = getHighEnergyVenues(3);
      expect(results.length).toBe(1);
    });
  });

  /* ──────────────────────────────────────────
   * 6. getGenreTrends
   * ────────────────────────────────────────── */
  describe("getGenreTrends", () => {
    it("returns empty array when no reports", () => {
      expect(getGenreTrends()).toEqual([]);
    });

    it("aggregates genre counts and venues", () => {
      submitNowPlaying("Club X", { genre: "Jazz" });
      submitNowPlaying("Club Y", { genre: "Jazz" });
      submitNowPlaying("Club Z", { genre: "Blues" });
      const trends = getGenreTrends();
      expect(trends[0].genre).toBe("Jazz");
      expect(trends[0].count).toBe(2);
      expect(trends[0].venues).toContain("Club X");
      expect(trends[0].venues).toContain("Club Y");
      expect(trends[1].genre).toBe("Blues");
      expect(trends[1].count).toBe(1);
    });

    it("sorted by count descending", () => {
      submitNowPlaying("Club A", { genre: "Blues" });
      submitNowPlaying("Club B", { genre: "Jazz" });
      submitNowPlaying("Club C", { genre: "Jazz" });
      submitNowPlaying("Club D", { genre: "Jazz" });
      const trends = getGenreTrends();
      expect(trends[0].genre).toBe("Jazz");
      expect(trends[1].genre).toBe("Blues");
    });

    it("excludes expired reports", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now - 4 * 60 * 60 * 1000);
      submitNowPlaying("Club X", { genre: "Jazz" });
      vi.spyOn(Date, "now").mockReturnValue(now);
      expect(getGenreTrends()).toEqual([]);
    });

    it("lists unique venues per genre", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now - 11 * 60 * 1000);
      submitNowPlaying("Club X", { genre: "Jazz" });
      vi.spyOn(Date, "now").mockReturnValue(now);
      submitNowPlaying("Club X", { genre: "Jazz" });
      const trends = getGenreTrends();
      expect(trends[0].venues.length).toBe(1);
      expect(trends[0].count).toBe(2);
    });
  });

  /* ──────────────────────────────────────────
   * 6. getTopGenres
   * ────────────────────────────────────────── */
  describe("getTopGenres", () => {
    it("defaults to top 5", () => {
      const genres = ["Jazz", "Blues", "House", "Techno", "Rock", "Pop"];
      genres.forEach((g, i) => {
        submitNowPlaying("Club " + i, { genre: g });
      });
      const top = getTopGenres();
      expect(top.length).toBe(5);
    });

    it("respects custom limit", () => {
      submitNowPlaying("Club A", { genre: "Jazz" });
      submitNowPlaying("Club B", { genre: "Blues" });
      submitNowPlaying("Club C", { genre: "House" });
      const top = getTopGenres(2);
      expect(top.length).toBe(2);
    });

    it("returns empty array when no data", () => {
      expect(getTopGenres()).toEqual([]);
    });

    it("returns all genres when limit exceeds count", () => {
      submitNowPlaying("Club A", { genre: "Jazz" });
      submitNowPlaying("Club B", { genre: "Blues" });
      const top = getTopGenres(10);
      expect(top.length).toBe(2);
    });
  });

  /* ──────────────────────────────────────────
   * 7. saveMusicPrefs / getMusicPrefs
   * ────────────────────────────────────────── */
  describe("saveMusicPrefs / getMusicPrefs", () => {
    it("returns defaults when nothing saved", () => {
      const prefs = getMusicPrefs();
      expect(prefs).toEqual({
        favoriteGenres: [],
        followedDJs: [],
        energyPreference: null,
      });
    });

    it("saves and retrieves preferences", () => {
      saveMusicPrefs({
        favoriteGenres: ["Jazz", "Blues"],
        followedDJs: ["DJ Shadow"],
        energyPreference: 4,
      });
      const prefs = getMusicPrefs();
      expect(prefs.favoriteGenres).toEqual(["Jazz", "Blues"]);
      expect(prefs.followedDJs).toEqual(["DJ Shadow"]);
      expect(prefs.energyPreference).toBe(4);
    });

    it("returns true on successful save", () => {
      expect(saveMusicPrefs({ favoriteGenres: ["Jazz"] })).toBe(true);
    });

    it("returns false when prefs is null", () => {
      expect(saveMusicPrefs(null)).toBe(false);
    });

    it("returns false when prefs is not an object", () => {
      expect(saveMusicPrefs("invalid")).toBe(false);
    });

    it("returns false for invalid energyPreference", () => {
      expect(saveMusicPrefs({ energyPreference: 0 })).toBe(false);
      expect(saveMusicPrefs({ energyPreference: 6 })).toBe(false);
      expect(saveMusicPrefs({ energyPreference: "high" })).toBe(false);
    });

    it("defaults favoriteGenres to empty array if not an array", () => {
      saveMusicPrefs({ favoriteGenres: "Jazz" });
      const prefs = getMusicPrefs();
      expect(prefs.favoriteGenres).toEqual([]);
    });

    it("defaults followedDJs to empty array if not an array", () => {
      saveMusicPrefs({ followedDJs: "DJ Shadow" });
      const prefs = getMusicPrefs();
      expect(prefs.followedDJs).toEqual([]);
    });

    it("allows energyPreference to be omitted (null)", () => {
      saveMusicPrefs({ favoriteGenres: ["Jazz"] });
      const prefs = getMusicPrefs();
      expect(prefs.energyPreference).toBeNull();
    });

    it("overwrites previous preferences", () => {
      saveMusicPrefs({ favoriteGenres: ["Jazz"] });
      saveMusicPrefs({ favoriteGenres: ["Blues"] });
      const prefs = getMusicPrefs();
      expect(prefs.favoriteGenres).toEqual(["Blues"]);
    });

    it("accepts boundary energyPreference values (1 and 5)", () => {
      expect(saveMusicPrefs({ energyPreference: 1 })).toBe(true);
      expect(saveMusicPrefs({ energyPreference: 5 })).toBe(true);
    });
  });

  /* ──────────────────────────────────────────
   * 7. getPersonalizedVenues
   * ────────────────────────────────────────── */
  describe("getPersonalizedVenues", () => {
    it("returns empty array when no active reports", () => {
      saveMusicPrefs({ favoriteGenres: ["Jazz"] });
      expect(getPersonalizedVenues()).toEqual([]);
    });

    it("scores +3 for matching genre", () => {
      saveMusicPrefs({ favoriteGenres: ["Jazz"] });
      submitNowPlaying("Club X", { genre: "Jazz" });
      const results = getPersonalizedVenues();
      expect(results[0].score).toBe(3);
    });

    it("scores +3 for matching DJ", () => {
      saveMusicPrefs({ followedDJs: ["DJ Shadow"] });
      submitNowPlaying("Club X", { genre: "House", dj: "DJ Shadow" });
      const results = getPersonalizedVenues();
      expect(results[0].score).toBe(3);
    });

    it("scores genre + DJ match = 6", () => {
      saveMusicPrefs({ favoriteGenres: ["House"], followedDJs: ["DJ Shadow"] });
      submitNowPlaying("Club X", { genre: "House", dj: "DJ Shadow" });
      const results = getPersonalizedVenues();
      expect(results[0].score).toBe(6);
    });

    it("scores energy closeness (+1 per point, max 2)", () => {
      saveMusicPrefs({ energyPreference: 4 });
      submitNowPlaying("Club X", { genre: "House", energy: 4 }); // diff=0, +2
      submitNowPlaying("Club Y", { genre: "Jazz", energy: 2 });  // diff=2, +0
      submitNowPlaying("Club Z", { genre: "Blues", energy: 3 }); // diff=1, +1
      const results = getPersonalizedVenues();
      const x = results.find((r) => r.venueName === "Club X");
      const y = results.find((r) => r.venueName === "Club Y");
      const z = results.find((r) => r.venueName === "Club Z");
      expect(x.score).toBe(2); // energy match only
      expect(y.score).toBe(0); // diff=2, score=0
      expect(z.score).toBe(1); // diff=1, score=1
    });

    it("sorts by score descending", () => {
      saveMusicPrefs({ favoriteGenres: ["Jazz"], followedDJs: ["DJ Shadow"], energyPreference: 3 });
      submitNowPlaying("Club X", { genre: "Jazz", dj: "DJ Shadow", energy: 3 }); // 3+3+2=8
      submitNowPlaying("Club Y", { genre: "Blues", energy: 3 }); // 0+0+2=2
      submitNowPlaying("Club Z", { genre: "Jazz" }); // 3
      const results = getPersonalizedVenues();
      expect(results[0].venueName).toBe("Club X");
      expect(results[0].score).toBe(8);
    });

    it("uses case-insensitive genre matching", () => {
      saveMusicPrefs({ favoriteGenres: ["jazz"] });
      submitNowPlaying("Club X", { genre: "Jazz" });
      const results = getPersonalizedVenues();
      expect(results[0].score).toBe(3);
    });

    it("uses case-insensitive DJ matching", () => {
      saveMusicPrefs({ followedDJs: ["dj shadow"] });
      submitNowPlaying("Club X", { genre: "House", dj: "DJ Shadow" });
      const results = getPersonalizedVenues();
      expect(results[0].score).toBe(3);
    });

    it("returns 0 score when no preferences match", () => {
      saveMusicPrefs({ favoriteGenres: ["Country"] });
      submitNowPlaying("Club X", { genre: "Techno" });
      const results = getPersonalizedVenues();
      expect(results[0].score).toBe(0);
    });

    it("excludes expired reports", () => {
      saveMusicPrefs({ favoriteGenres: ["Jazz"] });
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now - 4 * 60 * 60 * 1000);
      submitNowPlaying("Club X", { genre: "Jazz" });
      vi.spyOn(Date, "now").mockReturnValue(now);
      expect(getPersonalizedVenues()).toEqual([]);
    });

    it("uses latest report per venue", () => {
      saveMusicPrefs({ favoriteGenres: ["Blues"] });
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now - 11 * 60 * 1000);
      submitNowPlaying("Club X", { genre: "Jazz" }); // no genre match
      vi.spyOn(Date, "now").mockReturnValue(now);
      submitNowPlaying("Club X", { genre: "Blues" }); // genre match
      const results = getPersonalizedVenues();
      expect(results.length).toBe(1);
      expect(results[0].score).toBe(3);
    });

    it("returns results with correct shape", () => {
      saveMusicPrefs({ favoriteGenres: ["Jazz"] });
      submitNowPlaying("Club X", { genre: "Jazz" });
      const results = getPersonalizedVenues();
      expect(results[0]).toHaveProperty("venueName");
      expect(results[0]).toHaveProperty("report");
      expect(results[0]).toHaveProperty("score");
    });
  });

  /* ──────────────────────────────────────────
   * Edge cases
   * ────────────────────────────────────────── */
  describe("edge cases", () => {
    it("handles corrupted localStorage data gracefully", () => {
      store["lnv_music_tracker_seattle"] = "not-valid-json{{{";
      expect(getVenueMusic("Club X")).toBeNull();
      expect(getVenueMusicHistory("Club X")).toEqual([]);
      expect(findVenuesByGenre("Jazz")).toEqual([]);
      expect(getActiveDJs()).toEqual([]);
      expect(getEnergyMap()).toEqual([]);
      expect(getGenreTrends()).toEqual([]);
    });

    it("handles corrupted prefs data gracefully", () => {
      store["lnv_music_prefs_seattle"] = "not-json";
      const prefs = getMusicPrefs();
      expect(prefs).toEqual({
        favoriteGenres: [],
        followedDJs: [],
        energyPreference: null,
      });
    });

    it("handles empty localStorage gracefully", () => {
      expect(getVenueMusic("Club X")).toBeNull();
      expect(getVenueMusicHistory("Club X")).toEqual([]);
      expect(findVenuesByGenre("Jazz")).toEqual([]);
      expect(getActiveDJs()).toEqual([]);
      expect(getEnergyMap()).toEqual([]);
      expect(getGenreTrends()).toEqual([]);
      expect(getTopGenres()).toEqual([]);
      expect(getPersonalizedVenues()).toEqual([]);
    });

    it("multiple venues do not interfere with each other", () => {
      submitNowPlaying("Club X", { genre: "Jazz", energy: 3 });
      submitNowPlaying("Club Y", { genre: "Techno", energy: 5 });
      expect(getVenueMusic("Club X").genre).toBe("Jazz");
      expect(getVenueMusic("Club Y").genre).toBe("Techno");
    });

    it("reports expire after 3 hours", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now - 3 * 60 * 60 * 1000);
      submitNowPlaying("Club X", { genre: "Jazz" });
      vi.spyOn(Date, "now").mockReturnValue(now);
      expect(getVenueMusic("Club X")).toBeNull();
    });

    it("reports just under 3 hours are still active", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now - (3 * 60 * 60 * 1000 - 1000));
      submitNowPlaying("Club X", { genre: "Jazz" });
      vi.spyOn(Date, "now").mockReturnValue(now);
      expect(getVenueMusic("Club X")).not.toBeNull();
    });
  });
});
