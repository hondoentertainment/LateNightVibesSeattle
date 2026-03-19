/**
 * Storage Manager — localStorage quota monitoring and LRU cleanup.
 *
 * Tracks usage across all `lnv_` keys, provides per-key size breakdown,
 * and auto-cleans stale data when quota is approached or exceeded.
 *
 * Cleanup priority (least-valuable first):
 *   1. Expired vibe checks (>4h TTL)
 *   2. Old squad sessions (>7 days)
 *   3. Photo cache entries (oldest first)
 *   4. Old crawl history entries (keep most recent 200)
 *
 * UMD export: window.LNVStorageManager in browser, module.exports in Node.
 */
(function (exports) {
  "use strict";

  var DEFAULT_QUOTA = 5 * 1024 * 1024; // 5 MB — conservative Mobile Safari limit
  var VIBE_EXPIRY_MS = 4 * 60 * 60 * 1000; // 4 hours
  var SQUAD_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
  var MAX_CRAWL_ENTRIES = 200;
  var PREFIX = "lnv_";

  var _fullHandlers = [];

  /* ─── Storage Usage ─── */

  /**
   * getStorageUsage() — returns { used, quota, percentage }.
   * `used` and `quota` are in bytes; `percentage` is 0-100.
   */
  function getStorageUsage() {
    var used = 0;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        var value = localStorage.getItem(key);
        // Each char is 2 bytes in JS string (UTF-16), but localStorage
        // implementations typically count bytes differently. We use
        // key.length + value.length as a practical char-count metric,
        // then multiply by 2 for UTF-16 byte estimate.
        used += (key.length + value.length) * 2;
      }
    } catch (_) { /* empty or unavailable */ }

    var quota = DEFAULT_QUOTA;
    return {
      used: used,
      quota: quota,
      percentage: quota > 0 ? Math.round((used / quota) * 1000000) / 10000 : 0
    };
  }

  /* ─── Per-Key Breakdown ─── */

  /**
   * getStorageBreakdown() — returns array of { key, bytes } for all `lnv_` keys,
   * sorted largest-first.
   */
  function getStorageBreakdown() {
    var entries = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key.indexOf(PREFIX) !== 0) continue;
        var value = localStorage.getItem(key);
        entries.push({
          key: key,
          bytes: (key.length + value.length) * 2
        });
      }
    } catch (_) { /* empty or unavailable */ }

    entries.sort(function (a, b) { return b.bytes - a.bytes; });
    return entries;
  }

  /* ─── Cleanup ─── */

  /**
   * cleanupStorage(targetPercentage) — frees space by removing stale data
   * in priority order until usage drops below targetPercentage (default 80).
   * Returns { freed: bytes, actions: string[] }.
   */
  function cleanupStorage(targetPercentage) {
    var target = (typeof targetPercentage === "number" && targetPercentage >= 0)
      ? targetPercentage : 80;
    var freed = 0;
    var actions = [];

    function belowTarget() {
      var usage = getStorageUsage();
      return usage.percentage <= target;
    }

    // Phase 1: Expired vibe checks
    freed += _cleanExpiredVibeChecks(actions);
    if (belowTarget()) return { freed: freed, actions: actions };

    // Phase 2: Old squad sessions (>7 days)
    freed += _cleanOldSquadSessions(actions);
    if (belowTarget()) return { freed: freed, actions: actions };

    // Phase 3: Photo cache entries (oldest first)
    freed += _cleanPhotoCache(actions);
    if (belowTarget()) return { freed: freed, actions: actions };

    // Phase 4: Old crawl history (keep most recent 200)
    freed += _cleanOldCrawlHistory(actions);

    return { freed: freed, actions: actions };
  }

  function _sizeOf(key) {
    try {
      var val = localStorage.getItem(key);
      if (val === null) return 0;
      return (key.length + val.length) * 2;
    } catch (_) { return 0; }
  }

  function _cleanExpiredVibeChecks(actions) {
    var freed = 0;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key || key.indexOf("lnv_vibe_checks") === -1) continue;

        var sizeBefore = _sizeOf(key);
        var raw = localStorage.getItem(key);
        if (!raw) continue;

        var checks = JSON.parse(raw);
        if (!Array.isArray(checks)) continue;

        var now = Date.now();
        var filtered = checks.filter(function (c) {
          return c && c.timestamp && (now - c.timestamp) < VIBE_EXPIRY_MS;
        });

        if (filtered.length < checks.length) {
          var removed = checks.length - filtered.length;
          if (filtered.length === 0) {
            localStorage.removeItem(key);
          } else {
            localStorage.setItem(key, JSON.stringify(filtered));
          }
          var sizeAfter = filtered.length === 0 ? 0 : _sizeOf(key);
          freed += sizeBefore - sizeAfter;
          actions.push("Removed " + removed + " expired vibe checks");
        }
      }
    } catch (_) { /* skip */ }
    return freed;
  }

  function _cleanOldSquadSessions(actions) {
    var freed = 0;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key || key.indexOf("lnv_squad_sessions") === -1) continue;

        var sizeBefore = _sizeOf(key);
        var raw = localStorage.getItem(key);
        if (!raw) continue;

        var sessions = JSON.parse(raw);
        if (typeof sessions !== "object" || sessions === null) continue;

        var now = Date.now();
        var removedCount = 0;
        var ids = Object.keys(sessions);
        for (var j = 0; j < ids.length; j++) {
          var s = sessions[ids[j]];
          if (s && s.created && (now - s.created) > SQUAD_EXPIRY_MS) {
            delete sessions[ids[j]];
            removedCount++;
          }
        }

        if (removedCount > 0) {
          var remaining = Object.keys(sessions).length;
          if (remaining === 0) {
            localStorage.removeItem(key);
          } else {
            localStorage.setItem(key, JSON.stringify(sessions));
          }
          var sizeAfter = remaining === 0 ? 0 : _sizeOf(key);
          freed += sizeBefore - sizeAfter;
          actions.push("Removed " + removedCount + " old squad sessions");
        }
      }
    } catch (_) { /* skip */ }
    return freed;
  }

  function _cleanPhotoCache(actions) {
    var freed = 0;
    try {
      // Collect all photo cache keys
      var photoCacheKeys = [];
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key || key.indexOf("lnv_photo_cache") === -1) continue;
        photoCacheKeys.push(key);
      }

      // For individual photo entries, sort by timestamp (oldest first)
      var entries = [];
      for (var k = 0; k < photoCacheKeys.length; k++) {
        var pkey = photoCacheKeys[k];
        try {
          var raw = localStorage.getItem(pkey);
          var parsed = JSON.parse(raw);
          entries.push({
            key: pkey,
            timestamp: (parsed && parsed.timestamp) ? parsed.timestamp : 0,
            size: _sizeOf(pkey)
          });
        } catch (_) {
          // Not JSON or non-timestamped — treat as oldest
          entries.push({ key: pkey, timestamp: 0, size: _sizeOf(pkey) });
        }
      }

      entries.sort(function (a, b) { return a.timestamp - b.timestamp; });

      for (var m = 0; m < entries.length; m++) {
        var entry = entries[m];
        localStorage.removeItem(entry.key);
        freed += entry.size;
        actions.push("Removed photo cache: " + entry.key);
      }
    } catch (_) { /* skip */ }
    return freed;
  }

  function _cleanOldCrawlHistory(actions) {
    var freed = 0;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key || key.indexOf("lnv_crawl_history") === -1) continue;

        var sizeBefore = _sizeOf(key);
        var raw = localStorage.getItem(key);
        if (!raw) continue;

        var history = JSON.parse(raw);
        if (typeof history !== "object" || history === null) continue;

        var names = Object.keys(history);
        if (names.length <= MAX_CRAWL_ENTRIES) continue;

        // Sort by visitedAt descending, keep most recent MAX_CRAWL_ENTRIES
        names.sort(function (a, b) {
          var tA = history[a] && history[a].visitedAt ? new Date(history[a].visitedAt).getTime() : 0;
          var tB = history[b] && history[b].visitedAt ? new Date(history[b].visitedAt).getTime() : 0;
          return tB - tA;
        });

        var trimmed = {};
        for (var j = 0; j < MAX_CRAWL_ENTRIES; j++) {
          trimmed[names[j]] = history[names[j]];
        }

        var removedCount = names.length - MAX_CRAWL_ENTRIES;
        localStorage.setItem(key, JSON.stringify(trimmed));
        var sizeAfter = _sizeOf(key);
        freed += sizeBefore - sizeAfter;
        actions.push("Trimmed crawl history: removed " + removedCount + " old entries, kept " + MAX_CRAWL_ENTRIES);
      }
    } catch (_) { /* skip */ }
    return freed;
  }

  /* ─── Quota-Exceeded Handler ─── */

  /**
   * onStorageFull(callback) — registers a handler invoked when a
   * QuotaExceededError is caught by safeSetItem.
   * Returns an unsubscribe function.
   */
  function onStorageFull(callback) {
    if (typeof callback === "function") {
      _fullHandlers.push(callback);
    }
    return function unsubscribe() {
      _fullHandlers = _fullHandlers.filter(function (h) { return h !== callback; });
    };
  }

  function _notifyFull(error) {
    for (var i = 0; i < _fullHandlers.length; i++) {
      try { _fullHandlers[i](error); } catch (_) { /* swallow */ }
    }
  }

  /* ─── Safe Write ─── */

  /**
   * safeSetItem(key, value) — wrapper around localStorage.setItem that
   * catches QuotaExceededError, triggers cleanup, and retries once.
   * Returns true on success, false if still failing after cleanup.
   */
  function safeSetItem(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      if (_isQuotaError(e)) {
        _notifyFull(e);
        // Attempt cleanup then retry
        cleanupStorage(70);
        try {
          localStorage.setItem(key, value);
          return true;
        } catch (e2) {
          return false;
        }
      }
      return false;
    }
  }

  function _isQuotaError(e) {
    if (!e) return false;
    // Different browsers use different error names/codes
    if (e.name === "QuotaExceededError") return true;
    if (e.code === 22) return true; // Legacy
    if (e.code === 1014 && e.name === "NS_ERROR_DOM_QUOTA_REACHED") return true; // Firefox
    return false;
  }

  /* ─── Test helpers ─── */

  /**
   * _resetHandlers() — clears all onStorageFull handlers (for tests).
   */
  function _resetHandlers() {
    _fullHandlers = [];
  }

  /* ─── Exports ─── */

  exports.getStorageUsage = getStorageUsage;
  exports.getStorageBreakdown = getStorageBreakdown;
  exports.cleanupStorage = cleanupStorage;
  exports.onStorageFull = onStorageFull;
  exports.safeSetItem = safeSetItem;
  exports._resetHandlers = _resetHandlers;
  exports._isQuotaError = _isQuotaError;
  exports.DEFAULT_QUOTA = DEFAULT_QUOTA;
  exports.VIBE_EXPIRY_MS = VIBE_EXPIRY_MS;
  exports.SQUAD_EXPIRY_MS = SQUAD_EXPIRY_MS;
  exports.MAX_CRAWL_ENTRIES = MAX_CRAWL_ENTRIES;

})(typeof module !== "undefined" ? module.exports : (window.LNVStorageManager = {}));
