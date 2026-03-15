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
  startNight,
  endNight,
  getActiveNight,
  checkIn,
  checkOut,
  addPhoto,
  addNote,
  getNightRecap,
  setNightMood,
  getNightHistory,
  getNightById,
  deleteNight,
  getNightStats,
  exportNight,
  importNight,
  generateShareText,
} from "../lib/night-timeline.js";

function clearStore() {
  for (const key in store) { delete store[key]; }
}

// The cities module scopes storage keys with a city suffix
const SCOPED_KEY = STORAGE_KEY + "_seattle";

/* ─── STORAGE_KEY ─── */

describe("STORAGE_KEY", () => {
  it("is a non-empty string", () => {
    expect(typeof STORAGE_KEY).toBe("string");
    expect(STORAGE_KEY.length).toBeGreaterThan(0);
  });

  it("equals lnv_night_timeline", () => {
    expect(STORAGE_KEY).toBe("lnv_night_timeline");
  });
});

/* ─── 1. Night Sessions ─── */

describe("startNight", () => {
  beforeEach(() => { clearStore(); });

  it("creates a new night session", () => {
    const night = startNight("Friday Vibes");
    expect(night).not.toBeNull();
    expect(night.name).toBe("Friday Vibes");
  });

  it("assigns a timestamp-based id", () => {
    const night = startNight();
    expect(typeof night.id).toBe("number");
    expect(night.id).toBeGreaterThan(0);
  });

  it("defaults name to date-based string when not provided", () => {
    const night = startNight();
    expect(night.name).toMatch(/^Night Out - /);
  });

  it("initializes stops as empty array", () => {
    const night = startNight();
    expect(Array.isArray(night.stops)).toBe(true);
    expect(night.stops.length).toBe(0);
  });

  it("initializes photos as empty array", () => {
    const night = startNight();
    expect(Array.isArray(night.photos)).toBe(true);
    expect(night.photos.length).toBe(0);
  });

  it("initializes notes as empty array", () => {
    const night = startNight();
    expect(Array.isArray(night.notes)).toBe(true);
    expect(night.notes.length).toBe(0);
  });

  it("initializes mood as null", () => {
    const night = startNight();
    expect(night.mood).toBeNull();
  });

  it("initializes endTime as null", () => {
    const night = startNight();
    expect(night.endTime).toBeNull();
  });

  it("sets startTime", () => {
    const night = startNight();
    expect(typeof night.startTime).toBe("number");
    expect(night.startTime).toBeGreaterThan(0);
  });

  it("returns null if a night is already active", () => {
    startNight("First");
    const second = startNight("Second");
    expect(second).toBeNull();
  });

  it("allows starting a new night after ending the previous one", () => {
    startNight("First");
    endNight();
    const second = startNight("Second");
    expect(second).not.toBeNull();
    expect(second.name).toBe("Second");
  });

  it("persists the night to storage", () => {
    startNight("Persisted");
    const raw = store[SCOPED_KEY];
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw);
    expect(parsed.length).toBe(1);
    expect(parsed[0].name).toBe("Persisted");
  });
});

describe("endNight", () => {
  beforeEach(() => { clearStore(); });

  it("ends the active night and sets endTime", () => {
    startNight();
    const ended = endNight();
    expect(ended).not.toBeNull();
    expect(typeof ended.endTime).toBe("number");
    expect(ended.endTime).toBeGreaterThan(0);
  });

  it("returns null if no active night", () => {
    expect(endNight()).toBeNull();
  });

  it("returns null after night already ended", () => {
    startNight();
    endNight();
    expect(endNight()).toBeNull();
  });

  it("persists the ended state", () => {
    startNight();
    endNight();
    const parsed = JSON.parse(store[SCOPED_KEY]);
    expect(parsed[0].endTime).toBeTruthy();
  });
});

