#!/usr/bin/env node

/**
 * Validate all CSV venue data files for every city in lib/cities.js.
 *
 * Checks (hard errors — exit 1):
 *   1. Expected headers are present.
 *   2. Required fields (Name, Area, Category) are non-empty.
 *   3. Each venue has at least 2 vibe tags.
 *   4. No duplicate venue names within the same city.
 *   5. Valid closing time format (e.g. "2:00 AM", "12:00 AM", "11:30 PM") or empty.
 *
 * Warnings (exit 0):
 *   - "Area" values not in cities.js neighborhoods.
 *   - Cities with fewer than 25 venues flagged as LOW COVERAGE.
 *
 * Prints per-city summary and overall summary.
 * Exit 0 if all checks pass, 1 if any hard errors.
 */

const fs = require("fs");
const path = require("path");
const cities = require("../lib/cities.js");

// ── CSV parser ──────────────────────────────────────────────────────────

function parseCSV(text) {
  const rows = [];
  let current = "";
  let inQuotes = false;
  const cells = [];
  function pushCell() { cells.push(current); current = ""; }
  function pushRow() { rows.push(cells.splice(0)); }
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

// ── Build neighborhood lookup from cities.js ────────────────────────────

function buildNeighborhoodMap() {
  const map = {};
  for (const [slug, city] of Object.entries(cities.CITIES)) {
    const csvFile = path.basename(city.csv);
    map[csvFile] = new Set(city.neighborhoods);
  }
  return map;
}

// ── Build city display-name lookup by CSV filename ──────────────────────

function buildCityNameMap() {
  const map = {};
  for (const [slug, city] of Object.entries(cities.CITIES)) {
    const csvFile = path.basename(city.csv);
    map[csvFile] = city.label || city.name;
  }
  return map;
}

// ── Closing-time validation ─────────────────────────────────────────────

const CLOSING_TIME_RE = /^\d{1,2}:\d{2}\s*(AM|PM)$/i;

const CLOSING_TIME_PATTERNS = [
  CLOSING_TIME_RE,
  /^\d{1,2}:\d{2}\s*(AM|PM)\+?$/i,
  /^\d{1,2}:\d{2}\s*[\u2013\u2014\-]\s*\d{1,2}:\d{2}\s*(AM|PM)$/i,
  /^Late(\s*\/\s*24h)?$/i,
  /^24h$/i,
];

function isValidClosingTime(value) {
  if (!value || value.trim() === "") return true;
  return CLOSING_TIME_PATTERNS.some((re) => re.test(value.trim()));
}

// ── Expected headers ────────────────────────────────────────────────────

const EXPECTED_HEADERS = [
  "Area", "Name", "Category", "Typical Closing Time",
  "Address", "Phone", "Website", "Driving Distance",
  "Google Maps Driving Link", "Vibe Tags",
];

const REQUIRED_FIELDS = ["Name", "Area", "Category"];

const MIN_VIBE_TAGS = 2;
const LOW_COVERAGE_THRESHOLD = 25;

// ── Validate a single file ──────────────────────────────────────────────

function validateFile(filePath, knownNeighborhoods) {
  const errors = [];
  const warnings = [];
  const text = fs.readFileSync(filePath, "utf-8");
  const rows = parseCSV(text);

  if (rows.length === 0) {
    errors.push("File is empty");
    return { errors, warnings, venueCount: 0 };
  }

  const headers = rows[0].map((h) => h.trim());
  const missingHeaders = EXPECTED_HEADERS.filter((h) => !headers.includes(h));
  if (missingHeaders.length) {
    errors.push(`Missing expected headers: ${missingHeaders.join(", ")}`);
    return { errors, warnings, venueCount: 0 };
  }

  const headerIndex = {};
  headers.forEach((h, i) => { headerIndex[h] = i; });

  const dataRows = rows.slice(1).filter((row) => row.some((c) => c && c.trim()));

  // Track duplicate venue names (case-insensitive)
  const seenNames = new Map(); // lowercase name -> first row number

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const lineNum = i + 2;

    // Required fields
    for (const field of REQUIRED_FIELDS) {
      const value = (row[headerIndex[field]] || "").trim();
      if (!value) {
        errors.push(`Row ${lineNum}: "${field}" is empty`);
      }
    }

    // Duplicate name check
    const name = (row[headerIndex["Name"]] || "").trim();
    if (name) {
      const nameLower = name.toLowerCase();
      if (seenNames.has(nameLower)) {
        errors.push(`Row ${lineNum}: Duplicate venue name "${name}" (first seen row ${seenNames.get(nameLower)})`);
      } else {
        seenNames.set(nameLower, lineNum);
      }
    }

    // Area neighborhood check
    const area = (row[headerIndex["Area"]] || "").trim();
    if (area && knownNeighborhoods && !knownNeighborhoods.has(area)) {
      warnings.push(`Row ${lineNum}: Area "${area}" not in cities.js neighborhoods`);
    }

    // Closing time format
    const closingTime = (row[headerIndex["Typical Closing Time"]] || "").trim();
    if (closingTime && !isValidClosingTime(closingTime)) {
      errors.push(`Row ${lineNum}: Invalid closing time format "${closingTime}"`);
    }

    // Vibe tag minimum
    const vibeTags = (row[headerIndex["Vibe Tags"]] || "").trim();
    const tags = vibeTags
      ? vibeTags.split(",").map((t) => t.trim()).filter(Boolean)
      : [];
    if (tags.length < MIN_VIBE_TAGS) {
      errors.push(`Row ${lineNum}: Venue "${name || "(unnamed)"}" has ${tags.length} vibe tag(s), minimum is ${MIN_VIBE_TAGS}`);
    }
  }

  return { errors, warnings, venueCount: dataRows.length };
}

