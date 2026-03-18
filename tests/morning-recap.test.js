import { describe, it, expect, beforeEach, vi } from "vitest";

const store = {};
const mockLocalStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
if (typeof globalThis !== "undefined") globalThis.localStorage = mockLocalStorage;

import {
  STORAGE_KEY,
  generateRecap,
  getNightScore,
  getNightStats,
  getNightHighlights,
  getShareableText,
  getRecapHistory,
  hasNightData,
  getVibeCloud,
  _setNowFn,
  _resetNowFn,
} from "../lib/morning-recap.js";

import {
  startNight,
  endNight,
  checkIn,
  checkOut,
  setNightMood,
  getNightHistory,
} from "../lib/night-timeline.js";

import {
  loadHistory as loadCrawlHistory,
  saveHistory as saveCrawlHistory,
  markVisited,
} from "../lib/crawl-history.js";

function clearStore() {
  for (const key in store) { delete store[key]; }
}

// The cities module scopes storage keys with a city suffix
const SCOPED_KEY = STORAGE_KEY + "_seattle";
const TIMELINE_KEY = "lnv_night_timeline_seattle";
const CRAWL_KEY = "lnv_crawl_history_seattle";
const MUSIC_KEY = "lnv_music_tracker_seattle";
const SOCIAL_KEY = "lnv_social_feed_seattle";
const ACHIEVEMENTS_KEY = "lnv_gamification_achievements_seattle";

/* ─── Helper: create a completed night on a specific date ─── */
function createNightOnDate(dateStr, stops, mood) {
  // dateStr is YYYY-MM-DD; create a night starting at 9 PM on that date
  const parts = dateStr.split("-");
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  const startTime = new Date(year, month, day, 21, 0, 0).getTime(); // 9 PM
  const nightStops = (stops || []).map((s, i) => ({
    venueName: s.name || ("Venue " + (i + 1)),
    arrivalTime: startTime + (i * 30 * 60 * 1000), // 30 min apart
    departureTime: startTime + ((i + 1) * 30 * 60 * 1000),
    rating: s.rating || null,
    vibes: s.vibes || null,
    drink: s.drink || null,
    spend: s.spend || null,
  }));

  const endTime = startTime + ((stops || []).length + 1) * 30 * 60 * 1000;

  const night = {
    id: startTime,
    name: "Night Out - " + dateStr,
    startTime: startTime,
    endTime: endTime,
    stops: nightStops,
    photos: [],
    notes: [],
    mood: mood || null,
  };

  // Load existing nights and append
  let nights = [];
  try {
    const raw = store[TIMELINE_KEY];
    if (raw) nights = JSON.parse(raw);
  } catch (_) {}
  nights.push(night);
  store[TIMELINE_KEY] = JSON.stringify(nights);

  return night;
}

/* ─── Helper: add music reports for a night ─── */
function addMusicReports(dateStr, reports) {
  const parts = dateStr.split("-");
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  let existing = [];
  try {
    const raw = store[MUSIC_KEY];
    if (raw) existing = JSON.parse(raw);
  } catch (_) {}

  for (let i = 0; i < reports.length; i++) {
    existing.push({
      venueName: reports[i].venueName || "Venue",
      genre: reports[i].genre || "Electronic",
      artist: reports[i].artist || null,
      dj: reports[i].dj || null,
      song: reports[i].song || null,
      energy: reports[i].energy || null,
      bpm: reports[i].bpm || null,
      timestamp: new Date(year, month, day, 22 + i, 0, 0).getTime(),
    });
  }

  store[MUSIC_KEY] = JSON.stringify(existing);
}

/* ─── Helper: add social posts for a night ─── */
function addSocialPosts(dateStr, posts) {
  const parts = dateStr.split("-");
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  let existing = [];
  try {
    const raw = store[SOCIAL_KEY];
    if (raw) existing = JSON.parse(raw);
  } catch (_) {}

  for (let i = 0; i < posts.length; i++) {
    existing.push({
      id: "post_" + Date.now() + "_" + i,
      userId: posts[i].userId || "user1",
      type: posts[i].type || "checkin",
      venueName: posts[i].venueName || "Venue",
      message: posts[i].message || null,
      rating: posts[i].rating || null,
      photo: posts[i].photo || null,
      timestamp: new Date(year, month, day, 22 + i, 0, 0).getTime(),
      likes: [],
      comments: [],
    });
  }

  store[SOCIAL_KEY] = JSON.stringify(existing);
}

/* ─── STORAGE_KEY ─── */