describe("getActiveNight", () => {
  beforeEach(() => { clearStore(); });

  it("returns null when no nights exist", () => {
    expect(getActiveNight()).toBeNull();
  });

  it("returns the active night", () => {
    startNight("Active");
    const active = getActiveNight();
    expect(active).not.toBeNull();
    expect(active.name).toBe("Active");
  });

  it("returns null after night ended", () => {
    startNight();
    endNight();
    expect(getActiveNight()).toBeNull();
  });
});

/* ─── 2. Check-ins ─── */

describe("checkIn", () => {
  beforeEach(() => { clearStore(); });

  it("adds a stop to the active night", () => {
    startNight();
    const stop = checkIn("The Owl Bar");
    expect(stop).not.toBeNull();
    expect(stop.venueName).toBe("The Owl Bar");
  });

  it("returns null if no active night", () => {
    expect(checkIn("Bar")).toBeNull();
  });

  it("returns null if venueName is empty string", () => {
    startNight();
    expect(checkIn("")).toBeNull();
  });

  it("returns null if venueName is null", () => {
    startNight();
    expect(checkIn(null)).toBeNull();
  });

  it("returns null if venueName is undefined", () => {
    startNight();
    expect(checkIn(undefined)).toBeNull();
  });

  it("returns null if venueName is whitespace-only", () => {
    startNight();
    expect(checkIn("   ")).toBeNull();
  });

  it("sets arrivalTime", () => {
    startNight();
    const stop = checkIn("Venue");
    expect(typeof stop.arrivalTime).toBe("number");
  });

  it("initializes departureTime as null", () => {
    startNight();
    const stop = checkIn("Venue");
    expect(stop.departureTime).toBeNull();
  });

  it("accepts rating in details", () => {
    startNight();
    const stop = checkIn("Bar", { rating: 4 });
    expect(stop.rating).toBe(4);
  });

  it("ignores rating out of range (0)", () => {
    startNight();
    const stop = checkIn("Bar", { rating: 0 });
    expect(stop.rating).toBeNull();
  });

  it("ignores rating out of range (6)", () => {
    startNight();
    const stop = checkIn("Bar", { rating: 6 });
    expect(stop.rating).toBeNull();
  });

  it("accepts vibes string", () => {
    startNight();
    const stop = checkIn("Bar", { vibes: "chill" });
    expect(stop.vibes).toBe("chill");
  });

  it("accepts drink string", () => {
    startNight();
    const stop = checkIn("Bar", { drink: "Old Fashioned" });
    expect(stop.drink).toBe("Old Fashioned");
  });

  it("accepts spend number", () => {
    startNight();
    const stop = checkIn("Bar", { spend: 25.50 });
    expect(stop.spend).toBe(25.50);
  });

  it("ignores negative spend", () => {
    startNight();
    const stop = checkIn("Bar", { spend: -10 });
    expect(stop.spend).toBeNull();
  });

  it("defaults all details to null when not provided", () => {
    startNight();
    const stop = checkIn("Bar");
    expect(stop.rating).toBeNull();
    expect(stop.vibes).toBeNull();
    expect(stop.drink).toBeNull();
    expect(stop.spend).toBeNull();
  });

  it("trims venueName", () => {
    startNight();
    const stop = checkIn("  Bar  ");
    expect(stop.venueName).toBe("Bar");
  });

  it("allows multiple stops", () => {
    startNight();
    checkIn("Bar A");
    checkIn("Bar B");
    const active = getActiveNight();
    expect(active.stops.length).toBe(2);
  });

  it("persists stops to storage", () => {
    startNight();
    checkIn("Bar A");
    const parsed = JSON.parse(store[SCOPED_KEY]);
    expect(parsed[0].stops.length).toBe(1);
  });
});

