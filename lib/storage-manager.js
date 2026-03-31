/**
 * Late Night Vibes — Storage Manager.
 *
 * Provides localStorage quota management with automatic cleanup.
 * Wraps setItem to catch QuotaExceededError and free space by
 * removing low-priority data before retrying.
 *
 * Priority order for removal (lowest first):
 *  1. Photo cache (lnv_photo_cache_v1)
 *  2. Expired vibe checks (lnv_vibe_checks)
 *  3. Old squad sessions (lnv_squad_sessions)
 *  4. Oldest crawl history entries
 *
 * UMD export: window.LNVStorageManager in browser, module.exports in Node.
 */
(function (exports) {
  "use strict";

  /* ─── Key constants (match other modules) ─── */

  var PHOTO_CACHE_KEY = "lnv_photo_cache_v1";
  var VIBE_CHECKS_KEY = "lnv_vibe_checks";
  var SQUAD_SESSIONS_KEY = "lnv_squad_sessions";
  var CRAWL_HISTORY_KEY = "lnv_crawl_history";
  var VIBE_EXPIRY_MS = 4 * 60 * 60 * 1000; // 4 hours — matches vibe-check.js

  /* ─── Storage usage ─── */

  /**
   * Estimate total localStorage usage in bytes.
   * Counts key + value lengths × 2 (UTF-16).
   */
  function getStorageUsage() {
    if (typeof localStorage === "undefined") return 0;
    var total = 0;
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      var val = localStorage.getItem(key) || "";
      total += (key.length + val.length) * 2;
    }
    return total;
  }

  /* ─── Cleanup ─── */

  /**
   * Remove lowest-priority data to free space.
   * Steps through tiers until something is removed.
   * Returns true if anything was removed.
   */
  function cleanup() {
    if (typeof localStorage === "undefined") return false;
    var freed = false;

    // 1. Remove photo cache entirely
    if (localStorage.getItem(PHOTO_CACHE_KEY) !== null) {
      localStorage.removeItem(PHOTO_CACHE_KEY);
      freed = true;
    }
    // Also remove city-scoped photo cache keys
    freed = _removePrefixedKeys(PHOTO_CACHE_KEY) || freed;
    if (freed) return true;

    // 2. Remove expired vibe checks
    freed = _pruneExpiredVibeChecks();
    if (freed) return true;

    // 3. Remove old squad sessions (older than 24h)
    freed = _pruneOldSquadSessions();
    if (freed) return true;

    // 4. Trim oldest crawl history entries
    freed = _trimOldestCrawlHistory();
    return freed;
  }

  /**
   * Remove any localStorage keys that contain the given substring.
   */
  function _removePrefixedKeys(substring) {
    var removed = false;
    var keysToRemove = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.indexOf(substring) !== -1) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(function (k) {
      localStorage.removeItem(k);
      removed = true;
    });
    return removed;
  }

  /**
   * Remove expired entries from vibe checks stored under any city-scoped key.
   */
  function _pruneExpiredVibeChecks() {
    var keys = _findKeysContaining(VIBE_CHECKS_KEY);
    var freed = false;
    var now = Date.now();
    keys.forEach(function (key) {
      try {
        var checks = JSON.parse(localStorage.getItem(key) || "[]");
        var before = checks.length;
        checks = checks.filter(function (c) {
          return (now - c.timestamp) < VIBE_EXPIRY_MS;
        });
        if (checks.length < before) {
          if (checks.length === 0) {
            localStorage.removeItem(key);
          } else {
            localStorage.setItem(key, JSON.stringify(checks));
          }
          freed = true;
        }
      } catch (_) { /* skip malformed data */ }
    });
    return freed;
  }

  /**
   * Remove squad sessions older than 24 hours.
   */
  function _pruneOldSquadSessions() {
    var keys = _findKeysContaining(SQUAD_SESSIONS_KEY);
    var freed = false;
    var cutoff = Date.now() - (24 * 60 * 60 * 1000);
    keys.forEach(function (key) {
      try {
        var sessions = JSON.parse(localStorage.getItem(key) || "{}");
        var before = Object.keys(sessions).length;
        for (var id in sessions) {
          if (sessions[id].created && sessions[id].created < cutoff) {
            delete sessions[id];
          }
        }
        if (Object.keys(sessions).length < before) {
          if (Object.keys(sessions).length === 0) {
            localStorage.removeItem(key);
          } else {
            localStorage.setItem(key, JSON.stringify(sessions));
          }
          freed = true;
        }
      } catch (_) { /* skip malformed data */ }
    });
    return freed;
  }

  /**
   * Remove the oldest half of crawl history entries.
   */
  function _trimOldestCrawlHistory() {
    var keys = _findKeysContaining(CRAWL_HISTORY_KEY);
    var freed = false;
    keys.forEach(function (key) {
      try {
        var history = JSON.parse(localStorage.getItem(key) || "{}");
        var entries = Object.keys(history);
        if (entries.length === 0) return;
        // Sort by visitedAt ascending, remove oldest half
        entries.sort(function (a, b) {
          var tA = history[a].visitedAt || "";
          var tB = history[b].visitedAt || "";
          return tA < tB ? -1 : tA > tB ? 1 : 0;
        });
        var removeCount = Math.max(1, Math.floor(entries.length / 2));
        for (var i = 0; i < removeCount; i++) {
          delete history[entries[i]];
        }
        localStorage.setItem(key, JSON.stringify(history));
        freed = true;
      } catch (_) { /* skip malformed data */ }
    });
    return freed;
  }

  /**
   * Find all localStorage keys containing the given substring.
   */
  function _findKeysContaining(substring) {
    var result = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.indexOf(substring) !== -1) {
        result.push(key);
      }
    }
    return result;
  }

  /* ─── Safe put ─── */

  /**
   * Safely write to localStorage. On QuotaExceededError, runs cleanup
   * and retries once. Returns true if the write succeeded.
   */
  function safePut(key, value) {
    if (typeof localStorage === "undefined") return false;
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      if (_isQuotaError(e)) {
        cleanup();
        try {
          localStorage.setItem(key, value);
          return true;
        } catch (_retryErr) {
          return false;
        }
      }
      return false;
    }
  }

  /**
   * Detect QuotaExceededError across browsers.
   */
  function _isQuotaError(e) {
    if (!e) return false;
    if (e.name === "QuotaExceededError") return true;
    if (e.code === 22) return true; // legacy WebKit
    if (e.code === 1014 && e.name === "NS_ERROR_DOM_QUOTA_REACHED") return true; // Firefox
    return false;
  }

  /* ─── Exports ─── */

  exports.safePut = safePut;
  exports.getStorageUsage = getStorageUsage;
  exports.cleanup = cleanup;

})(typeof module !== "undefined" ? module.exports : (window.LNVStorageManager = {}));
