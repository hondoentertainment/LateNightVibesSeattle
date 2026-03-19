import { describe, it, expect, beforeEach } from "vitest";

const store = {};
const mockLocalStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
if (typeof globalThis !== "undefined") globalThis.localStorage = mockLocalStorage;

import {
  getEventsForVenue,
  getEventsForTonight,
  getTonightsHighlights,
  getUpcomingEvents,
  setVenueEvents,
  generateRecurringEvents,
  DAY_NAMES,
  EVENT_RULES,
} from "../lib/events.js";

/* ─── Test venue fixtures ─── */

const VENUE_LIVE_MUSIC = {
  Name: "Neumos",
  Category: "Music Venue / Bar",
  "Vibe Tags": "drinks, live-music, loud, social",
};

const VENUE_KARAOKE = {
  Name: "Rock Box",
  Category: "Karaoke",
  "Vibe Tags": "group-fun, interactive",
};

const VENUE_GAME_BAR = {
  Name: "Add-a-Ball",
  Category: "Bar / Arcade",
  "Vibe Tags": "games, interactive, playful",
};

const VENUE_SPORTS_BAR = {
  Name: "Buckley's",
  Category: "Sports Bar",
  "Vibe Tags": "drinks, social, sports",
};

const VENUE_UPSCALE_COCKTAIL = {
  Name: "Canon",
  Category: "Cocktail Bar",
  "Vibe Tags": "date-friendly, drinks, social, upscale",
};

const VENUE_NIGHTCLUB = {
  Name: "Q Nightclub",
  Category: "Nightclub",
  "Vibe Tags": "dancey, high-energy, late-night",
};

const VENUE_LATE_EATS = {
  Name: "Lost Lake Cafe & Lounge",
  Category: "Diner / Bar",
  "Vibe Tags": "drinks, food-focused, late-eats, social",
};

const VENUE_DIVE_BAR = {
  Name: "Leny's Place",
  Category: "Dive Bar",
  "Vibe Tags": "divey, drinks, social",
};

const VENUE_PUB = {
  Name: "Summit Public House",
  Category: "Pub",
  "Vibe Tags": "drinks, social",
};

const VENUE_BREWERY = {
  Name: "Optimism Brewing",
  Category: "Brewery",
  "Vibe Tags": "chill, drinks, social",
};

const VENUE_PLAIN_BAR = {
  Name: "Some Plain Bar",
  Category: "Bar",
  "Vibe Tags": "drinks, social",
};

const VENUE_DANCEY_CLUB = {
  Name: "Havana",
  Category: "Bar / Club",
  "Vibe Tags": "dancey, drinks, high-energy, late-night, social",
};

const ALL_VENUES = [
  VENUE_LIVE_MUSIC, VENUE_KARAOKE, VENUE_GAME_BAR, VENUE_SPORTS_BAR,
  VENUE_UPSCALE_COCKTAIL, VENUE_NIGHTCLUB, VENUE_LATE_EATS, VENUE_DIVE_BAR,
  VENUE_PUB, VENUE_BREWERY, VENUE_PLAIN_BAR, VENUE_DANCEY_CLUB,
];