describe("checkOut", () => {
  beforeEach(() => { clearStore(); });

  it("sets departureTime on the matching stop", () => {
    startNight();
    checkIn("The Owl Bar");
    const stop = checkOut("The Owl Bar");
    expect(stop).not.toBeNull();
    expect(typeof stop.departureTime).toBe("number");
  });

  it("returns null if venue not found", () => {
    startNight();
    checkIn("Bar A");
    expect(checkOut("Bar B")).toBeNull();
  });

  it("returns null if no active night", () => {
    expect(checkOut("Bar")).toBeNull();
  });

  it("returns null with null venueName", () => {
    startNight();
    expect(checkOut(null)).toBeNull();
  });

  it("checks out the latest matching stop", () => {
    startNight();
    checkIn("Bar A");
    checkOut("Bar A");
    checkIn("Bar A");
    const stop = checkOut("Bar A");
    expect(stop).not.toBeNull();
    expect(stop.departureTime).toBeTruthy();
  });

  it("does not re-checkout an already checked-out stop", () => {
    startNight();
    checkIn("Bar A");
    checkOut("Bar A");
    expect(checkOut("Bar A")).toBeNull();
  });
});

/* ─── 3. Photo Memories ─── */

describe("addPhoto", () => {
  beforeEach(() => { clearStore(); });

  it("adds a photo to the active night", () => {
    startNight();
    const photo = addPhoto("https://example.com/pic.jpg");
    expect(photo).not.toBeNull();
    expect(photo.url).toBe("https://example.com/pic.jpg");
  });

  it("returns null if no active night", () => {
    expect(addPhoto("https://example.com/pic.jpg")).toBeNull();
  });

  it("returns null if url is empty", () => {
    startNight();
    expect(addPhoto("")).toBeNull();
  });

  it("returns null if url is null", () => {
    startNight();
    expect(addPhoto(null)).toBeNull();
  });

  it("sets caption when provided", () => {
    startNight();
    const photo = addPhoto("https://example.com/pic.jpg", "Great night!");
    expect(photo.caption).toBe("Great night!");
  });

  it("defaults caption to null", () => {
    startNight();
    const photo = addPhoto("https://example.com/pic.jpg");
    expect(photo.caption).toBeNull();
  });

  it("sets venueName when provided", () => {
    startNight();
    const photo = addPhoto("https://example.com/pic.jpg", null, "Bar A");
    expect(photo.venueName).toBe("Bar A");
  });

  it("defaults venueName to null", () => {
    startNight();
    const photo = addPhoto("https://example.com/pic.jpg");
    expect(photo.venueName).toBeNull();
  });

  it("sets timestamp", () => {
    startNight();
    const photo = addPhoto("https://example.com/pic.jpg");
    expect(typeof photo.timestamp).toBe("number");
  });

  it("persists photos to storage", () => {
    startNight();
    addPhoto("https://example.com/pic.jpg");
    const parsed = JSON.parse(store[SCOPED_KEY]);
    expect(parsed[0].photos.length).toBe(1);
  });
});

/* ─── 4. Night Notes ─── */

describe("addNote", () => {
  beforeEach(() => { clearStore(); });

  it("adds a note to the active night", () => {
    startNight();
    const note = addNote("Amazing DJ set!");
    expect(note).not.toBeNull();
    expect(note.text).toBe("Amazing DJ set!");
  });

  it("returns null if no active night", () => {
    expect(addNote("Note")).toBeNull();
  });

  it("returns null if text is empty", () => {
    startNight();
    expect(addNote("")).toBeNull();
  });

  it("returns null if text is null", () => {
    startNight();
    expect(addNote(null)).toBeNull();
  });

  it("returns null if text is not a string", () => {
    startNight();
    expect(addNote(123)).toBeNull();
  });

  it("sets venueName when provided", () => {
    startNight();
    const note = addNote("Great drinks", "Bar A");
    expect(note.venueName).toBe("Bar A");
  });

  it("defaults venueName to null", () => {
    startNight();
    const note = addNote("Note");
    expect(note.venueName).toBeNull();
  });

  it("sets timestamp", () => {
    startNight();
    const note = addNote("Note");
    expect(typeof note.timestamp).toBe("number");
  });

  it("persists notes to storage", () => {
    startNight();
    addNote("Note");
    const parsed = JSON.parse(store[SCOPED_KEY]);
    expect(parsed[0].notes.length).toBe(1);
  });
});

