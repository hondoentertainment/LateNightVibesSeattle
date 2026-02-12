/**
 * Integration tests: load real venue CSV and run smoke tests.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { loadDataFromCSV, collectVibes, parseTimeToMinutes } from "../lib/core.js";

const CSV_PATH = join(process.cwd(), "venue_list_500plus.csv");

function loadVenues() {
  const text = readFileSync(CSV_PATH, "utf-8");
  return loadDataFromCSV(text);
}

describe("venue_list_500plus.csv integration", () => {
  let venues;

  beforeAll(() => {
    venues = loadVenues();
  });

  it("loads a non-empty list of venues", () => {
    expect(venues.length).toBeGreaterThan(100);
  });

  it("each venue has Name, Area, Category", () => {
    venues.forEach((v) => {
      expect(v).toHaveProperty("Name");
      expect(v).toHaveProperty("Area");
      expect(v).toHaveProperty("Category");
    });
  });

  it("has expected columns from schema", () => {
    const first = venues[0];
    expect(first).toHaveProperty("Vibe Tags");
    expect(first).toHaveProperty("Typical Closing Time");
    expect(first).toHaveProperty("Driving Distance");
    expect(first).toHaveProperty("Google Maps Driving Link");
  });

  it("vibe tags are parseable", () => {
    const vibes = collectVibes(venues);
    expect(vibes.size).toBeGreaterThan(10);
  });

  it("venues have unique or near-unique Name+Area (data may have rare dupes)", () => {
    const keys = new Set(venues.map((v) => `${v.Name}|${v.Area}`));
    expect(keys.size).toBeGreaterThan(venues.length * 0.99);
  });

  it("closing times are parseable", () => {
    const withClosing = venues.filter((v) => v["Typical Closing Time"]?.trim());
    const parsed = withClosing.filter((v) => parseTimeToMinutes(v["Typical Closing Time"]) !== null);
    expect(parsed.length).toBeGreaterThan(0);
  });
});
