import { describe, it, expect, beforeEach } from "vitest";
import {
  STORAGE_KEY,
  markVisited,
  unmarkVisited,
  setRating,
  isVisited,
  getRating,
  getVisitedAt,
  getStats,
  getVisitedNames,
  toggleVisited,
} from "../lib/crawl-history.js";

describe("STORAGE_KEY", () => {
  it("is a non-empty string", () => {
    expect(typeof STORAGE_KEY).toBe("string");
    expect(STORAGE_KEY.length).toBeGreaterThan(0);
  });
});

describe("markVisited", () => {
  let history;
  beforeEach(() => { history = {}; });

  it("adds a venue with default rating of 0", () => {
    markVisited(history, "Bar A");
    expect(history["Bar A"]).toBeDefined();
    expect(history["Bar A"].rating).toBe(0);
    expect(history["Bar A"].visitedAt).toBeTruthy();
  });

  it("adds a venue with a specified rating", () => {
    markVisited(history, "Bar B", 1);
    expect(history["Bar B"].rating).toBe(1);
  });

  it("adds a venue with negative rating", () => {
    markVisited(history, "Bar C", -1);
    expect(history["Bar C"].rating).toBe(-1);
  });

  it("preserves existing visitedAt timestamp on re-mark", () => {
    markVisited(history, "Bar A");
    const original = history["Bar A"].visitedAt;
    markVisited(history, "Bar A", 1);
    expect(history["Bar A"].visitedAt).toBe(original);
    expect(history["Bar A"].rating).toBe(1);
  });

  it("returns the mutated history object", () => {
    const result = markVisited(history, "Bar A");
    expect(result).toBe(history);
  });

  it("sets visitedAt to a valid ISO string", () => {
    markVisited(history, "Bar A");
    const date = new Date(history["Bar A"].visitedAt);
    expect(date.getTime()).not.toBeNaN();
  });

  it("treats undefined rating as 0", () => {
    markVisited(history, "Bar A", undefined);
    expect(history["Bar A"].rating).toBe(0);
  });
});

describe("unmarkVisited", () => {
  let history;
  beforeEach(() => {
    history = {};
    markVisited(history, "Bar A", 1);
    markVisited(history, "Bar B");
  });

  it("removes a venue from history", () => {
    unmarkVisited(history, "Bar A");
    expect(history["Bar A"]).toBeUndefined();
  });

  it("leaves other venues untouched", () => {
    unmarkVisited(history, "Bar A");
    expect(history["Bar B"]).toBeDefined();
  });

  it("is a no-op for non-existent venues", () => {
    unmarkVisited(history, "Bar Z");
    expect(Object.keys(history)).toHaveLength(2);
  });

  it("returns the mutated history object", () => {
    const result = unmarkVisited(history, "Bar A");
    expect(result).toBe(history);
  });
});

describe("setRating", () => {
  let history;
  beforeEach(() => {
    history = {};
    markVisited(history, "Bar A");
  });

  it("updates rating for an existing venue", () => {
    setRating(history, "Bar A", 1);
    expect(history["Bar A"].rating).toBe(1);
  });

  it("can set rating to -1", () => {
    setRating(history, "Bar A", -1);
    expect(history["Bar A"].rating).toBe(-1);
  });

  it("can reset rating to 0", () => {
    setRating(history, "Bar A", 1);
    setRating(history, "Bar A", 0);
    expect(history["Bar A"].rating).toBe(0);
  });

  it("is a no-op for non-existent venues", () => {
    setRating(history, "Bar Z", 1);
    expect(history["Bar Z"]).toBeUndefined();
  });

  it("treats undefined rating as 0", () => {
    setRating(history, "Bar A", 1);
    setRating(history, "Bar A", undefined);
    expect(history["Bar A"].rating).toBe(0);
  });

  it("returns the history object", () => {
    const result = setRating(history, "Bar A", 1);
    expect(result).toBe(history);
  });
});