/* ─── 5. Night Recap ─── */

describe("getNightRecap", () => {
  beforeEach(() => { clearStore(); });

  it("returns null for non-existent nightId", () => {
    expect(getNightRecap(999)).toBeNull();
  });

  it("returns a recap object for a valid night", () => {
    const night = startNight("Epic Night");
    checkIn("Bar A", { rating: 5, spend: 30 });
    checkIn("Bar B", { rating: 3, spend: 20 });
    addPhoto("https://pic.jpg");
    addNote("Fun!");
    setNightMood("amazing");
    endNight();

    const recap = getNightRecap(night.id);
    expect(recap).not.toBeNull();
    expect(recap.name).toBe("Epic Night");
  });

  it("calculates totalStops correctly", () => {
    const night = startNight();
    checkIn("A");
    checkIn("B");
    checkIn("C");
    endNight();
    const recap = getNightRecap(night.id);
    expect(recap.totalStops).toBe(3);
  });

  it("calculates totalSpend correctly", () => {
    const night = startNight();
    checkIn("A", { spend: 10 });
    checkIn("B", { spend: 20 });
    endNight();
    const recap = getNightRecap(night.id);
    expect(recap.totalSpend).toBe(30);
  });

  it("lists venue names", () => {
    const night = startNight();
    checkIn("Alpha");
    checkIn("Beta");
    endNight();
    const recap = getNightRecap(night.id);
    expect(recap.venues).toEqual(["Alpha", "Beta"]);
  });

  it("identifies topRatedVenue", () => {
    const night = startNight();
    checkIn("Low", { rating: 2 });
    checkIn("High", { rating: 5 });
    endNight();
    const recap = getNightRecap(night.id);
    expect(recap.topRatedVenue).toBe("High");
  });

  it("counts photos", () => {
    const night = startNight();
    addPhoto("a.jpg");
    addPhoto("b.jpg");
    endNight();
    const recap = getNightRecap(night.id);
    expect(recap.photoCount).toBe(2);
  });

  it("counts notes", () => {
    const night = startNight();
    addNote("note 1");
    addNote("note 2");
    addNote("note 3");
    endNight();
    const recap = getNightRecap(night.id);
    expect(recap.noteCount).toBe(3);
  });

  it("calculates avgRating", () => {
    const night = startNight();
    checkIn("A", { rating: 4 });
    checkIn("B", { rating: 2 });
    endNight();
    const recap = getNightRecap(night.id);
    expect(recap.avgRating).toBe(3);
  });

  it("returns 0 avgRating when no ratings", () => {
    const night = startNight();
    checkIn("A");
    endNight();
    const recap = getNightRecap(night.id);
    expect(recap.avgRating).toBe(0);
  });

  it("includes moodSummary", () => {
    const night = startNight();
    setNightMood("great");
    endNight();
    const recap = getNightRecap(night.id);
    expect(recap.moodSummary).toBe("great");
  });

  it("includes duration", () => {
    const night = startNight();
    endNight();
    const recap = getNightRecap(night.id);
    expect(typeof recap.duration).toBe("number");
    expect(recap.duration).toBeGreaterThanOrEqual(0);
  });

  it("includes date string", () => {
    const night = startNight();
    endNight();
    const recap = getNightRecap(night.id);
    expect(typeof recap.date).toBe("string");
    expect(recap.date.length).toBeGreaterThan(0);
  });

  it("handles night with no stops", () => {
    const night = startNight();
    endNight();
    const recap = getNightRecap(night.id);
    expect(recap.totalStops).toBe(0);
    expect(recap.totalSpend).toBe(0);
    expect(recap.venues).toEqual([]);
    expect(recap.topRatedVenue).toBeNull();
  });
});

