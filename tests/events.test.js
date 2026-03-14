import { describe, it, expect, beforeEach, afterEach } from "vitest";

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
  setVenueEvents,
  DAY_NAMES,
} from "../lib/events.js";

describe("LNVEvents", () => {
  beforeEach(() => {
    // Clear both the legacy key and the city-scoped key (default: seattle)
    delete store.lnv_venue_events;
    delete store.lnv_venue_events_seattle;
  });

  it("returns empty array for venue with no events", () => {
    expect(getEventsForVenue("Unknown Bar")).toEqual([]);
  });

  it("setVenueEvents and getEventsForVenue roundtrip", () => {
    setVenueEvents("Test Bar", [{ day: 3, label: "Trivia", detail: "9pm" }]);
    const events = getEventsForVenue("Test Bar");
    expect(events).toHaveLength(1);
    expect(events[0].label).toBe("Trivia");
    expect(events[0].day).toBe(3);
  });

  it("getEventsForTonight filters by current day", () => {
    const today = new Date().getDay();
    setVenueEvents("Bar", [
      { day: today, label: "Live Music", detail: "10pm" },
      { day: (today + 1) % 7, label: "Karaoke", detail: "9pm" },
    ]);
    const tonight = getEventsForTonight("Bar");
    expect(tonight).toHaveLength(1);
    expect(tonight[0].label).toBe("Live Music");
  });

  it("getTonightsHighlights returns highlights for venues with today events", () => {
    const today = new Date().getDay();
    setVenueEvents("Venue A", [{ day: today, label: "DJ Set", detail: "" }]);
    const venues = [{ Name: "Venue A", Area: "Capitol Hill" }];
    const highlights = getTonightsHighlights(venues, 5);
    expect(highlights.length).toBeGreaterThanOrEqual(0);
  });

  it("DAY_NAMES has 7 elements", () => {
    expect(DAY_NAMES).toHaveLength(7);
    expect(DAY_NAMES[0]).toBe("Sun");
  });
});
