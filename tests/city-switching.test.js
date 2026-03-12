import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_CITY,
  getCityBySlug,
  cityLink,
} from "../lib/cities.js";

/* ─── Helper: simulate extracting ?city= from a URL ─── */
function parseCityFromURL(url) {
  try {
    const u = new URL(url, "https://example.com");
    return u.searchParams.get("city") || null;
  } catch {
    return null;
  }
}

/* ─── Mock localStorage ─── */
const store = {};
const mockLocalStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

const LS_KEY = "lnv_city";

/* ─── Helper: resolve city from URL param → localStorage → default ─── */
function resolveCity(urlParam) {
  if (urlParam) {
    const city = getCityBySlug(urlParam);
    if (city) {
      mockLocalStorage.setItem(LS_KEY, city.slug);
      return city;
    }
  }
  const stored = mockLocalStorage.getItem(LS_KEY);
  if (stored) {
    const city = getCityBySlug(stored);
    if (city) return city;
  }
  return getCityBySlug(DEFAULT_CITY);
}

describe("URL param parsing (?city=)", () => {
  it("extracts city slug from ?city=chicago", () => {
    expect(parseCityFromURL("https://example.com/?city=chicago")).toBe("chicago");
  });

  it("extracts city slug when other params present", () => {
    expect(parseCityFromURL("https://example.com/?vibe=chill&city=houston&sort=name")).toBe("houston");
  });

  it("returns null when ?city is absent", () => {
    expect(parseCityFromURL("https://example.com/")).toBeNull();
  });

  it("returns null for empty ?city=", () => {
    expect(parseCityFromURL("https://example.com/?city=")).toBeNull();
  });

  it("handles relative paths", () => {
    expect(parseCityFromURL("/planner.html?city=dallas")).toBe("dallas");
  });
});

describe("localStorage persistence", () => {
  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
  });

  it("persists city slug", () => {
    mockLocalStorage.setItem(LS_KEY, "chicago");
    expect(mockLocalStorage.getItem(LS_KEY)).toBe("chicago");
  });

  it("overwrites previous selection", () => {
    mockLocalStorage.setItem(LS_KEY, "seattle");
    mockLocalStorage.setItem(LS_KEY, "dallas");
    expect(mockLocalStorage.getItem(LS_KEY)).toBe("dallas");
  });

  it("removeItem clears the selection", () => {
    mockLocalStorage.setItem(LS_KEY, "chicago");
    mockLocalStorage.removeItem(LS_KEY);
    expect(mockLocalStorage.getItem(LS_KEY)).toBeNull();
  });
});

describe("resolveCity (URL param > localStorage > default)", () => {
  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
  });

  it("prefers URL param over localStorage", () => {
    mockLocalStorage.setItem(LS_KEY, "chicago");
    const city = resolveCity("houston");
    expect(city.name).toBe("Houston");
  });

  it("persists URL param choice to localStorage", () => {
    resolveCity("dallas");
    expect(mockLocalStorage.getItem(LS_KEY)).toBe("dallas");
  });

  it("falls back to localStorage when URL param is null", () => {
    mockLocalStorage.setItem(LS_KEY, "chicago");
    const city = resolveCity(null);
    expect(city.name).toBe("Chicago");
  });

  it("falls back to default when both are empty", () => {
    const city = resolveCity(null);
    expect(city.name).toBe("Seattle");
    expect(city.slug).toBe("seattle");
  });

  it("falls back to default for invalid URL param", () => {
    const city = resolveCity("nonexistent");
    expect(city.name).toBe("Seattle");
  });
});

describe("page navigation with city context", () => {
  it("builds link and parses it back correctly (round-trip)", () => {
    const url = cityLink("/index.html", "new-york");
    const slug = parseCityFromURL(url);
    expect(slug).toBe("new-york");
    const city = getCityBySlug(slug);
    expect(city.name).toBe("New York City");
  });

  it("omits ?city= for default city", () => {
    expect(cityLink("/planner.html", "seattle")).toBe("/planner.html");
  });

  it("works with different page paths", () => {
    expect(cityLink("/neighborhoods.html", "dallas")).toBe("/neighborhoods.html?city=dallas");
    expect(cityLink("/recommend.html", "houston")).toBe("/recommend.html?city=houston");
  });
});