describe("setNightMood", () => {
  beforeEach(() => { clearStore(); });

  it("sets mood on active night", () => {
    startNight();
    expect(setNightMood("amazing")).toBe(true);
    const active = getActiveNight();
    expect(active.mood).toBe("amazing");
  });

  it("returns false if no active night", () => {
    expect(setNightMood("good")).toBe(false);
  });

  it("accepts all valid moods", () => {
    const moods = ["amazing", "great", "good", "meh", "rough"];
    for (const mood of moods) {
      clearStore();
      startNight();
      expect(setNightMood(mood)).toBe(true);
    }
  });

  it("rejects invalid mood string", () => {
    startNight();
    expect(setNightMood("terrible")).toBe(false);
  });

  it("rejects non-string mood", () => {
    startNight();
    expect(setNightMood(5)).toBe(false);
  });

  it("rejects null mood", () => {
    startNight();
    expect(setNightMood(null)).toBe(false);
  });
});

/* ─── 6. Night History ─── */

describe("getNightHistory", () => {
  beforeEach(() => { clearStore(); });

  it("returns empty array when no nights", () => {
    expect(getNightHistory()).toEqual([]);
  });

  it("excludes active (non-ended) nights", () => {
    startNight();
    expect(getNightHistory()).toEqual([]);
  });

  it("returns completed nights newest first", () => {
    // Manually create nights with distinct startTimes to test ordering
    const nights = [
      { id: 1000, name: "First", startTime: 1000, endTime: 2000, stops: [], photos: [], notes: [], mood: null },
      { id: 3000, name: "Second", startTime: 3000, endTime: 4000, stops: [], photos: [], notes: [], mood: null },
    ];
    store[SCOPED_KEY] = JSON.stringify(nights);
    const history = getNightHistory();
    expect(history.length).toBe(2);
    expect(history[0].name).toBe("Second");
    expect(history[1].name).toBe("First");
  });

  it("defaults limit to 10", () => {
    for (let i = 0; i < 15; i++) {
      startNight(`Night ${i}`);
      endNight();
    }
    const history = getNightHistory();
    expect(history.length).toBe(10);
  });

  it("respects custom limit", () => {
    for (let i = 0; i < 5; i++) {
      startNight(`Night ${i}`);
      endNight();
    }
    expect(getNightHistory(3).length).toBe(3);
  });

  it("returns all if fewer than limit", () => {
    startNight("Only");
    endNight();
    expect(getNightHistory(10).length).toBe(1);
  });
});

describe("getNightById", () => {
  beforeEach(() => { clearStore(); });

  it("returns the night with matching id", () => {
    const night = startNight("Target");
    endNight();
    const found = getNightById(night.id);
    expect(found).not.toBeNull();
    expect(found.name).toBe("Target");
  });

  it("returns null for non-existent id", () => {
    expect(getNightById(12345)).toBeNull();
  });

  it("returns active nights too", () => {
    const night = startNight("Active");
    const found = getNightById(night.id);
    expect(found).not.toBeNull();
  });
});

describe("deleteNight", () => {
  beforeEach(() => { clearStore(); });

  it("deletes a night and returns true", () => {
    const night = startNight();
    endNight();
    expect(deleteNight(night.id)).toBe(true);
    expect(getNightById(night.id)).toBeNull();
  });

  it("returns false for non-existent id", () => {
    expect(deleteNight(99999)).toBe(false);
  });

  it("persists deletion", () => {
    const night = startNight();
    endNight();
    deleteNight(night.id);
    const parsed = JSON.parse(store[SCOPED_KEY]);
    expect(parsed.length).toBe(0);
  });
});

