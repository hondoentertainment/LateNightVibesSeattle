import { describe, it, expect } from "vitest";
import { parseCSV, loadDataFromCSV } from "../lib/core.js";

describe("parseCSV", () => {
  it("parses a simple CSV with no quoting", () => {
    const text = "Name,Area,Category\nFoo Bar,Capitol Hill,Bar\nBaz,Ballard,Restaurant";
    const rows = parseCSV(text);
    expect(rows).toEqual([
      ["Name", "Area", "Category"],
      ["Foo Bar", "Capitol Hill", "Bar"],
      ["Baz", "Ballard", "Restaurant"],
    ]);
  });

  it("handles quoted fields containing commas", () => {
    const text = 'Name,Tags\n"The Spot","chill, dancey, loud"';
    const rows = parseCSV(text);
    expect(rows).toEqual([
      ["Name", "Tags"],
      ["The Spot", "chill, dancey, loud"],
    ]);
  });

  it("handles escaped quotes (double-quote inside quoted field)", () => {
    const text = 'Name,Note\n"Joe""s Bar","A ""great"" place"';
    const rows = parseCSV(text);
    expect(rows).toEqual([
      ["Name", "Note"],
      ['Joe"s Bar', 'A "great" place'],
    ]);
  });

  it("handles CRLF line endings", () => {
    const text = "A,B\r\n1,2\r\n3,4";
    const rows = parseCSV(text);
    expect(rows).toEqual([
      ["A", "B"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("handles LF line endings", () => {
    const text = "A,B\n1,2\n3,4";
    const rows = parseCSV(text);
    expect(rows).toEqual([
      ["A", "B"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("handles trailing newline without creating an empty row", () => {
    const text = "A,B\n1,2\n";
    const rows = parseCSV(text);
    expect(rows).toEqual([
      ["A", "B"],
      ["1", "2"],
    ]);
  });

  it("handles empty input", () => {
    expect(parseCSV("")).toEqual([]);
  });

  it("handles single row (header only)", () => {
    const rows = parseCSV("Name,Area");
    expect(rows).toEqual([["Name", "Area"]]);
  });

  it("handles empty cells", () => {
    const text = "A,B,C\n1,,3\n,,";
    const rows = parseCSV(text);
    expect(rows).toEqual([
      ["A", "B", "C"],
      ["1", "", "3"],
      ["", "", ""],
    ]);
  });

  it("handles newlines inside quoted fields", () => {
    const text = 'Name,Description\n"The Bar","A great\nplace to be"';
    const rows = parseCSV(text);
    expect(rows).toEqual([
      ["Name", "Description"],
      ["The Bar", "A great\nplace to be"],
    ]);
  });

  it("handles quoted field at the end of a row", () => {
    const text = 'A,B\n1,"hello world"';
    const rows = parseCSV(text);
    expect(rows).toEqual([
      ["A", "B"],
      ["1", "hello world"],
    ]);
  });
});

describe("loadDataFromCSV", () => {
  it("converts CSV text to array of objects with trimmed values", () => {
    const text = "Name,Area,Category\n  Foo Bar ,Capitol Hill, Bar \nBaz,Ballard,Restaurant";
    const venues = loadDataFromCSV(text);
    expect(venues).toHaveLength(2);
    expect(venues[0]).toEqual({ Name: "Foo Bar", Area: "Capitol Hill", Category: "Bar" });
    expect(venues[1]).toEqual({ Name: "Baz", Area: "Ballard", Category: "Restaurant" });
  });

  it("skips entirely empty rows", () => {
    const text = "Name,Area\nFoo,Bar\n,,\n  ,  \nBaz,Qux";
    const venues = loadDataFromCSV(text);
    expect(venues).toHaveLength(2);
    expect(venues[0].Name).toBe("Foo");
    expect(venues[1].Name).toBe("Baz");
  });

  it("returns empty array for empty input", () => {
    expect(loadDataFromCSV("")).toEqual([]);
  });

  it("returns empty array for header-only CSV", () => {
    const venues = loadDataFromCSV("Name,Area,Category");
    expect(venues).toEqual([]);
  });

  it("handles rows with fewer columns than headers", () => {
    const text = "Name,Area,Category\nFoo,Bar";
    const venues = loadDataFromCSV(text);
    expect(venues).toHaveLength(1);
    expect(venues[0].Name).toBe("Foo");
    expect(venues[0].Area).toBe("Bar");
    expect(venues[0].Category).toBe("");
  });

  it("handles a realistic venue row with vibe tags", () => {
    const text =
      'Name,Area,Category,Vibe Tags,Driving Distance,Typical Closing Time\n' +
      '"The Red Door",Capitol Hill,Cocktail Bar,"chill, date-friendly, upscale",2.1 mi,2:00 AM';
    const venues = loadDataFromCSV(text);
    expect(venues).toHaveLength(1);
    expect(venues[0].Name).toBe("The Red Door");
    expect(venues[0]["Vibe Tags"]).toBe("chill, date-friendly, upscale");
    expect(venues[0]["Driving Distance"]).toBe("2.1 mi");
    expect(venues[0]["Typical Closing Time"]).toBe("2:00 AM");
  });
});
