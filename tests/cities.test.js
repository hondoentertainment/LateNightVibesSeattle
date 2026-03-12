import { describe, it, expect } from "vitest";
import {
  CITIES,
  DEFAULT_CITY,
  getAllCities,
  getCityBySlug,
  cityLink,
} from "../lib/cities.js";

describe("CITIES registry", () => {
  it("contains at least 11 cities", () => {
    expect(Object.keys(CITIES).length).toBeGreaterThanOrEqual(11);
  });

  it("each city has required fields", () => {
    Object.values(CITIES).forEach((city) => {
      expect(city).toHaveProperty("name");
      expect(city).toHaveProperty("slug");
      expect(city).toHaveProperty("state");
      expect(city).toHaveProperty("csv");
      expect(city).toHaveProperty("neighborhoods");
      expect(city).toHaveProperty("lat");
      expect(city).toHaveProperty("lng");
      expect(city).toHaveProperty("population");
      expect(typeof city.name).toBe("string");
      expect(typeof city.slug).toBe("string");
      expect(typeof city.csv).toBe("string");
      expect(Array.isArray(city.neighborhoods)).toBe(true);
    });
  });

  it("each city has a non-empty neighborhoods array", () => {
    Object.values(CITIES).forEach((city) => {
      expect(city.neighborhoods.length).toBeGreaterThan(0);
    });
  });

  it("slugs are unique and match keys", () => {
    Object.entries(CITIES).forEach(([key, city]) => {
      expect(city.slug).toBe(key);
    });
  });

  it("includes all 1M+ US cities", () => {
    const slugs = Object.keys(CITIES);
    expect(slugs).toContain("seattle");
    expect(slugs).toContain("new-york");
    expect(slugs).toContain("los-angeles");
    expect(slugs).toContain("chicago");
    expect(slugs).toContain("houston");
    expect(slugs).toContain("phoenix");
    expect(slugs).toContain("philadelphia");
    expect(slugs).toContain("san-antonio");
    expect(slugs).toContain("san-diego");
    expect(slugs).toContain("dallas");
    expect(slugs).toContain("san-jose");
  });

  it("each city has description and ogDescription for SEO", () => {
    Object.values(CITIES).forEach((city) => {
      expect(city.description).toBeTruthy();
      expect(city.ogDescription).toBeTruthy();
      expect(typeof city.description).toBe("string");
      expect(typeof city.ogDescription).toBe("string");
    });
  });
});

describe("DEFAULT_CITY", () => {
  it("is 'seattle'", () => {
    expect(DEFAULT_CITY).toBe("seattle");
  });

  it("matches a city in the registry", () => {
    expect(CITIES[DEFAULT_CITY]).toBeDefined();
    expect(CITIES[DEFAULT_CITY].name).toBe("Seattle");
  });
});

describe("getAllCities", () => {
  it("returns all cities as an array", () => {
    const all = getAllCities();
    expect(all.length).toBe(Object.keys(CITIES).length);
  });

  it("returns cities sorted by population descending", () => {
    const all = getAllCities();
    for (let i = 1; i < all.length; i++) {
      expect(all[i - 1].population).toBeGreaterThanOrEqual(all[i].population);
    }
  });

  it("preserves city data accurately", () => {
    const all = getAllCities();
    const seattle = all.find((c) => c.slug === "seattle");
    expect(seattle).toBeDefined();
    expect(seattle.name).toBe("Seattle");
    expect(seattle.csv).toBe("data/seattle.csv");
    expect(seattle.neighborhoods).toContain("Capitol Hill");
    expect(seattle.neighborhoods).toContain("Ballard");
  });
});

describe("getCityBySlug", () => {
  it("finds Seattle by slug", () => {
    const city = getCityBySlug("seattle");
    expect(city).toBeDefined();
    expect(city.name).toBe("Seattle");
  });

  it("finds New York by slug", () => {
    const city = getCityBySlug("new-york");
    expect(city).toBeDefined();
    expect(city.name).toBe("New York City");
  });

  it("returns null for unknown slug", () => {
    expect(getCityBySlug("tokyo")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(getCityBySlug("")).toBeNull();
  });
});

describe("cityLink", () => {
  it("appends ?city= for non-default city", () => {
    expect(cityLink("/planner.html", "chicago")).toBe("/planner.html?city=chicago");
  });

  it("returns plain path for default city (seattle)", () => {
    expect(cityLink("/planner.html", "seattle")).toBe("/planner.html");
  });

  it("appends with & when URL already has query params", () => {
    expect(cityLink("/planner.html?view=grid", "austin")).toBe("/planner.html?view=grid&city=austin");
  });
});