describe("getNightStats", () => {
  beforeEach(() => { clearStore(); });

  it("returns zero stats when no nights", () => {
    const stats = getNightStats();
    expect(stats.totalNights).toBe(0);
    expect(stats.totalVenuesVisited).toBe(0);
    expect(stats.totalSpend).toBe(0);
    expect(stats.avgStopsPerNight).toBe(0);
    expect(stats.favoriteVenue).toBeNull();
    expect(stats.avgRating).toBe(0);
  });

  it("counts total nights", () => {
    startNight("A"); endNight();
    startNight("B"); endNight();
    expect(getNightStats().totalNights).toBe(2);
  });

  it("counts total venues visited", () => {
    startNight();
    checkIn("A"); checkIn("B"); checkIn("C");
    endNight();
    expect(getNightStats().totalVenuesVisited).toBe(3);
  });

  it("sums total spend", () => {
    startNight();
    checkIn("A", { spend: 15 });
    checkIn("B", { spend: 25 });
    endNight();
    expect(getNightStats().totalSpend).toBe(40);
  });

  it("calculates avg stops per night", () => {
    startNight(); checkIn("A"); checkIn("B"); endNight();
    startNight(); checkIn("C"); endNight();
    const stats = getNightStats();
    expect(stats.avgStopsPerNight).toBe(1.5);
  });

  it("identifies favorite venue (most visited)", () => {
    startNight(); checkIn("Popular"); checkIn("Once"); endNight();
    startNight(); checkIn("Popular"); endNight();
    expect(getNightStats().favoriteVenue).toBe("Popular");
  });

  it("calculates avg rating across all stops", () => {
    startNight();
    checkIn("A", { rating: 4 });
    checkIn("B", { rating: 2 });
    endNight();
    expect(getNightStats().avgRating).toBe(3);
  });

  it("excludes active nights from stats", () => {
    startNight();
    checkIn("A", { spend: 100 });
    const stats = getNightStats();
    expect(stats.totalNights).toBe(0);
    expect(stats.totalSpend).toBe(0);
  });
});

/* ─── 7. Share & Export ─── */

describe("exportNight", () => {
  beforeEach(() => { clearStore(); });

  it("exports a night as JSON string", () => {
    const night = startNight("Export Me");
    endNight();
    const json = exportNight(night.id);
    expect(typeof json).toBe("string");
    const parsed = JSON.parse(json);
    expect(parsed.name).toBe("Export Me");
  });

  it("returns null for non-existent id", () => {
    expect(exportNight(99999)).toBeNull();
  });

  it("includes all night data in export", () => {
    const night = startNight("Full");
    checkIn("Bar", { rating: 5, spend: 20 });
    addPhoto("pic.jpg", "caption");
    addNote("note");
    setNightMood("great");
    endNight();
    const parsed = JSON.parse(exportNight(night.id));
    expect(parsed.stops.length).toBe(1);
    expect(parsed.photos.length).toBe(1);
    expect(parsed.notes.length).toBe(1);
    expect(parsed.mood).toBe("great");
  });
});

