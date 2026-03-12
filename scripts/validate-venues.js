#!/usr/bin/env node

/**
 * Validate all CSV venue data files under data/.
 *
 * Checks:
 *   1. Expected headers are present.
 *   2. Required fields (Area, Name, Category) are non-empty.
 *   3. "Area" values match neighborhoods from lib/cities.js.
 *   4. "Typical Closing Time" values are parseable.
 *
 * Exit 0 on success, 1 on any hard error.
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

// ── Closing-time validation ─────────────────────────────────────────────

const CLOSING_TIME_PATTERNS = [
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

const REQUIRED_FIELDS = ["Area", "Name", "Category"];

// ── Validate a single file ──────────────────────────────────────────────

function validateFile(filePath, knownNeighborhoods) {
  const errors = [];
  const warnings = [];
  const text = fs.readFileSync(filePath, "utf-8");
  const rows = parseCSV(text);

  if (rows.length === 0) {
    errors.push("File is empty");
    return { errors, warnings };
  }

  const headers = rows[0].map((h) => h.trim());
  const missingHeaders = EXPECTED_HEADERS.filter((h) => !headers.includes(h));
  if (missingHeaders.length) {
    errors.push(`Missing expected headers: ${missingHeaders.join(", ")}`);
    return { errors, warnings };
  }

  const headerIndex = {};
  headers.forEach((h, i) => { headerIndex[h] = i; });

  const dataRows = rows.slice(1).filter((row) => row.some((c) => c && c.trim()));

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const lineNum = i + 2;

    for (const field of REQUIRED_FIELDS) {
      const value = (row[headerIndex[field]] || "").trim();
      if (!value) {
        errors.push(`Row ${lineNum}: "${field}" is empty`);
      }
    }

    const area = (row[headerIndex["Area"]] || "").trim();
    if (area && knownNeighborhoods && !knownNeighborhoods.has(area)) {
      warnings.push(`Row ${lineNum}: Area "${area}" not in cities.js neighborhoods`);
    }

    const closingTime = (row[headerIndex["Typical Closing Time"]] || "").trim();
    if (closingTime && !isValidClosingTime(closingTime)) {
      errors.push(`Row ${lineNum}: Unparseable closing time "${closingTime}"`);
    }
  }

  return { errors, warnings };
}

// ── Main ────────────────────────────────────────────────────────────────

function main() {
  const dataDir = path.resolve(__dirname, "..", "data");

  if (!fs.existsSync(dataDir)) {
    console.error("ERROR: data/ directory not found");
    process.exit(1);
  }

  const csvFiles = fs.readdirSync(dataDir)
    .filter((f) => f.endsWith(".csv"))
    .map((f) => path.join(dataDir, f));

  if (csvFiles.length === 0) {
    console.error("ERROR: No CSV files found in data/");
    process.exit(1);
  }

  const neighborhoodMap = buildNeighborhoodMap();
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const file of csvFiles) {
    const relPath = path.relative(path.resolve(__dirname, ".."), file);
    const csvFile = path.basename(file);
    const knownNeighborhoods = neighborhoodMap[csvFile] || null;

    console.log(`\nValidating ${relPath} ...`);

    const { errors, warnings } = validateFile(file, knownNeighborhoods);

    for (const w of warnings) console.log(`  WARN: ${w}`);
    for (const e of errors) console.log(`  ERROR: ${e}`);

    totalErrors += errors.length;
    totalWarnings += warnings.length;

    if (errors.length === 0) {
      console.log(`  OK (${warnings.length} warning(s))`);
    } else {
      console.log(`  FAILED (${errors.length} error(s), ${warnings.length} warning(s))`);
    }
  }

  console.log(`\nSummary: ${csvFiles.length} file(s), ${totalErrors} error(s), ${totalWarnings} warning(s)`);

  if (totalErrors > 0) process.exit(1);
  console.log("Validation passed.");
}

main();
