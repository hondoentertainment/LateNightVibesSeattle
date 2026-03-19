import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getStorageUsage,
  getStorageBreakdown,
  cleanupStorage,
  onStorageFull,
  safeSetItem,
  _resetHandlers,
  _isQuotaError,
  DEFAULT_QUOTA,
  VIBE_EXPIRY_MS,
  SQUAD_EXPIRY_MS,
  MAX_CRAWL_ENTRIES,
} from "../lib/storage-manager.js";

/* ─── Mock localStorage ─── */

function createMockStorage(initial) {
  var store = Object.assign({}, initial || {});
  var mock = {
    _store: store,
    getItem: vi.fn(function (key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    }),
    setItem: vi.fn(function (key, value) {
      store[key] = String(value);
    }),
    removeItem: vi.fn(function (key) {
      delete store[key];
    }),
    key: vi.fn(function (index) {
      var keys = Object.keys(store);
      return index < keys.length ? keys[index] : null;
    }),
    get length() {
      return Object.keys(store).length;
    },
    clear: vi.fn(function () {
      store = {};
      mock._store = store;
    }),
  };
  return mock;
}

beforeEach(() => {
  globalThis.localStorage = createMockStorage();
  _resetHandlers();
});

/* ─── Constants ─── */

describe("constants", () => {
  it("DEFAULT_QUOTA is 5 MB", () => {
    expect(DEFAULT_QUOTA).toBe(5 * 1024 * 1024);
  });

  it("VIBE_EXPIRY_MS is 4 hours", () => {
    expect(VIBE_EXPIRY_MS).toBe(4 * 60 * 60 * 1000);
  });

  it("SQUAD_EXPIRY_MS is 7 days", () => {
    expect(SQUAD_EXPIRY_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("MAX_CRAWL_ENTRIES is 200", () => {
    expect(MAX_CRAWL_ENTRIES).toBe(200);
  });
});

/* ─── getStorageUsage ─── */

describe("getStorageUsage", () => {
  it("returns zero usage for empty storage", () => {
    var result = getStorageUsage();
    expect(result.used).toBe(0);
    expect(result.quota).toBe(DEFAULT_QUOTA);
    expect(result.percentage).toBe(0);
  });

  it("calculates used bytes from all keys", () => {
    globalThis.localStorage = createMockStorage({
      lnv_foo: "bar",
      other_key: "value",
    });
    var result = getStorageUsage();
    // "lnv_foo" (7) + "bar" (3) = 10 chars * 2 = 20 bytes
    // "other_key" (9) + "value" (5) = 14 chars * 2 = 28 bytes
    expect(result.used).toBe(48);
  });

  it("returns a percentage between 0 and 100", () => {
    globalThis.localStorage = createMockStorage({ lnv_a: "x" });
    var result = getStorageUsage();
    expect(result.percentage).toBeGreaterThan(0);
    expect(result.percentage).toBeLessThan(100);
  });

  it("includes quota field", () => {
    var result = getStorageUsage();
    expect(result.quota).toBe(DEFAULT_QUOTA);
  });
});

/* ─── getStorageBreakdown ─── */

describe("getStorageBreakdown", () => {
  it("returns empty array for empty storage", () => {
    expect(getStorageBreakdown()).toEqual([]);
  });

  it("only includes lnv_ prefixed keys", () => {
    globalThis.localStorage = createMockStorage({
      lnv_crawl_history: "{}",
      other_key: "data",
      lnv_vibe_checks: "[]",
    });
    var result = getStorageBreakdown();
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.key.startsWith("lnv_"))).toBe(true);
  });

  it("sorts by bytes descending", () => {
    globalThis.localStorage = createMockStorage({
      lnv_small: "a",
      lnv_large: "a".repeat(1000),
      lnv_medium: "a".repeat(100),
    });
    var result = getStorageBreakdown();
    expect(result[0].key).toBe("lnv_large");
    expect(result[1].key).toBe("lnv_medium");
    expect(result[2].key).toBe("lnv_small");
  });

  it("each entry has key and bytes fields", () => {
    globalThis.localStorage = createMockStorage({ lnv_test: "value" });
    var result = getStorageBreakdown();
    expect(result[0]).toHaveProperty("key", "lnv_test");
    expect(result[0]).toHaveProperty("bytes");
    expect(typeof result[0].bytes).toBe("number");
    expect(result[0].bytes).toBeGreaterThan(0);
  });
});

/* ─── cleanupStorage ─── */

describe("cleanupStorage", () => {
  it("returns freed and actions when nothing to clean", () => {
    var result = cleanupStorage(80);
    expect(result).toHaveProperty("freed");
    expect(result).toHaveProperty("actions");
    expect(Array.isArray(result.actions)).toBe(true);
  });

  it("removes expired vibe checks", () => {
    var now = Date.now();
    var checks = [
      { venue: "A", timestamp: now - VIBE_EXPIRY_MS - 1000, energy: 3 },
      { venue: "B", timestamp: now - 1000, energy: 4 },
    ];
    globalThis.localStorage = createMockStorage({
      lnv_vibe_checks: JSON.stringify(checks),
    });

    var result = cleanupStorage(0); // target 0% forces all phases
    expect(result.actions.some((a) => a.indexOf("expired vibe checks") !== -1)).toBe(true);

    // Verify the non-expired check is kept
    var remaining = JSON.parse(globalThis.localStorage.getItem("lnv_vibe_checks"));
    expect(remaining).toHaveLength(1);
    expect(remaining[0].venue).toBe("B");
  });

  it("removes all vibe checks if all are expired", () => {
    var checks = [
      { venue: "A", timestamp: Date.now() - VIBE_EXPIRY_MS - 5000, energy: 3 },
      { venue: "B", timestamp: Date.now() - VIBE_EXPIRY_MS - 1000, energy: 4 },
    ];
    globalThis.localStorage = createMockStorage({
      lnv_vibe_checks: JSON.stringify(checks),
    });

    cleanupStorage(0);
    expect(localStorage.removeItem).toHaveBeenCalledWith("lnv_vibe_checks");
  });

  it("removes old squad sessions (>7 days)", () => {
    var now = Date.now();
    var sessions = {
      abc123: { sessionId: "abc123", created: now - SQUAD_EXPIRY_MS - 1000, host: "A" },
      def456: { sessionId: "def456", created: now - 1000, host: "B" },
    };
    globalThis.localStorage = createMockStorage({
      lnv_squad_sessions: JSON.stringify(sessions),
    });

    var result = cleanupStorage(0);
    expect(result.actions.some((a) => a.indexOf("old squad sessions") !== -1)).toBe(true);

    var remaining = JSON.parse(globalThis.localStorage.getItem("lnv_squad_sessions"));
    expect(Object.keys(remaining)).toHaveLength(1);
    expect(remaining.def456).toBeDefined();
  });

  it("removes photo cache entries", () => {
    globalThis.localStorage = createMockStorage({
      lnv_photo_cache_1: JSON.stringify({ url: "a.jpg", timestamp: 100 }),
      lnv_photo_cache_2: JSON.stringify({ url: "b.jpg", timestamp: 200 }),
    });

    var result = cleanupStorage(0);
    expect(result.actions.some((a) => a.indexOf("photo cache") !== -1)).toBe(true);
    expect(globalThis.localStorage.removeItem).toHaveBeenCalledWith("lnv_photo_cache_1");
    expect(globalThis.localStorage.removeItem).toHaveBeenCalledWith("lnv_photo_cache_2");
  });

  it("trims crawl history to keep most recent 200", () => {
    var history = {};
    for (var i = 0; i < 250; i++) {
      var dateStr = new Date(Date.now() - (250 - i) * 60000).toISOString();
      history["Venue " + i] = { rating: 0, visitedAt: dateStr };
    }
    globalThis.localStorage = createMockStorage({
      lnv_crawl_history: JSON.stringify(history),
    });

    var result = cleanupStorage(0);
    expect(result.actions.some((a) => a.indexOf("Trimmed crawl history") !== -1)).toBe(true);

    var remaining = JSON.parse(globalThis.localStorage.getItem("lnv_crawl_history"));
    expect(Object.keys(remaining)).toHaveLength(200);
    // The most recent entry (Venue 249) should still be present
    expect(remaining["Venue 249"]).toBeDefined();
    // The oldest entry (Venue 0) should have been removed
    expect(remaining["Venue 0"]).toBeUndefined();
  });

  it("defaults target to 80 when not specified", () => {
    // With empty storage, usage is 0% which is below 80%, so it should
    // return immediately with no actions needed
    var result = cleanupStorage();
    expect(result.freed).toBe(0);
    expect(result.actions).toHaveLength(0);
  });

  it("does not trim crawl history with 200 or fewer entries", () => {
    var history = {};
    for (var i = 0; i < 200; i++) {
      history["Venue " + i] = { rating: 0, visitedAt: new Date().toISOString() };
    }
    globalThis.localStorage = createMockStorage({
      lnv_crawl_history: JSON.stringify(history),
    });

    var result = cleanupStorage(0);
    var crawlActions = result.actions.filter((a) => a.indexOf("crawl") !== -1);
    expect(crawlActions).toHaveLength(0);
  });
});

/* ─── onStorageFull ─── */

describe("onStorageFull", () => {
  it("registers a handler that receives the error", () => {
    var received = null;
    onStorageFull(function (err) { received = err; });

    // Trigger by making setItem throw QuotaExceededError
    var quotaError = new DOMException("quota exceeded", "QuotaExceededError");
    globalThis.localStorage.setItem = vi.fn(function () {
      throw quotaError;
    });

    safeSetItem("lnv_test", "value");
    expect(received).toBe(quotaError);
  });

  it("returns an unsubscribe function", () => {
    var callCount = 0;
    var unsub = onStorageFull(function () { callCount++; });

    unsub();

    var quotaError = new DOMException("quota exceeded", "QuotaExceededError");
    globalThis.localStorage.setItem = vi.fn(function () {
      throw quotaError;
    });

    safeSetItem("lnv_test", "value");
    expect(callCount).toBe(0);
  });

  it("supports multiple handlers", () => {
    var calls = [];
    onStorageFull(function () { calls.push("a"); });
    onStorageFull(function () { calls.push("b"); });

    var quotaError = new DOMException("quota exceeded", "QuotaExceededError");
    globalThis.localStorage.setItem = vi.fn(function () {
      throw quotaError;
    });

    safeSetItem("lnv_test", "value");
    expect(calls).toEqual(["a", "b"]);
  });
});

/* ─── safeSetItem ─── */

describe("safeSetItem", () => {
  it("returns true on successful write", () => {
    expect(safeSetItem("lnv_test", "value")).toBe(true);
    expect(localStorage.setItem).toHaveBeenCalledWith("lnv_test", "value");
  });

  it("catches QuotaExceededError, cleans up, and retries", () => {
    var callCount = 0;
    globalThis.localStorage.setItem = vi.fn(function () {
      callCount++;
      if (callCount === 1) {
        var err = new DOMException("quota exceeded", "QuotaExceededError");
        throw err;
      }
      // Second call (retry) succeeds
    });

    var result = safeSetItem("lnv_test", "value");
    expect(result).toBe(true);
    expect(callCount).toBe(2);
  });

  it("returns false if retry also fails", () => {
    var quotaError = new DOMException("quota exceeded", "QuotaExceededError");
    globalThis.localStorage.setItem = vi.fn(function () {
      throw quotaError;
    });

    var result = safeSetItem("lnv_test", "value");
    expect(result).toBe(false);
  });

  it("returns false for non-quota errors", () => {
    globalThis.localStorage.setItem = vi.fn(function () {
      throw new Error("SecurityError");
    });

    var result = safeSetItem("lnv_test", "value");
    expect(result).toBe(false);
  });
});

/* ─── _isQuotaError ─── */

describe("_isQuotaError", () => {
  it("detects QuotaExceededError by name", () => {
    expect(_isQuotaError({ name: "QuotaExceededError" })).toBe(true);
  });

  it("detects quota error by code 22", () => {
    expect(_isQuotaError({ code: 22 })).toBe(true);
  });

  it("detects Firefox NS_ERROR_DOM_QUOTA_REACHED", () => {
    expect(_isQuotaError({ name: "NS_ERROR_DOM_QUOTA_REACHED", code: 1014 })).toBe(true);
  });

  it("returns false for null/undefined", () => {
    expect(_isQuotaError(null)).toBe(false);
    expect(_isQuotaError(undefined)).toBe(false);
  });

  it("returns false for regular errors", () => {
    expect(_isQuotaError({ name: "TypeError" })).toBe(false);
    expect(_isQuotaError({ name: "Error" })).toBe(false);
  });
});