describe("importNight", () => {
  beforeEach(() => { clearStore(); });

  it("imports a valid night JSON", () => {
    const nightData = {
      id: 12345,
      name: "Imported Night",
      startTime: Date.now() - 10000,
      endTime: Date.now(),
      stops: [],
      photos: [],
      notes: [],
      mood: "good",
    };
    const result = importNight(JSON.stringify(nightData));
    expect(result).not.toBeNull();
    expect(result.name).toBe("Imported Night");
  });

  it("persists imported night", () => {
    const nightData = {
      id: 12345, name: "Imported", startTime: 1000, endTime: 2000,
      stops: [], photos: [], notes: [], mood: null,
    };
    importNight(JSON.stringify(nightData));
    expect(getNightById(12345)).not.toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(importNight("not json")).toBeNull();
  });

  it("returns null for non-string input", () => {
    expect(importNight(123)).toBeNull();
  });

  it("returns null for null input", () => {
    expect(importNight(null)).toBeNull();
  });

  it("returns null if missing id", () => {
    expect(importNight(JSON.stringify({ name: "X", startTime: 1, stops: [], photos: [], notes: [] }))).toBeNull();
  });

  it("returns null if missing name", () => {
    expect(importNight(JSON.stringify({ id: 1, startTime: 1, stops: [], photos: [], notes: [] }))).toBeNull();
  });

  it("returns null if missing startTime", () => {
    expect(importNight(JSON.stringify({ id: 1, name: "X", stops: [], photos: [], notes: [] }))).toBeNull();
  });

  it("returns null if stops is not an array", () => {
    expect(importNight(JSON.stringify({ id: 1, name: "X", startTime: 1, stops: "nope", photos: [], notes: [] }))).toBeNull();
  });

  it("returns null if photos is not an array", () => {
    expect(importNight(JSON.stringify({ id: 1, name: "X", startTime: 1, stops: [], photos: "nope", notes: [] }))).toBeNull();
  });

  it("returns null if notes is not an array", () => {
    expect(importNight(JSON.stringify({ id: 1, name: "X", startTime: 1, stops: [], photos: [], notes: "nope" }))).toBeNull();
  });

  it("rejects duplicate id", () => {
    const nightData = {
      id: 55555, name: "Orig", startTime: 1000, endTime: 2000,
      stops: [], photos: [], notes: [], mood: null,
    };
    importNight(JSON.stringify(nightData));
    const dup = importNight(JSON.stringify(nightData));
    expect(dup).toBeNull();
  });

  it("roundtrips export → import", () => {
    const night = startNight("Roundtrip");
    checkIn("Venue X", { rating: 4, spend: 15 });
    addPhoto("photo.jpg", "fun");
    addNote("awesome");
    setNightMood("amazing");
    endNight();

    const exported = exportNight(night.id);
    deleteNight(night.id);
    expect(getNightById(night.id)).toBeNull();

    const imported = importNight(exported);
    expect(imported).not.toBeNull();
    expect(imported.name).toBe("Roundtrip");
    expect(imported.stops.length).toBe(1);
    expect(imported.photos.length).toBe(1);
    expect(imported.notes.length).toBe(1);
    expect(imported.mood).toBe("amazing");
  });

  it("returns null for empty object JSON", () => {
    expect(importNight("{}")).toBeNull();
  });

  it("returns null for array JSON", () => {
    expect(importNight("[]")).toBeNull();
  });
});

describe("generateShareText", () => {
  beforeEach(() => { clearStore(); });

  it("returns null for non-existent id", () => {
    expect(generateShareText(99999)).toBeNull();
  });

  it("generates text with moon emoji and name", () => {
    const night = startNight("Saturday Vibes");
    endNight();
    const text = generateShareText(night.id);
    expect(text).toContain("\uD83C\uDF19 Saturday Vibes");
  });

  it("includes venue stops", () => {
    const night = startNight("Test");
    checkIn("Bar Alpha", { rating: 4 });
    checkIn("Club Beta", { rating: 5 });
    endNight();
    const text = generateShareText(night.id);
    expect(text).toContain("1. Bar Alpha - 4\u2B50");
    expect(text).toContain("2. Club Beta - 5\u2B50");
  });

  it("includes Stops: header", () => {
    const night = startNight("Test");
    checkIn("Place");
    endNight();
    const text = generateShareText(night.id);
    expect(text).toContain("Stops:");
  });

  it("includes mood when set", () => {
    const night = startNight("Moody");
    setNightMood("rough");
    endNight();
    const text = generateShareText(night.id);
    expect(text).toContain("Mood: rough");
  });

  it("omits mood line when mood is null", () => {
    const night = startNight("No Mood");
    endNight();
    const text = generateShareText(night.id);
    expect(text).not.toContain("Mood:");
  });

  it("lists stops without rating when rating is null", () => {
    const night = startNight("Test");
    checkIn("No Rating Venue");
    endNight();
    const text = generateShareText(night.id);
    expect(text).toContain("1. No Rating Venue");
    expect(text).not.toContain("\u2B50");
  });
});
