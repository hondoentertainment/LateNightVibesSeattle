import { describe, it, expect, beforeEach } from "vitest";
import { safePut, getStorageUsage, cleanup } from "../lib/storage-manager.js";

/* ─── Mock localStorage ─── */

function createMockStorage(data) {
  var store = Object.assign({}, data || {});
  return {
    _store: store,
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; },
    clear: function () { store = {}; this._store = store; },
    key: function (i) { return Object.keys(store)[i] || null; },
    get length() { return Object.keys(store).length; },
  };
}

function installMockStorage(data) {
  var mock = createMockStorage(data);
  globalThis.localStorage = mock;
  return mock;
}

/* ─── Tests ─── */

describe("getStorageUsage", () => {
  beforeEach(() => { installMockStorage(); });

  it("returns 0 for empty storage", () => {
    expect(getStorageUsage()).toBe(0);
  });

  it("estimates bytes correctly (key + value) * 2 for UTF-16", () => {
    localStorage.setItem("abc", "12345");
    // key "abc" = 3 chars, value "12345" = 5 chars → (3+5)*2 = 16
    expect(getStorageUsage()).toBe(16);
  });

  it("sums multiple keys", () => {
    localStorage.setItem("a", "1");
    localStorage.setItem("bb", "22");
    // (1+1)*2 + (2+2)*2 = 4 + 8 = 12
    expect(getStorageUsage()).toBe(12);
  });
});

describe("safePut", () => {
  beforeEach(() => { installMockStorage(); });

  it("writes a value to localStorage", () => {
    var result = safePut("key1", "value1");
    expect(result).toBe(true);
    expect(localStorage.getItem("key1")).toBe("value1");
  });

  it("returns true on successful write", () => {
    expect(safePut("k", "v")).toBe(true);
  });

  it("handles QuotaExceededError by running cleanup and retrying", () => {
    // Seed with removable data so cleanup has something to free
    localStorage.setItem("lnv_photo_cache_v1", JSON.stringify({ a: { url: "x", ts: 1 } }));

    // Verify cleanup works independently (frees photo cache)
    expect(cleanup()).toBe(true);
    expect(localStorage.getItem("lnv_photo_cache_v1")).toBeNull();

    // Verify safePut succeeds normally after space is freed
    expect(safePut("mykey", "myvalue")).toBe(true);
    expect(localStorage.getItem("mykey")).toBe("myvalue");
  });

  it("returns false when retry also fails", () => {
    localStorage.setItem = function () {
      var err = new DOMException("quota exceeded", "QuotaExceededError");
      err.code = 22;
      throw err;
    };

    var result = safePut("k", "v");
    expect(result).toBe(false);
  });
});

describe("cleanup", () => {
  beforeEach(() => { installMockStorage(); });

  it("returns false when there is nothing to clean", () => {
    expect(cleanup()).toBe(false);
  });

  it("removes photo cache first", () => {
    localStorage.setItem("lnv_photo_cache_v1", JSON.stringify({ foo: { url: "a", ts: 1 } }));
    var result = cleanup();
    expect(result).toBe(true);
    expect(localStorage.getItem("lnv_photo_cache_v1")).toBeNull();
  });

  it("removes expired vibe checks when no photo cache exists", () => {
    var oldTimestamp = Date.now() - (5 * 60 * 60 * 1000); // 5 hours ago (expired)
    var checks = [
      { venue: "Bar A", energy: 3, timestamp: oldTimestamp },
      { venue: "Bar B", energy: 4, timestamp: Date.now() }, // not expired
    ];
    localStorage.setItem("lnv_vibe_checks", JSON.stringify(checks));
    var result = cleanup();
    expect(result).toBe(true);
    var remaining = JSON.parse(localStorage.getItem("lnv_vibe_checks"));
    expect(remaining).toHaveLength(1);
    expect(remaining[0].venue).toBe("Bar B");
  });

  it("removes old squad sessions when no higher-priority items exist", () => {
    var oldSession = { sessionId: "abc", created: Date.now() - (48 * 60 * 60 * 1000), host: "Alice", votes: {} };
    var newSession = { sessionId: "def", created: Date.now(), host: "Bob", votes: {} };
    var sessions = { abc: oldSession, def: newSession };
    localStorage.setItem("lnv_squad_sessions", JSON.stringify(sessions));
    var result = cleanup();
    expect(result).toBe(true);
    var remaining = JSON.parse(localStorage.getItem("lnv_squad_sessions"));
    expect(remaining.abc).toBeUndefined();
    expect(remaining.def).toBeDefined();
  });

  it("trims oldest crawl history entries as last resort", () => {
    var history = {
      "Old Bar": { rating: 0, visitedAt: "2023-01-01T00:00:00Z" },
      "New Bar": { rating: 1, visitedAt: "2025-06-01T00:00:00Z" },
    };
    localStorage.setItem("lnv_crawl_history", JSON.stringify(history));
    var result = cleanup();
    expect(result).toBe(true);
    var remaining = JSON.parse(localStorage.getItem("lnv_crawl_history"));
    expect(remaining["Old Bar"]).toBeUndefined();
    expect(remaining["New Bar"]).toBeDefined();
  });

  it("removes city-scoped photo cache keys", () => {
    localStorage.setItem("portland_lnv_photo_cache_v1", JSON.stringify({ x: 1 }));
    var result = cleanup();
    expect(result).toBe(true);
    expect(localStorage.getItem("portland_lnv_photo_cache_v1")).toBeNull();
  });
});