describe("isVisited", () => {
  let history;
  beforeEach(() => {
    history = {};
    markVisited(history, "Bar A");
  });

  it("returns true for a visited venue", () => {
    expect(isVisited(history, "Bar A")).toBe(true);
  });

  it("returns false for a non-visited venue", () => {
    expect(isVisited(history, "Bar Z")).toBe(false);
  });

  it("returns false for empty history", () => {
    expect(isVisited({}, "Bar A")).toBe(false);
  });
});

describe("getRating", () => {
  let history;
  beforeEach(() => {
    history = {};
    markVisited(history, "Bar A", 1);
    markVisited(history, "Bar B");
  });

  it("returns the rating for a visited venue", () => {
    expect(getRating(history, "Bar A")).toBe(1);
  });

  it("returns 0 for a visited venue with no explicit rating", () => {
    expect(getRating(history, "Bar B")).toBe(0);
  });

  it("returns 0 for a non-visited venue", () => {
    expect(getRating(history, "Bar Z")).toBe(0);
  });

  it("returns 0 for empty history", () => {
    expect(getRating({}, "Bar A")).toBe(0);
  });
});

describe("getVisitedAt", () => {
  let history;
  beforeEach(() => {
    history = {};
    markVisited(history, "Bar A");
  });

  it("returns an ISO string for a visited venue", () => {
    const result = getVisitedAt(history, "Bar A");
    expect(result).toBeTruthy();
    expect(new Date(result).getTime()).not.toBeNaN();
  });

  it("returns null for a non-visited venue", () => {
    expect(getVisitedAt(history, "Bar Z")).toBeNull();
  });

  it("returns null for empty history", () => {
    expect(getVisitedAt({}, "Bar A")).toBeNull();
  });
});

describe("getStats", () => {
  it("returns zeros for empty history", () => {
    const stats = getStats({});
    expect(stats).toEqual({ total: 0, liked: 0, disliked: 0, unrated: 0 });
  });

  it("counts totals correctly", () => {
    const history = {};
    markVisited(history, "Bar A", 1);
    markVisited(history, "Bar B", -1);
    markVisited(history, "Bar C");
    markVisited(history, "Bar D", 1);
    const stats = getStats(history);
    expect(stats.total).toBe(4);
    expect(stats.liked).toBe(2);
    expect(stats.disliked).toBe(1);
    expect(stats.unrated).toBe(1);
  });

  it("handles all same rating", () => {
    const history = {};
    markVisited(history, "A", 1);
    markVisited(history, "B", 1);
    const stats = getStats(history);
    expect(stats.total).toBe(2);
    expect(stats.liked).toBe(2);
    expect(stats.disliked).toBe(0);
    expect(stats.unrated).toBe(0);
  });
});

describe("getVisitedNames", () => {
  it("returns empty array for empty history", () => {
    expect(getVisitedNames({})).toEqual([]);
  });

  it("returns all visited venue names", () => {
    const history = {};
    markVisited(history, "Bar A");
    markVisited(history, "Bar B");
    markVisited(history, "Bar C");
    const names = getVisitedNames(history);
    expect(names).toHaveLength(3);
    expect(names).toContain("Bar A");
    expect(names).toContain("Bar B");
    expect(names).toContain("Bar C");
  });
});

describe("toggleVisited", () => {
  let history;
  beforeEach(() => { history = {}; });

  it("marks a new venue as visited and returns nowVisited: true", () => {
    const result = toggleVisited(history, "Bar A");
    expect(result.nowVisited).toBe(true);
    expect(isVisited(result.history, "Bar A")).toBe(true);
  });

  it("un-marks an already visited venue and returns nowVisited: false", () => {
    markVisited(history, "Bar A", 1);
    const result = toggleVisited(history, "Bar A");
    expect(result.nowVisited).toBe(false);
    expect(isVisited(result.history, "Bar A")).toBe(false);
  });

  it("returns the same history object (mutated in-place)", () => {
    const result = toggleVisited(history, "Bar A");
    expect(result.history).toBe(history);
  });

  it("double toggle restores initial state (empty)", () => {
    toggleVisited(history, "Bar A");
    toggleVisited(history, "Bar A");
    expect(isVisited(history, "Bar A")).toBe(false);
    expect(Object.keys(history)).toHaveLength(0);
  });
});