describe("STORAGE_KEY", () => {
  it("is a non-empty string", () => {
    expect(typeof STORAGE_KEY).toBe("string");
    expect(STORAGE_KEY.length).toBeGreaterThan(0);
  });

  it("equals lnv_recaps", () => {
    expect(STORAGE_KEY).toBe("lnv_recaps");
  });
});

/* ─── hasNightData ─── */

describe("hasNightData", () => {
  beforeEach(() => { clearStore(); });

  it("returns false when no data exists", () => {
    expect(hasNightData("2025-03-15")).toBe(false);
  });

  it("returns true when timeline sessions exist for the date", () => {
    createNightOnDate("2025-03-15", [{ name: "Bar A" }]);
    expect(hasNightData("2025-03-15")).toBe(true);
  });

  it("returns false for a different date", () => {
    createNightOnDate("2025-03-15", [{ name: "Bar A" }]);
    expect(hasNightData("2025-03-14")).toBe(false);
  });

  it("returns true when crawl entries exist for the date", () => {
    const history = {};
    const visitDate = new Date(2025, 2, 15, 22, 0, 0);
    markVisited(history, "Cool Bar", 1);
    history["Cool Bar"].visitedAt = visitDate.toISOString();
    saveCrawlHistory(history);
    expect(hasNightData("2025-03-15")).toBe(true);
  });
});

/* ─── getNightStats ─── */

describe("getNightStats", () => {
  beforeEach(() => { clearStore(); });

  it("returns zero stats when no data exists", () => {
    const stats = getNightStats("2025-03-15");
    expect(stats.totalVenues).toBe(0);
    expect(stats.duration).toBe(0);
    expect(stats.musicGenres).toBe(0);
  });

  it("counts total venues from timeline sessions", () => {
    createNightOnDate("2025-03-15", [
      { name: "Bar A" },
      { name: "Bar B" },
      { name: "Club C" },
    ]);
    const stats = getNightStats("2025-03-15");
    expect(stats.totalVenues).toBe(3);
  });

  it("computes duration from session start to end", () => {
    createNightOnDate("2025-03-15", [{ name: "Bar A" }, { name: "Bar B" }]);
    const stats = getNightStats("2025-03-15");
    expect(stats.duration).toBeGreaterThan(0);
    expect(stats.durationHours).toBeGreaterThan(0);
  });

  it("counts vibes experienced from stop vibes", () => {
    createNightOnDate("2025-03-15", [
      { name: "Bar A", vibes: "chill,dark" },
      { name: "Bar B", vibes: "loud,energetic" },
    ]);
    const stats = getNightStats("2025-03-15");
    expect(stats.vibesExperienced).toBe(4);
  });

  it("counts music genres from music reports", () => {
    createNightOnDate("2025-03-15", [{ name: "Bar A" }]);
    addMusicReports("2025-03-15", [
      { genre: "House" },
      { genre: "Techno" },
      { genre: "House" },
    ]);
    const stats = getNightStats("2025-03-15");
    expect(stats.musicGenres).toBe(2);
  });

  it("sums total spend", () => {
    createNightOnDate("2025-03-15", [
      { name: "Bar A", spend: 25 },
      { name: "Bar B", spend: 35.50 },
    ]);
    const stats = getNightStats("2025-03-15");
    expect(stats.totalSpend).toBe(60.50);
  });

  it("computes average rating", () => {
    createNightOnDate("2025-03-15", [
      { name: "Bar A", rating: 4 },
      { name: "Bar B", rating: 2 },
    ]);
    const stats = getNightStats("2025-03-15");
    expect(stats.avgRating).toBe(3);
  });

  it("returns venue names", () => {
    createNightOnDate("2025-03-15", [
      { name: "Alpha" },
      { name: "Beta" },
    ]);
    const stats = getNightStats("2025-03-15");
    expect(stats.venueNames).toContain("Alpha");
    expect(stats.venueNames).toContain("Beta");
  });

  it("counts social posts and checkins", () => {
    createNightOnDate("2025-03-15", [{ name: "Bar A" }]);
    addSocialPosts("2025-03-15", [
      { type: "checkin", venueName: "Bar A" },
      { type: "photo", venueName: "Bar A" },
      { type: "checkin", venueName: "Bar B" },
    ]);
    const stats = getNightStats("2025-03-15");
    expect(stats.socialPosts).toBe(3);
    expect(stats.checkins).toBe(2);
  });
});

/* ─── getNightScore ─── */

