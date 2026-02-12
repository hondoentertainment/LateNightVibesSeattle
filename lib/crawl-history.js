/**
 * Crawl History — "Been There" tracker for Late Night Vibes Seattle.
 *
 * Manages a localStorage-backed record of visited venues with optional
 * ratings (thumbs up / thumbs down). Shared across browse (app.js) and
 * recommendation (recommend.js) pages.
 *
 * UMD-style export: works in Node (tests) and in the browser
 * (<script src="lib/crawl-history.js"> → window.LNVCrawl).
 */
(function (exports) {
  var STORAGE_KEY = "lnv_crawl_history";

  /* ─── Persistence ─── */

  /**
   * Load crawl history from localStorage.
   * Returns an object: { "Venue Name": { rating, visitedAt } }
   */
  function loadHistory() {
    try {
      var raw = (typeof localStorage !== "undefined") ? localStorage.getItem(STORAGE_KEY) : null;
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return {};
  }

  /**
   * Save crawl history to localStorage.
   */
  function saveHistory(history) {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
      }
    } catch (_) {}
  }

  /* ─── Mutations (return the mutated history for chaining) ─── */

  /**
   * Mark a venue as visited. rating: 1 (up), -1 (down), 0 (neutral/default).
   */
  function markVisited(history, name, rating) {
    var r = (typeof rating === "number") ? rating : 0;
    history[name] = {
      rating: r,
      visitedAt: (history[name] && history[name].visitedAt)
        ? history[name].visitedAt
        : new Date().toISOString(),
    };
    return history;
  }

  /**
   * Remove a venue from crawl history (un-mark as visited).
   */
  function unmarkVisited(history, name) {
    delete history[name];
    return history;
  }

  /**
   * Update rating for a venue in crawl history.
   * If the venue isn't already visited, this is a no-op.
   */
  function setRating(history, name, rating) {
    if (!history[name]) return history;
    history[name].rating = (typeof rating === "number") ? rating : 0;
    return history;
  }

  /* ─── Queries ─── */

  /**
   * Check if a venue has been visited.
   */
  function isVisited(history, name) {
    return Object.prototype.hasOwnProperty.call(history, name);
  }

  /**
   * Get the rating for a venue (0 if not visited or no rating).
   */
  function getRating(history, name) {
    return (history[name] && typeof history[name].rating === "number")
      ? history[name].rating
      : 0;
  }

  /**
   * Get the visitedAt ISO string for a venue, or null.
   */
  function getVisitedAt(history, name) {
    return (history[name] && history[name].visitedAt) ? history[name].visitedAt : null;
  }

  /**
   * Get aggregate stats from crawl history.
   */
  function getStats(history) {
    var entries = Object.values(history);
    return {
      total: entries.length,
      liked: entries.filter(function (e) { return e.rating === 1; }).length,
      disliked: entries.filter(function (e) { return e.rating === -1; }).length,
      unrated: entries.filter(function (e) { return e.rating === 0; }).length,
    };
  }

  /**
   * Get all visited venue names as an array.
   */
  function getVisitedNames(history) {
    return Object.keys(history);
  }

  /**
   * Toggle visited status for a venue.
   * Returns { history, nowVisited } so the caller knows the new state.
   */
  function toggleVisited(history, name) {
    if (isVisited(history, name)) {
      unmarkVisited(history, name);
      return { history: history, nowVisited: false };
    }
    markVisited(history, name, 0);
    return { history: history, nowVisited: true };
  }

  /* ─── Exports ─── */

  exports.STORAGE_KEY = STORAGE_KEY;
  exports.loadHistory = loadHistory;
  exports.saveHistory = saveHistory;
  exports.markVisited = markVisited;
  exports.unmarkVisited = unmarkVisited;
  exports.setRating = setRating;
  exports.isVisited = isVisited;
  exports.getRating = getRating;
  exports.getVisitedAt = getVisitedAt;
  exports.getStats = getStats;
  exports.getVisitedNames = getVisitedNames;
  exports.toggleVisited = toggleVisited;

})(typeof module !== "undefined" ? module.exports : (window.LNVCrawl = {}));