describe("LNVEvents", () => {
  beforeEach(() => {
    delete store.lnv_venue_events;
    delete store.lnv_venue_events_seattle;
  });

  /* ─── DAY_NAMES ─── */

  it("DAY_NAMES has 7 elements starting with Sun", () => {
    expect(DAY_NAMES).toHaveLength(7);
    expect(DAY_NAMES[0]).toBe("Sun");
    expect(DAY_NAMES[6]).toBe("Sat");
  });

  /* ─── EVENT_RULES ─── */

  it("EVENT_RULES is a non-empty array of rule objects", () => {
    expect(Array.isArray(EVENT_RULES)).toBe(true);
    expect(EVENT_RULES.length).toBeGreaterThan(0);
    EVENT_RULES.forEach((rule) => {
      expect(typeof rule.match).toBe("function");
      expect(Array.isArray(rule.events)).toBe(true);
      rule.events.forEach((e) => {
        expect(e).toHaveProperty("name");
        expect(e).toHaveProperty("dayOfWeek");
        expect(e).toHaveProperty("startTime");
        expect(e).toHaveProperty("endTime");
        expect(e).toHaveProperty("description");
      });
    });
  });

  /* ─── generateRecurringEvents ─── */

  describe("generateRecurringEvents", () => {
    it("returns empty array for null venue", () => {
      expect(generateRecurringEvents(null)).toEqual([]);
    });

    it("returns empty array for venue matching no rules", () => {
      const events = generateRecurringEvents(VENUE_PLAIN_BAR);
      expect(events).toEqual([]);
    });

    it("generates live music events for music venue", () => {
      const events = generateRecurringEvents(VENUE_LIVE_MUSIC);
      expect(events.length).toBeGreaterThan(0);
      events.forEach((e) => {
        expect(e.recurring).toBe(true);
        expect(e.name).toBe("Live Music Night");
        expect([4, 5, 6]).toContain(e.dayOfWeek); // Thu-Sat
      });
    });

    it("generates karaoke events for karaoke venue", () => {
      const events = generateRecurringEvents(VENUE_KARAOKE);
      expect(events.length).toBeGreaterThan(0);
      const names = events.map((e) => e.name);
      expect(names).toContain("Karaoke Night");
    });

    it("generates trivia/game events for arcade bar", () => {
      const events = generateRecurringEvents(VENUE_GAME_BAR);
      const names = events.map((e) => e.name);
      expect(names).toContain("Trivia Night");
      expect(names).toContain("Game Night");
    });

    it("generates watch party events for sports bar", () => {
      const events = generateRecurringEvents(VENUE_SPORTS_BAR);
      const names = events.map((e) => e.name);
      expect(names).toContain("Game Day Watch Party");
      // Sunday, Monday, Thursday
      const days = events
        .filter((e) => e.name === "Game Day Watch Party")
        .map((e) => e.dayOfWeek);
      expect(days).toContain(0); // Sun
      expect(days).toContain(1); // Mon
      expect(days).toContain(4); // Thu
    });

    it("generates happy hour for upscale cocktail bar", () => {
      const events = generateRecurringEvents(VENUE_UPSCALE_COCKTAIL);
      const happyHours = events.filter((e) => e.name === "Happy Hour");
      expect(happyHours.length).toBeGreaterThanOrEqual(4);
      happyHours.forEach((e) => {
        expect(e.startTime).toBe("17:00");
        expect(e.endTime).toBe("20:00");
      });
    });

    it("generates DJ/themed nights for nightclub", () => {
      const events = generateRecurringEvents(VENUE_NIGHTCLUB);
      const names = events.map((e) => e.name);
      expect(names).toContain("DJ Night");
      expect(names).toContain("Themed Dance Night");
    });

    it("generates late night menu for late-eats diner", () => {
      const events = generateRecurringEvents(VENUE_LATE_EATS);
      const names = events.map((e) => e.name);
      expect(names).toContain("Late Night Menu");
    });

    it("generates open mic and pub quiz for dive bar", () => {
      const events = generateRecurringEvents(VENUE_DIVE_BAR);
      const names = events.map((e) => e.name);
      expect(names).toContain("Open Mic Night");
      expect(names).toContain("Pub Quiz");
    });

    it("generates pub trivia for pub", () => {
      const events = generateRecurringEvents(VENUE_PUB);
      const names = events.map((e) => e.name);
      expect(names).toContain("Pub Trivia");
      expect(names).toContain("Pint Night");
    });

    it("generates tasting events for brewery", () => {
      const events = generateRecurringEvents(VENUE_BREWERY);
      const names = events.map((e) => e.name);
      expect(names).toContain("Tasting Flight Night");
    });

    it("generates multiple event types for venue matching multiple rules", () => {
      // Bar / Club with dancey + high-energy gets DJ nights AND themed nights
      const events = generateRecurringEvents(VENUE_DANCEY_CLUB);
      const names = [...new Set(events.map((e) => e.name))];
      expect(names).toContain("DJ Night");
      expect(names).toContain("Themed Dance Night");
    });

    it("generates karaoke + trivia for interactive karaoke venue", () => {
      // Karaoke venue also has "interactive" tag → may match games rule too
      const events = generateRecurringEvents(VENUE_KARAOKE);
      const names = [...new Set(events.map((e) => e.name))];
      expect(names).toContain("Karaoke Night");
      // "interactive" tag also triggers the games rule
      expect(names).toContain("Trivia Night");
    });

    it("all generated events have recurring: true", () => {
      ALL_VENUES.forEach((v) => {
        generateRecurringEvents(v).forEach((e) => {
          expect(e.recurring).toBe(true);
        });
      });
    });

    it("dayOfWeek values are always 0-6", () => {
      ALL_VENUES.forEach((v) => {
        generateRecurringEvents(v).forEach((e) => {
          expect(e.dayOfWeek).toBeGreaterThanOrEqual(0);
          expect(e.dayOfWeek).toBeLessThanOrEqual(6);
        });
      });
    });

    it("deduplicates events with same name and dayOfWeek", () => {
      // Dancey club matches the nightclub rule — ensure no dupe name+day
      const events = generateRecurringEvents(VENUE_DANCEY_CLUB);
      const keys = events.map((e) => e.name + ":" + e.dayOfWeek);
      const unique = [...new Set(keys)];
      expect(keys.length).toBe(unique.length);
    });
  });

  /* ─── getEventsForVenue ─── */

  describe("getEventsForVenue", () => {
    it("returns empty array for unknown venue with no venues list", () => {
      expect(getEventsForVenue("Unknown Bar")).toEqual([]);
    });

    it("returns recurring events when venues list is provided", () => {
      const events = getEventsForVenue("Neumos", ALL_VENUES);
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].recurring).toBe(true);
    });

    it("returns legacy localStorage events without venues list", () => {
      setVenueEvents("Test Bar", [{ day: 3, label: "Trivia", detail: "9pm" }]);
      const events = getEventsForVenue("Test Bar");
      expect(events).toHaveLength(1);
      expect(events[0].label).toBe("Trivia");
    });

    it("merges recurring and curated events", () => {
      setVenueEvents("Neumos", [{ day: 0, label: "Special Show", detail: "8pm" }]);
      const events = getEventsForVenue("Neumos", ALL_VENUES);
      const recurringCount = events.filter((e) => e.recurring).length;
      const curatedCount = events.filter((e) => e.label === "Special Show").length;
      expect(recurringCount).toBeGreaterThan(0);
      expect(curatedCount).toBe(1);
      expect(events.length).toBe(recurringCount + curatedCount);
    });

    it("returns empty for venue not in venues list", () => {
      const events = getEventsForVenue("Nonexistent Place", ALL_VENUES);
      expect(events).toEqual([]);
    });
  });

  /* ─── setVenueEvents / localStorage roundtrip ─── */

  describe("setVenueEvents", () => {
    it("roundtrips through localStorage", () => {
      setVenueEvents("Test Bar", [{ day: 3, label: "Trivia", detail: "9pm" }]);
      const events = getEventsForVenue("Test Bar");
      expect(events).toHaveLength(1);
      expect(events[0].day).toBe(3);
    });

    it("returns false for empty name", () => {
      expect(setVenueEvents("", [])).toBe(false);
    });
  });

  /* ─── getEventsForTonight ─── */

  describe("getEventsForTonight", () => {
    it("filters legacy events by current day", () => {
      const today = new Date().getDay();
      setVenueEvents("Bar", [
        { day: today, label: "Live Music", detail: "10pm" },
        { day: (today + 1) % 7, label: "Karaoke", detail: "9pm" },
      ]);
      const tonight = getEventsForTonight("Bar");
      expect(tonight).toHaveLength(1);
      expect(tonight[0].label).toBe("Live Music");
    });

    it("filters recurring events by current day when venues provided", () => {
      const today = new Date().getDay();
      // Nightclub has events on days 4, 5, 6 — check if today matches any
      const tonight = getEventsForTonight("Q Nightclub", ALL_VENUES);
      if ([4, 5, 6].includes(today)) {
        expect(tonight.length).toBeGreaterThan(0);
      } else {
        // Nightclub has no events on other days
        expect(tonight.length).toBe(0);
      }
    });
  });

  /* ─── getTonightsHighlights ─── */

  describe("getTonightsHighlights", () => {
    it("returns highlights from recurring events", () => {
      const highlights = getTonightsHighlights(ALL_VENUES, 50);
      // Every day has at least some venues with events
      expect(Array.isArray(highlights)).toBe(true);
      highlights.forEach((h) => {
        expect(h).toHaveProperty("venue");
        expect(h).toHaveProperty("event");
      });
    });

    it("respects limit parameter", () => {
      const highlights = getTonightsHighlights(ALL_VENUES, 3);
      expect(highlights.length).toBeLessThanOrEqual(3);
    });

    it("defaults to limit of 10", () => {
      const highlights = getTonightsHighlights(ALL_VENUES);
      expect(highlights.length).toBeLessThanOrEqual(10);
    });

    it("includes legacy localStorage events", () => {
      const today = new Date().getDay();
      setVenueEvents("Some Plain Bar", [{ day: today, label: "Curated Night", detail: "9pm" }]);
      const highlights = getTonightsHighlights(ALL_VENUES, 50);
      const curated = highlights.filter((h) => h.event.label === "Curated Night");
      expect(curated).toHaveLength(1);
    });

    it("returns results sorted by start time", () => {
      const highlights = getTonightsHighlights(ALL_VENUES, 50);
      for (let i = 1; i < highlights.length; i++) {
        const ta = (highlights[i - 1].event.startTime || highlights[i - 1].event.detail || "").toString();
        const tb = (highlights[i].event.startTime || highlights[i].event.detail || "").toString();
        expect(ta.localeCompare(tb)).toBeLessThanOrEqual(0);
      }
    });

    it("handles empty venues array", () => {
      expect(getTonightsHighlights([], 5)).toEqual([]);
    });

    it("handles null venues", () => {
      expect(getTonightsHighlights(null, 5)).toEqual([]);
    });
  });

  /* ─── getUpcomingEvents ─── */

  describe("getUpcomingEvents", () => {
    it("returns events within next N days", () => {
      const upcoming = getUpcomingEvents(ALL_VENUES, 7, 100);
      expect(upcoming.length).toBeGreaterThan(0);
      upcoming.forEach((item) => {
        expect(item).toHaveProperty("venue");
        expect(item).toHaveProperty("event");
        expect(item).toHaveProperty("date");
        expect(item.date).toBeInstanceOf(Date);
      });
    });

    it("respects limit parameter", () => {
      const upcoming = getUpcomingEvents(ALL_VENUES, 7, 5);
      expect(upcoming.length).toBeLessThanOrEqual(5);
    });

    it("defaults to 7 days and 20 limit", () => {
      const upcoming = getUpcomingEvents(ALL_VENUES);
      expect(upcoming.length).toBeLessThanOrEqual(20);
    });

    it("returns events sorted by date then time", () => {
      const upcoming = getUpcomingEvents(ALL_VENUES, 7, 100);
      for (let i = 1; i < upcoming.length; i++) {
        const prevDate = upcoming[i - 1].date.getTime();
        const currDate = upcoming[i].date.getTime();
        if (prevDate === currDate) {
          const prevTime = upcoming[i - 1].event.startTime || "";
          const currTime = upcoming[i].event.startTime || "";
          expect(prevTime.localeCompare(currTime)).toBeLessThanOrEqual(0);
        } else {
          expect(prevDate).toBeLessThanOrEqual(currDate);
        }
      }
    });

    it("all dates are within the requested range", () => {
      const days = 3;
      const now = new Date();
      const upcoming = getUpcomingEvents(ALL_VENUES, days, 100);
      const maxDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
      upcoming.forEach((item) => {
        expect(item.date.getTime()).toBeLessThan(maxDate.getTime());
        expect(item.date.getTime()).toBeGreaterThanOrEqual(
          new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
        );
      });
    });

    it("handles empty venues array", () => {
      expect(getUpcomingEvents([], 7, 10)).toEqual([]);
    });

    it("handles null venues", () => {
      expect(getUpcomingEvents(null, 7, 10)).toEqual([]);
    });

    it("1-day window only returns events for today", () => {
      const today = new Date().getDay();
      const upcoming = getUpcomingEvents(ALL_VENUES, 1, 100);
      upcoming.forEach((item) => {
        expect(item.date.getDay()).toBe(today);
      });
    });
  });

  /* ─── Venues with multiple event types ─── */

  describe("venues with multiple event types", () => {
    it("upscale cocktail bar gets happy hour AND date night", () => {
      const events = generateRecurringEvents(VENUE_UPSCALE_COCKTAIL);
      const names = [...new Set(events.map((e) => e.name))];
      expect(names).toContain("Happy Hour");
      expect(names).toContain("Date Night Special");
    });

    it("karaoke venue with interactive tag gets karaoke AND trivia", () => {
      const events = generateRecurringEvents(VENUE_KARAOKE);
      const names = [...new Set(events.map((e) => e.name))];
      expect(names.length).toBeGreaterThanOrEqual(2);
    });

    it("sports bar events span multiple days of the week", () => {
      const events = generateRecurringEvents(VENUE_SPORTS_BAR);
      const days = [...new Set(events.map((e) => e.dayOfWeek))];
      expect(days.length).toBeGreaterThanOrEqual(3);
    });

    it("nightclub has events on both Friday and Saturday", () => {
      const events = generateRecurringEvents(VENUE_NIGHTCLUB);
      const days = events.map((e) => e.dayOfWeek);
      expect(days).toContain(5); // Friday
      expect(days).toContain(6); // Saturday
    });
  });
});
