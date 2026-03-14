/**
 * Integration tests: verify that all city CSV files exist, have valid
 * headers, correct columns, and neighborhoods that match cities.js.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { CITIES, getAllCities } from "../lib/cities.js";

const ROOT = process.cwd();

const REQUIRED_HEADERS = [
  "area",
  "name",
  "category",
  "typical closing time",
  "address",
  "phone",
  "website",
  "driving distance",
  "google maps driving link",
  "vibe tags",
];

const OPTIONAL_EXTRA_HEADERS = ["latitude", "longitude"];

/** Parse a simple CSV into rows of strings, handling quoted fields. */
function parseCSVRows(text) {
  const rows = [];
  let current = "";
  let inQuotes = false;
  const cells = [];
  function pushCell() { cells.push(current); current = ""; }
  function pushRow() { if (cells.length > 0) rows.push(cells.splice(0)); }
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === "\"") {
      const next = text[i + 1];
      if (inQuotes && next === "\"") { current += "\""; i++; }
      else inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      pushCell();
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      pushCell(); pushRow();
    } else {
      current += char;
    }
  }
  if (current.length > 0 || cells.length > 0) { pushCell(); pushRow(); }
  return rows;
}

describe("city CSV files", () => {
  const cities = getAllCities();

  cities.forEach((city) => {
    describe(`${city.name} (${city.csv})`, () => {
      const csvPath = join(ROOT, city.csv);

      it("CSV file exists", () => {
        expect(existsSync(csvPath)).toBe(true);
      });

      it("CSV file is non-empty", () => {
        const text = readFileSync(csvPath, "utf-8");
        expect(text.trim().length).toBeGreaterThan(0);
      });

      it("has the correct required headers in order", () => {
        const text = readFileSync(csvPath, "utf-8");
        const rows = parseCSVRows(text);
        const headers = rows[0].map((h) => h.trim().toLowerCase());
        // All CSVs must start with the required headers; new city CSVs may
        // also include optional Latitude/Longitude columns at the end.
        const requiredPart = headers.slice(0, REQUIRED_HEADERS.length);
        expect(requiredPart).toEqual(REQUIRED_HEADERS);
        const extra = headers.slice(REQUIRED_HEADERS.length);
        expect(extra.every((h) => OPTIONAL_EXTRA_HEADERS.includes(h))).toBe(
          true
        );
      });

      it("has at least one data row beyond the header", () => {
        const text = readFileSync(csvPath, "utf-8");
        const rows = parseCSVRows(text);
        expect(rows.length).toBeGreaterThanOrEqual(2);
      });

      it("each data row has the correct number of columns", () => {
        const text = readFileSync(csvPath, "utf-8");
        const rows = parseCSVRows(text);
        const expectedCols = rows[0].length;
        rows.slice(1).forEach((row) => {
          expect(row.length).toBe(expectedCols);
        });
      });

      it("each data row has non-empty name, category, and area", () => {
        const text = readFileSync(csvPath, "utf-8");
        const rows = parseCSVRows(text);
        const headers = rows[0].map((h) => h.trim().toLowerCase());
        const nameIdx = headers.indexOf("name");
        const catIdx = headers.indexOf("category");
        const areaIdx = headers.indexOf("area");
        rows.slice(1).forEach((row) => {
          expect(row[nameIdx].trim().length).toBeGreaterThan(0);
          expect(row[catIdx].trim().length).toBeGreaterThan(0);
          expect(row[areaIdx].trim().length).toBeGreaterThan(0);
        });
      });

      it("areas in CSV match neighborhoods defined in cities.js", () => {
        const text = readFileSync(csvPath, "utf-8");
        const rows = parseCSVRows(text);
        const headers = rows[0].map((h) => h.trim().toLowerCase());
        const areaIdx = headers.indexOf("area");

        const csvAreas = new Set(
          rows.slice(1).map((row) => row[areaIdx].trim())
        );

        csvAreas.forEach((area) => {
          expect(
            city.neighborhoods,
            `Area "${area}" in ${city.csv} is not listed in cities.js for ${city.name}`
          ).toContain(area);
        });
      });

      it("vibe tags column exists and is non-empty for each row", () => {
        const text = readFileSync(csvPath, "utf-8");
        const rows = parseCSVRows(text);
        const headers = rows[0].map((h) => h.trim().toLowerCase());
        const vibeIdx = headers.indexOf("vibe tags");
        rows.slice(1).forEach((row) => {
          expect(row[vibeIdx]).toBeDefined();
          expect(row[vibeIdx].trim().length).toBeGreaterThan(0);
        });
      });
    });
  });
});

describe("all city CSVs as a group", () => {
  it("every city in the registry has a CSV path", () => {
    const cities = getAllCities();
    cities.forEach((city) => {
      expect(city.csv).toBeTruthy();
      expect(city.csv).toMatch(/\.csv$/);
    });
  });

  it("no duplicate CSV paths across cities", () => {
    const cities = getAllCities();
    const paths = cities.map((c) => c.csv);
    expect(new Set(paths).size).toBe(paths.length);
  });
});