describe("getNightScore", () => {
  beforeEach(() => { clearStore(); });

  it("returns 0 when no venues visited", () => {
    expect(getNightScore("2025-03-15")).toBe(0);
  });

  it("returns a score between 0 and 100", () => {
    createNightOnDate("2025-03-15", [
      { name: "Bar A", vibes: "chill", rating: 4 },
      { name: "Bar B", vibes: "loud", rating: 5 },
      { name: "Bar C", vibes: "dark", rating: 3 },
    ]);
    const score = getNightScore("2025-03-15");
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("scores higher for more venues", () => {
    createNightOnDate("2025-03-14", [{ name: "Bar A" }]);
    createNightOnDate("2025-03-15", [
      { name: "Bar A" },
      { name: "Bar B" },
      { name: "Bar C" },
      { name: "Bar D" },
    ]);
    const scoreLow = getNightScore("2025-03-14");
    const scoreHigh = getNightScore("2025-03-15");
    expect(scoreHigh).toBeGreaterThan(scoreLow);
  });

  it("caps at 100", () => {
    createNightOnDate("2025-03-15", [
      { name: "A", vibes: "a,b,c", rating: 5 },
      { name: "B", vibes: "d,e,f", rating: 5 },
      { name: "C", vibes: "g,h", rating: 5 },
      { name: "D", vibes: "i,j", rating: 5 },
      { name: "E", vibes: "k,l", rating: 5 },
    ]);
    addMusicReports("2025-03-15", [
      { genre: "House" }, { genre: "Techno" }, { genre: "Jazz" },
    ]);
    addSocialPosts("2025-03-15", [
      { type: "checkin" }, { type: "checkin" }, { type: "checkin" },
      { type: "photo" }, { type: "photo" }, { type: "photo" },
    ]);
    const score = getNightScore("2025-03-15");
    expect(score).toBeLessThanOrEqual(100);
  });

  it("returns integer score", () => {
    createNightOnDate("2025-03-15", [{ name: "Bar A" }]);
    const score = getNightScore("2025-03-15");
    expect(Number.isInteger(score)).toBe(true);
  });
});

/* ─── getNightHighlights ─── */

describe("getNightHighlights", () => {
  beforeEach(() => { clearStore(); });

  it("returns empty array when no data", () => {
    expect(getNightHighlights("2025-03-15")).toEqual([]);
  });

  it("detects first-time venue visits", () => {
    createNightOnDate("2025-03-15", [{ name: "New Spot" }]);
    const highlights = getNightHighlights("2025-03-15");
    const firstVisits = highlights.filter(h => h.type === "first-visit");
    expect(firstVisits.length).toBeGreaterThan(0);
    expect(firstVisits[0].venue).toBe("New Spot");
  });

  it("detects highest-rated venue", () => {
    createNightOnDate("2025-03-15", [
      { name: "Low Bar", rating: 2 },
      { name: "High Bar", rating: 5 },
      { name: "Mid Bar", rating: 3 },
    ]);
    const highlights = getNightHighlights("2025-03-15");
    const highestRated = highlights.filter(h => h.type === "highest-rated");
    expect(highestRated.length).toBe(1);
    expect(highestRated[0].venue).toBe("High Bar");
    expect(highestRated[0].rating).toBe(5);
  });

  it("includes achievement description", () => {
    // Add some unlocked achievements
    store[ACHIEVEMENTS_KEY] = JSON.stringify(["first-crawl"]);
    createNightOnDate("2025-03-15", [{ name: "Bar A" }]);
    const highlights = getNightHighlights("2025-03-15");
    const achievements = highlights.filter(h => h.type === "achievement");
    expect(achievements.length).toBeGreaterThan(0);
    expect(achievements[0].description).toContain("Achievement unlocked");
  });

  it("does not flag repeat venues as first visit", () => {
    // Night 1: visited Bar A
    createNightOnDate("2025-03-14", [{ name: "Bar A" }]);
    // Night 2: visit Bar A again + new Bar B
    createNightOnDate("2025-03-15", [{ name: "Bar A" }, { name: "Bar B" }]);
    const highlights = getNightHighlights("2025-03-15");
    const firstVisits = highlights.filter(h => h.type === "first-visit");
    const venueNames = firstVisits.map(h => h.venue);
    expect(venueNames).not.toContain("Bar A");
    expect(venueNames).toContain("Bar B");
  });
});

/* ─── getVibeCloud ─── */

describe("getVibeCloud", () => {
  beforeEach(() => { clearStore(); });

  it("returns empty array when no data", () => {
    expect(getVibeCloud("2025-03-15")).toEqual([]);
  });

  it("collects vibes from stops", () => {
    createNightOnDate("2025-03-15", [
      { name: "Bar A", vibes: "chill,dark" },
      { name: "Bar B", vibes: "loud" },
    ]);
    const cloud = getVibeCloud("2025-03-15");
    const tags = cloud.map(v => v.tag);
    expect(tags).toContain("chill");
    expect(tags).toContain("dark");
    expect(tags).toContain("loud");
  });

  it("counts vibe frequency correctly", () => {
    createNightOnDate("2025-03-15", [
      { name: "Bar A", vibes: "chill" },
      { name: "Bar B", vibes: "chill,dark" },
      { name: "Bar C", vibes: "chill" },
    ]);
    const cloud = getVibeCloud("2025-03-15");
    const chill = cloud.find(v => v.tag === "chill");
    const dark = cloud.find(v => v.tag === "dark");
    expect(chill.count).toBe(3);
    expect(dark.count).toBe(1);
  });

  it("sorts by count descending", () => {
    createNightOnDate("2025-03-15", [
      { name: "A", vibes: "rare" },
      { name: "B", vibes: "common,common" },
      { name: "C", vibes: "common" },
    ]);
    const cloud = getVibeCloud("2025-03-15");
    // First entry should have highest count
    for (let i = 1; i < cloud.length; i++) {
      expect(cloud[i - 1].count).toBeGreaterThanOrEqual(cloud[i].count);
    }
  });

  it("includes music genres in vibe cloud", () => {
    createNightOnDate("2025-03-15", [{ name: "Bar A" }]);
    addMusicReports("2025-03-15", [{ genre: "Jazz" }]);
    const cloud = getVibeCloud("2025-03-15");
    const tags = cloud.map(v => v.tag);
    expect(tags).toContain("Jazz");
  });
});

/* ─── getShareableText ─── */

describe("getShareableText", () => {
  beforeEach(() => { clearStore(); });

  it("returns null when no data", () => {
    expect(getShareableText("2025-03-15")).toBeNull();
  });

  it("contains header line", () => {
    createNightOnDate("2025-03-15", [{ name: "Bar A" }]);
    const text = getShareableText("2025-03-15");
    expect(text).toContain("Late Night Vibes - Morning Recap");
  });

  it("contains night score", () => {
    createNightOnDate("2025-03-15", [{ name: "Bar A" }]);
    const text = getShareableText("2025-03-15");
    expect(text).toContain("Night Score:");
    expect(text).toContain("/100");
  });

  it("contains venue count", () => {
    createNightOnDate("2025-03-15", [
      { name: "Bar A" },
      { name: "Bar B" },
    ]);
    const text = getShareableText("2025-03-15");
    expect(text).toContain("Venues: 2");
  });

  it("lists venue names", () => {
    createNightOnDate("2025-03-15", [
      { name: "The Owl Bar" },
      { name: "Neon Lounge" },
    ]);
    const text = getShareableText("2025-03-15");
    expect(text).toContain("The Owl Bar");
    expect(text).toContain("Neon Lounge");
  });

  it("includes vibes section when vibes exist", () => {
    createNightOnDate("2025-03-15", [
      { name: "Bar A", vibes: "chill,dark" },
    ]);
    const text = getShareableText("2025-03-15");
    expect(text).toContain("Vibes:");
  });

  it("includes spend when present", () => {
    createNightOnDate("2025-03-15", [
      { name: "Bar A", spend: 45 },
    ]);
    const text = getShareableText("2025-03-15");
    expect(text).toContain("Spent: $45.00");
  });

  it("includes date in display format", () => {
    createNightOnDate("2025-03-15", [{ name: "Bar A" }]);
    const text = getShareableText("2025-03-15");
    expect(text).toContain("Saturday");
    expect(text).toContain("Mar");
    expect(text).toContain("2025");
  });

  it("ends with branding", () => {
    createNightOnDate("2025-03-15", [{ name: "Bar A" }]);
    const text = getShareableText("2025-03-15");
    expect(text).toContain("- Late Night Vibes Seattle");
  });

  it("includes highlights for first-time venues", () => {
    createNightOnDate("2025-03-15", [{ name: "New Spot" }]);
    const text = getShareableText("2025-03-15");
    expect(text).toContain("Highlights:");
    expect(text).toContain("First time at New Spot");
  });
});

/* ─── generateRecap ─── */

describe("generateRecap", () => {
  beforeEach(() => { clearStore(); });

  it("returns null when no data", () => {
    expect(generateRecap("2025-03-15")).toBeNull();
  });

  it("returns a complete recap object", () => {
    createNightOnDate("2025-03-15", [
      { name: "Bar A", vibes: "chill", rating: 4 },
      { name: "Bar B", vibes: "loud", rating: 3 },
    ]);
    const recap = generateRecap("2025-03-15");
    expect(recap).not.toBeNull();
    expect(recap.date).toBe("2025-03-15");
    expect(recap.nightScore).toBeGreaterThanOrEqual(0);
    expect(recap.stats).toBeDefined();
    expect(recap.highlights).toBeDefined();
    expect(recap.vibeCloud).toBeDefined();
    expect(recap.shareText).toBeDefined();
    expect(recap.venues).toBeDefined();
  });

  it("stores recap in localStorage", () => {
    createNightOnDate("2025-03-15", [{ name: "Bar A" }]);
    generateRecap("2025-03-15");
    const raw = store[SCOPED_KEY];
    expect(raw).toBeTruthy();
    const recaps = JSON.parse(raw);
    expect(recaps.length).toBe(1);
    expect(recaps[0].date).toBe("2025-03-15");
  });

  it("replaces existing recap for same date", () => {
    createNightOnDate("2025-03-15", [{ name: "Bar A" }]);
    generateRecap("2025-03-15");
    generateRecap("2025-03-15");
    const recaps = JSON.parse(store[SCOPED_KEY]);
    expect(recaps.length).toBe(1);
  });

  it("stores multiple recaps for different dates", () => {
    createNightOnDate("2025-03-14", [{ name: "Bar A" }]);
    createNightOnDate("2025-03-15", [{ name: "Bar B" }]);
    generateRecap("2025-03-14");
    generateRecap("2025-03-15");
    const recaps = JSON.parse(store[SCOPED_KEY]);
    expect(recaps.length).toBe(2);
  });

  it("includes mood from session", () => {
    createNightOnDate("2025-03-15", [{ name: "Bar A" }], "amazing");
    const recap = generateRecap("2025-03-15");
    expect(recap.mood).toBe("amazing");
  });

  it("sets generatedAt timestamp", () => {
    createNightOnDate("2025-03-15", [{ name: "Bar A" }]);
    const recap = generateRecap("2025-03-15");
    expect(typeof recap.generatedAt).toBe("number");
    expect(recap.generatedAt).toBeGreaterThan(0);
  });

  it("includes shareText in recap", () => {
    createNightOnDate("2025-03-15", [{ name: "Bar A" }]);
    const recap = generateRecap("2025-03-15");
    expect(typeof recap.shareText).toBe("string");
    expect(recap.shareText.length).toBeGreaterThan(0);
  });
});

/* ─── getRecapHistory ─── */

describe("getRecapHistory", () => {
  beforeEach(() => { clearStore(); });

  it("returns empty array when no recaps exist", () => {
    expect(getRecapHistory()).toEqual([]);
  });

  it("returns stored recaps sorted by date descending", () => {
    createNightOnDate("2025-03-14", [{ name: "Bar A" }]);
    createNightOnDate("2025-03-15", [{ name: "Bar B" }]);
    generateRecap("2025-03-14");
    generateRecap("2025-03-15");
    const history = getRecapHistory();
    expect(history.length).toBe(2);
    expect(history[0].date).toBe("2025-03-15");
    expect(history[1].date).toBe("2025-03-14");
  });

  it("includes all recap fields in history entries", () => {
    createNightOnDate("2025-03-15", [{ name: "Bar A" }]);
    generateRecap("2025-03-15");
    const history = getRecapHistory();
    expect(history[0].nightScore).toBeDefined();
    expect(history[0].stats).toBeDefined();
    expect(history[0].date).toBe("2025-03-15");
  });
});

/* ─── Edge cases ─── */

describe("edge cases", () => {
  beforeEach(() => { clearStore(); });

  it("handles single venue night", () => {
    createNightOnDate("2025-03-15", [{ name: "Solo Spot" }]);
    const recap = generateRecap("2025-03-15");
    expect(recap).not.toBeNull();
    expect(recap.stats.totalVenues).toBe(1);
    expect(recap.venues.length).toBe(1);
    expect(recap.nightScore).toBeGreaterThan(0);
  });

  it("handles very long night with many stops", () => {
    const stops = [];
    for (let i = 0; i < 10; i++) {
      stops.push({ name: "Venue " + (i + 1), vibes: "vibe" + i, rating: (i % 5) + 1 });
    }
    createNightOnDate("2025-03-15", stops);
    const recap = generateRecap("2025-03-15");
    expect(recap).not.toBeNull();
    expect(recap.stats.totalVenues).toBe(10);
    expect(recap.nightScore).toBeGreaterThan(0);
    expect(recap.nightScore).toBeLessThanOrEqual(100);
  });

  it("handles night with only crawl data (no timeline)", () => {
    const history = {};
    const visitDate = new Date(2025, 2, 15, 22, 0, 0);
    markVisited(history, "Crawl Bar", 1);
    history["Crawl Bar"].visitedAt = visitDate.toISOString();
    saveCrawlHistory(history);
    expect(hasNightData("2025-03-15")).toBe(true);
  });

  it("handles night with no vibes on any stops", () => {
    createNightOnDate("2025-03-15", [
      { name: "Bar A" },
      { name: "Bar B" },
    ]);
    const cloud = getVibeCloud("2025-03-15");
    // Should be empty or only contain music genres
    expect(Array.isArray(cloud)).toBe(true);
  });

  it("handles night with no ratings", () => {
    createNightOnDate("2025-03-15", [
      { name: "Bar A" },
      { name: "Bar B" },
    ]);
    const stats = getNightStats("2025-03-15");
    expect(stats.avgRating).toBe(0);
  });
});

/* ─── Date handling ─── */

describe("date handling", () => {
  beforeEach(() => { clearStore(); _resetNowFn(); });

  it("accepts YYYY-MM-DD format", () => {
    createNightOnDate("2025-03-15", [{ name: "Bar A" }]);
    expect(hasNightData("2025-03-15")).toBe(true);
  });

  it("does not match data from other dates", () => {
    createNightOnDate("2025-03-15", [{ name: "Bar A" }]);
    expect(hasNightData("2025-03-16")).toBe(false);
  });

  it("handles early-morning hours as previous night", () => {
    // A night session that ends at 2 AM on March 16 should belong to March 15's night
    const parts = "2025-03-15".split("-");
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);

    const startTime = new Date(year, month, day, 23, 0, 0).getTime(); // 11 PM Mar 15
    const endTime = new Date(year, month, day + 1, 2, 0, 0).getTime(); // 2 AM Mar 16

    const night = {
      id: startTime,
      name: "Late Night",
      startTime: startTime,
      endTime: endTime,
      stops: [
        {
          venueName: "After Hours Club",
          arrivalTime: new Date(year, month, day + 1, 0, 30, 0).getTime(), // 12:30 AM Mar 16
          departureTime: new Date(year, month, day + 1, 1, 30, 0).getTime(),
          rating: null, vibes: null, drink: null, spend: null,
        }
      ],
      photos: [],
      notes: [],
      mood: null,
    };
    store[TIMELINE_KEY] = JSON.stringify([night]);
    // The session started on Mar 15 so it should match
    expect(hasNightData("2025-03-15")).toBe(true);
  });

  it("defaults to last night when _setNowFn is used", () => {
    // Set "now" to March 16 at 10 AM
    _setNowFn(() => new Date(2025, 2, 16, 10, 0, 0).getTime());

    // Create night data for March 15
    createNightOnDate("2025-03-15", [{ name: "Bar A" }]);

    // hasNightData with no explicit date should default to "last night" = March 15
    expect(hasNightData()).toBe(true);

    _resetNowFn();
  });
});

/* ─── Music and social integration ─── */

describe("music and social integration", () => {
  beforeEach(() => { clearStore(); });

  it("music genres appear in stats", () => {
    createNightOnDate("2025-03-15", [{ name: "Bar A" }]);
    addMusicReports("2025-03-15", [
      { genre: "House", venueName: "Bar A" },
      { genre: "Techno", venueName: "Bar A" },
    ]);
    const stats = getNightStats("2025-03-15");
    expect(stats.musicGenres).toBe(2);
    expect(stats.genres).toHaveProperty("House");
    expect(stats.genres).toHaveProperty("Techno");
  });

  it("social posts are counted in stats", () => {
    createNightOnDate("2025-03-15", [{ name: "Bar A" }]);
    addSocialPosts("2025-03-15", [
      { type: "checkin", venueName: "Bar A" },
      { type: "review", venueName: "Bar A" },
    ]);
    const stats = getNightStats("2025-03-15");
    expect(stats.socialPosts).toBe(2);
    expect(stats.checkins).toBe(1);
  });
});