// ── Main ────────────────────────────────────────────────────────────────

function main() {
  const dataDir = path.resolve(__dirname, "..", "data");

  if (!fs.existsSync(dataDir)) {
    console.error("ERROR: data/ directory not found");
    process.exit(1);
  }

  // Only validate CSVs referenced in cities.js
  const neighborhoodMap = buildNeighborhoodMap();
  const cityNameMap = buildCityNameMap();
  const expectedCsvFiles = Object.values(cities.CITIES).map((c) => path.basename(c.csv));

  const csvFiles = expectedCsvFiles
    .map((f) => path.join(dataDir, f))
    .filter((f) => {
      if (!fs.existsSync(f)) {
        console.error(`ERROR: Expected CSV not found: ${f}`);
        return false;
      }
      return true;
    });

  if (csvFiles.length === 0) {
    console.error("ERROR: No CSV files found in data/");
    process.exit(1);
  }

  let totalErrors = 0;
  let totalWarnings = 0;
  let totalVenues = 0;
  let citiesPassing = 0;
  let citiesFailing = 0;
  const citySummaries = [];

  console.log("=".repeat(60));
  console.log("  VENUE DATA VALIDATION");
  console.log("=".repeat(60));

  for (const file of csvFiles) {
    const relPath = path.relative(path.resolve(__dirname, ".."), file);
    const csvFile = path.basename(file);
    const cityName = cityNameMap[csvFile] || csvFile;
    const knownNeighborhoods = neighborhoodMap[csvFile] || null;

    console.log(`\n--- ${cityName} (${relPath}) ---`);

    const { errors, warnings, venueCount } = validateFile(file, knownNeighborhoods);

    for (const w of warnings) console.log(`  WARN:  ${w}`);
    for (const e of errors) console.log(`  ERROR: ${e}`);

    totalErrors += errors.length;
    totalWarnings += warnings.length;
    totalVenues += venueCount;

    const lowCoverage = venueCount < LOW_COVERAGE_THRESHOLD;
    if (lowCoverage) {
      console.log(`  WARNING: LOW COVERAGE -- only ${venueCount} venues (minimum recommended: ${LOW_COVERAGE_THRESHOLD})`);
    }

    if (errors.length === 0) {
      citiesPassing++;
      console.log(`  OK: ${venueCount} venues, ${warnings.length} warning(s)`);
    } else {
      citiesFailing++;
      console.log(`  FAILED: ${venueCount} venues, ${errors.length} error(s), ${warnings.length} warning(s)`);
    }

    citySummaries.push({ cityName, venueCount, errors: errors.length, lowCoverage });
  }

  // ── Per-city summary table ──────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("  PER-CITY SUMMARY");
  console.log("=".repeat(60));
  console.log(`  ${"City".padEnd(30)} ${"Venues".padStart(7)}  Status`);
  console.log("  " + "-".repeat(56));
  for (const s of citySummaries) {
    const status = s.errors > 0
      ? "FAIL"
      : s.lowCoverage
        ? "OK (LOW COVERAGE)"
        : "OK";
    console.log(`  ${s.cityName.padEnd(30)} ${String(s.venueCount).padStart(7)}  ${status}`);
  }

  // ── Overall summary ────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("  OVERALL SUMMARY");
  console.log("=".repeat(60));
  console.log(`  Total cities:   ${csvFiles.length}`);
  console.log(`  Total venues:   ${totalVenues}`);
  console.log(`  Cities passing: ${citiesPassing}`);
  console.log(`  Cities failing: ${citiesFailing}`);
  console.log(`  Total errors:   ${totalErrors}`);
  console.log(`  Total warnings: ${totalWarnings}`);

  if (totalErrors > 0) {
    console.log("\nValidation FAILED.");
    process.exit(1);
  }

  console.log("\nValidation PASSED.");
}

main();
