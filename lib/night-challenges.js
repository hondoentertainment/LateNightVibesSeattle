/**
 * Late Night Vibes — Night Challenges & Weekly Missions.
 *
 * Time-limited challenge system with weekly rotation, progress tracking,
 * and XP rewards. Integrates with gamification.js for XP and
 * crawl-history.js for check-in data.
 *
 * Data persists in localStorage under `lnv_challenges` key.
 *
 * UMD-style export: works in Node (tests) and in the browser
 * (<script src="lib/night-challenges.js"> → window.LNVNightChallenges).
 */
(function (exports) {
  "use strict";

  var STORAGE_KEY = "lnv_challenges";

  /* ─── Dependency access ─── */

  function _gamification() {
    if (typeof module !== "undefined") {
      try { return require("./gamification"); } catch (_e) { return null; }
    }
    return (typeof window !== "undefined" && window.LNVGamification) || null;
  }

  function _crawlHistory() {
    if (typeof module !== "undefined") {
      try { return require("./crawl-history"); } catch (_e) { return null; }
    }
    return (typeof window !== "undefined" && window.LNVCrawl) || null;
  }

  function _cities() {
    if (typeof module !== "undefined") {
      try { return require("./cities"); } catch (_e) { return null; }
    }
    return (typeof window !== "undefined" && window.LNVCities) || null;
  }

  function _scopedKey(baseKey) {
    var c = _cities();
    return c && c.getCityKey ? c.getCityKey(baseKey) : baseKey;
  }

  function _migrate(baseKey) {
    var c = _cities();
    if (c && c.migrateKeyIfNeeded) c.migrateKeyIfNeeded(baseKey);
  }

  /* ─── Storage helpers ─── */

  function _readJSON(fallback) {
    try {
      _migrate(STORAGE_KEY);
      var raw = localStorage.getItem(_scopedKey(STORAGE_KEY));
      return raw ? JSON.parse(raw) : fallback;
    } catch (_e) {
      return fallback;
    }
  }

  function _writeJSON(data) {
    try {
      localStorage.setItem(_scopedKey(STORAGE_KEY), JSON.stringify(data));
    } catch (_e) { /* quota exceeded — silently fail */ }
  }

  /* ─── Now helper (overridable for tests) ─── */

  var _nowFn = function () { return Date.now(); };

  function _setNowFn(fn) {
    _nowFn = fn;
  }

  function _resetNowFn() {
    _nowFn = function () { return Date.now(); };
  }

  /* ─── Date helpers ─── */

  function _dayKey(timestamp) {
    var d = new Date(timestamp);
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1);
    if (m.length < 2) m = "0" + m;
    var day = String(d.getDate());
    if (day.length < 2) day = "0" + day;
    return y + "-" + m + "-" + day;
  }

  /**
   * Get ISO week number (1-53) for a given timestamp.
   * Deterministic — used for weekly challenge rotation.
   */
  function _getWeekNumber(timestamp) {
    var d = new Date(timestamp);
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
  }

  /**
   * Get the start (Monday 00:00) and end (Sunday 23:59:59.999) of the
   * ISO week containing the given timestamp.
   */
  function _getWeekBounds(timestamp) {
    var d = new Date(timestamp);
    var day = d.getDay(); // 0=Sun, 1=Mon, ...
    var diffToMonday = day === 0 ? -6 : 1 - day;
    var monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    var sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return { start: monday.getTime(), end: sunday.getTime() };
  }

  /* ─── Challenge Definitions ─── */

  var CHALLENGE_POOL = [
    // Exploration challenges
    {
      id: "explore-jazz-3",
      title: "Jazz Crawl",
      description: "Visit 3 jazz venues this weekend",
      type: "exploration",
      criteria: { category: "Jazz", count: 3 },
      xpReward: 150
    },
    {
      id: "explore-bars-5",
      title: "Bar Hopper",
      description: "Visit 5 different bars this week",
      type: "exploration",
      criteria: { category: "Bar", count: 5 },
      xpReward: 200
    },
    {
      id: "explore-cocktail-3",
      title: "Cocktail Connoisseur",
      description: "Visit 3 cocktail bars this week",
      type: "exploration",
      criteria: { category: "Cocktail", count: 3 },
      xpReward: 150
    },
    {
      id: "explore-live-music-2",
      title: "Live Wire",
      description: "Visit 2 live music venues this week",
      type: "exploration",
      criteria: { category: "Live Music", count: 2 },
      xpReward: 120
    },
    {
      id: "explore-dives-3",
      title: "Dive Deep",
      description: "Visit 3 dive bars this week",
      type: "exploration",
      criteria: { category: "Dive Bar", count: 3 },
      xpReward: 150
    },

    // Discovery challenges
    {
      id: "discover-new-neighborhood",
      title: "New Horizons",
      description: "Visit a venue in a neighborhood you have never been to",
      type: "discovery",
      criteria: { newNeighborhoods: 1 },
      xpReward: 100
    },
    {
      id: "discover-3-new",
      title: "Trailblazer",
      description: "Visit 3 venues you have never been to before",
      type: "discovery",
      criteria: { newVenues: 3 },
      xpReward: 120
    },
    {
      id: "discover-5-new",
      title: "Pioneer Spirit",
      description: "Visit 5 venues you have never been to before",
      type: "discovery",
      criteria: { newVenues: 5 },
      xpReward: 200
    },

    // Social challenges
    {
      id: "social-checkin-2",
      title: "Social Butterfly",
      description: "Check in with 2 friends at venues this week",
      type: "social",
      criteria: { socialCheckins: 2 },
      xpReward: 100
    },
    {
      id: "social-checkin-5",
      title: "Life of the Party",
      description: "Check in with 5 friends at venues this week",
      type: "social",
      criteria: { socialCheckins: 5 },
      xpReward: 180
    },
    {
      id: "social-squad-session",
      title: "Squad Goals",
      description: "Create a squad session with 3+ members",
      type: "social",
      criteria: { squadSession: 1, minMembers: 3 },
      xpReward: 150
    },

    // Streak challenges
    {
      id: "streak-3-nights",
      title: "Night Streak",
      description: "Go out 3 nights in a row",
      type: "streak",
      criteria: { consecutiveNights: 3 },
      xpReward: 200
    },
    {
      id: "streak-5-nights",
      title: "Unstoppable",
      description: "Go out 5 nights in a row",
      type: "streak",
      criteria: { consecutiveNights: 5 },
      xpReward: 350
    },
    {
      id: "streak-weekend-warrior",
      title: "Weekend Warrior",
      description: "Go out Friday and Saturday night",
      type: "streak",
      criteria: { weekendNights: 2 },
      xpReward: 120
    },

    // Vibe challenges
    {
      id: "vibe-sampler-3",
      title: "Vibe Sampler",
      description: "Visit venues with 3 different vibe tags in one night",
      type: "vibe",
      criteria: { uniqueVibesInNight: 3 },
      xpReward: 150
    },
    {
      id: "vibe-sampler-5",
      title: "Vibe Explorer",
      description: "Visit venues with 5 different vibe tags this week",
      type: "vibe",
      criteria: { uniqueVibesInWeek: 5 },
      xpReward: 180
    },
    {
      id: "vibe-chill-master",
      title: "Chill Master",
      description: "Visit 2 venues tagged as chill or relaxed",
      type: "vibe",
      criteria: { vibeTag: "chill", count: 2 },
      xpReward: 100
    },
    {
      id: "vibe-energy-seeker",
      title: "Energy Seeker",
      description: "Visit 2 venues tagged as energetic or lively",
      type: "vibe",
      criteria: { vibeTag: "energetic", count: 2 },
      xpReward: 100
    }
  ];

  /* ─── Weekly Rotation (deterministic) ─── */

  /**
   * Seeded pseudo-random for deterministic weekly selection.
   * Simple mulberry32 PRNG.
   */
  function _seededRandom(seed) {
    var t = seed + 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Select N challenges from the pool using a deterministic seed based on
   * year + week number. Returns the same set for any call within the same week.
   */
  function _selectWeeklyChallenges(weekNumber, year, count) {
    var seed = year * 100 + weekNumber;
    var pool = CHALLENGE_POOL.slice(); // copy
    var selected = [];
    var typeCounts = {};

    // Shuffle deterministically
    for (var i = pool.length - 1; i > 0; i--) {
      var s = seed + i;
      var j = Math.floor(_seededRandom(s) * (i + 1));
      var tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }

    // Pick challenges ensuring type diversity (max 2 per type)
    for (var k = 0; k < pool.length && selected.length < count; k++) {
      var ch = pool[k];
      var tc = typeCounts[ch.type] || 0;
      if (tc < 2) {
        selected.push(ch);
        typeCounts[ch.type] = tc + 1;
      }
    }

    return selected;
  }

  var WEEKLY_CHALLENGE_COUNT = 5;

  /* ─── State management ─── */

  function _getState() {
    return _readJSON({
      activeWeek: null,
      activeChallenges: [],
      completedChallenges: [],
      claimedRewards: [],
      leaderboard: []
    });
  }

  function _saveState(state) {
    _writeJSON(state);
  }

  /**
   * Ensure current week's challenges are loaded. If the week has
   * changed, archive old challenges and generate new ones.
   */
  function _ensureCurrentWeek() {
    var now = _nowFn();
    var weekNum = _getWeekNumber(now);
    var d = new Date(now);
    var year = d.getFullYear();
    var weekKey = year + "-W" + weekNum;
    var state = _getState();

    if (state.activeWeek === weekKey) {
      return state;
    }

    // Archive any previous active challenges
    if (state.activeChallenges && state.activeChallenges.length > 0) {
      for (var i = 0; i < state.activeChallenges.length; i++) {
        var old = state.activeChallenges[i];
        if (!old.claimed) {
          old.expired = true;
        }
        state.completedChallenges.push(old);
      }
    }

    // Generate new weekly challenges
    var bounds = _getWeekBounds(now);
    var defs = _selectWeeklyChallenges(weekNum, year, WEEKLY_CHALLENGE_COUNT);
    var newChallenges = [];
    for (var j = 0; j < defs.length; j++) {
      var def = defs[j];
      newChallenges.push({
        id: def.id,
        title: def.title,
        description: def.description,
        type: def.type,
        criteria: def.criteria,
        xpReward: def.xpReward,
        startDate: bounds.start,
        endDate: bounds.end,
        progress: 0,
        target: _getTargetFromCriteria(def.criteria),
        completed: false,
        claimed: false,
        weekKey: weekKey
      });
    }

    state.activeWeek = weekKey;
    state.activeChallenges = newChallenges;
    _saveState(state);
    return state;
  }

  function _getTargetFromCriteria(criteria) {
    if (criteria.count) return criteria.count;
    if (criteria.newNeighborhoods) return criteria.newNeighborhoods;
    if (criteria.newVenues) return criteria.newVenues;
    if (criteria.socialCheckins) return criteria.socialCheckins;
    if (criteria.squadSession) return criteria.squadSession;
    if (criteria.consecutiveNights) return criteria.consecutiveNights;
    if (criteria.weekendNights) return criteria.weekendNights;
    if (criteria.uniqueVibesInNight) return criteria.uniqueVibesInNight;
    if (criteria.uniqueVibesInWeek) return criteria.uniqueVibesInWeek;
    return 1;
  }

  /* ─── Progress Tracking ─── */

  /**
   * Evaluate challenge progress against crawl-history check-in data.
   * Returns updated progress number for a given challenge.
   */
  function _evaluateProgress(challenge) {
    var crawl = _crawlHistory();
    if (!crawl) return challenge.progress;

    var history = crawl.loadHistory();
    var names = Object.keys(history);
    var criteria = challenge.criteria;
    var bounds = { start: challenge.startDate, end: challenge.endDate };

    // Filter visits within challenge time window
    var weekVisits = [];
    for (var i = 0; i < names.length; i++) {
      var entry = history[names[i]];
      if (entry && entry.visitedAt) {
        var ts = new Date(entry.visitedAt).getTime();
        if (ts >= bounds.start && ts <= bounds.end) {
          weekVisits.push({ name: names[i], entry: entry, timestamp: ts });
        }
      }
    }

    // Exploration: count visits matching a category
    if (criteria.category) {
      // We can't reliably check category from crawl-history alone
      // (it only stores name + rating + visitedAt).
      // Progress is tracked manually via updateProgress or
      // by counting total visits as a proxy.
      return Math.min(weekVisits.length, challenge.target);
    }

    // Discovery: new venues
    if (criteria.newVenues) {
      return Math.min(weekVisits.length, challenge.target);
    }

    // Discovery: new neighborhoods
    if (criteria.newNeighborhoods) {
      // Tracked manually
      return challenge.progress;
    }

    // Streak: consecutive nights
    if (criteria.consecutiveNights) {
      var nightSet = {};
      for (var s = 0; s < weekVisits.length; s++) {
        nightSet[_dayKey(weekVisits[s].timestamp)] = true;
      }
      var nights = Object.keys(nightSet).sort();
      var maxConsec = 0;
      var curConsec = 1;
      for (var n = 1; n < nights.length; n++) {
        var prev = new Date(nights[n - 1] + "T00:00:00");
        var curr = new Date(nights[n] + "T00:00:00");
        var gap = Math.round((curr - prev) / 86400000);
        if (gap === 1) {
          curConsec++;
        } else {
          if (curConsec > maxConsec) maxConsec = curConsec;
          curConsec = 1;
        }
      }
      if (curConsec > maxConsec) maxConsec = curConsec;
      return Math.min(nights.length > 0 ? maxConsec : 0, challenge.target);
    }

    // Streak: weekend nights
    if (criteria.weekendNights) {
      var weekendDays = {};
      for (var w = 0; w < weekVisits.length; w++) {
        var dayOfWeek = new Date(weekVisits[w].timestamp).getDay();
        // Friday=5, Saturday=6
        if (dayOfWeek === 5 || dayOfWeek === 6) {
          weekendDays[_dayKey(weekVisits[w].timestamp)] = true;
        }
      }
      return Math.min(Object.keys(weekendDays).length, challenge.target);
    }

    // Vibe: unique vibes in week
    if (criteria.uniqueVibesInWeek) {
      // Tracked manually since crawl-history doesn't store vibe tags
      return challenge.progress;
    }

    // Vibe: unique vibes in one night
    if (criteria.uniqueVibesInNight) {
      // Tracked manually
      return challenge.progress;
    }

    // Vibe: specific vibe tag
    if (criteria.vibeTag) {
      // Tracked manually
      return challenge.progress;
    }

    // Social: tracked manually
    if (criteria.socialCheckins || criteria.squadSession) {
      return challenge.progress;
    }

    return challenge.progress;
  }

  /* ─── Public API ─── */

  /**
   * getActiveChallenges() — returns current week's active (non-completed) challenges.
   */
  function getActiveChallenges() {
    var state = _ensureCurrentWeek();
    var now = _nowFn();
    var active = [];
    for (var i = 0; i < state.activeChallenges.length; i++) {
      var ch = state.activeChallenges[i];
      if (!ch.completed && now <= ch.endDate) {
        active.push(ch);
      }
    }
    return active;
  }

  /**
   * getChallengeProgress(challengeId) — returns progress info for a challenge.
   */
  function getChallengeProgress(challengeId) {
    var state = _ensureCurrentWeek();
    for (var i = 0; i < state.activeChallenges.length; i++) {
      var ch = state.activeChallenges[i];
      if (ch.id === challengeId) {
        // Re-evaluate progress from crawl data
        var progress = _evaluateProgress(ch);
        ch.progress = progress;
        _saveState(state);

        var pct = ch.target > 0 ? Math.min(100, Math.round((progress / ch.target) * 100)) : 0;
        return {
          id: ch.id,
          title: ch.title,
          progress: progress,
          target: ch.target,
          percentComplete: pct,
          completed: ch.completed,
          claimed: ch.claimed
        };
      }
    }

    // Check completed challenges
    for (var j = 0; j < state.completedChallenges.length; j++) {
      var cch = state.completedChallenges[j];
      if (cch.id === challengeId) {
        var cpct = cch.target > 0 ? Math.min(100, Math.round((cch.progress / cch.target) * 100)) : 0;
        return {
          id: cch.id,
          title: cch.title,
          progress: cch.progress,
          target: cch.target,
          percentComplete: cpct,
          completed: cch.completed,
          claimed: cch.claimed
        };
      }
    }

    return null;
  }

  /**
   * checkChallengeCompletion(challengeId) — checks if challenge is complete.
   * Returns true if newly completed, false otherwise.
   */
  function checkChallengeCompletion(challengeId) {
    var state = _ensureCurrentWeek();
    for (var i = 0; i < state.activeChallenges.length; i++) {
      var ch = state.activeChallenges[i];
      if (ch.id === challengeId) {
        if (ch.completed) return false; // already completed
        var progress = _evaluateProgress(ch);
        ch.progress = progress;
        if (progress >= ch.target) {
          ch.completed = true;
          ch.completedAt = _nowFn();
          _saveState(state);
          return true;
        }
        _saveState(state);
        return false;
      }
    }
    return false;
  }

  /**
   * claimChallengeReward(challengeId) — claim XP reward for a completed challenge.
   * Returns { xpAwarded, challenge } or null if not claimable.
   * Prevents double-claiming.
   */
  function claimChallengeReward(challengeId) {
    var state = _ensureCurrentWeek();
    for (var i = 0; i < state.activeChallenges.length; i++) {
      var ch = state.activeChallenges[i];
      if (ch.id === challengeId) {
        if (!ch.completed) return null;
        if (ch.claimed) return null; // prevent double-claim

        ch.claimed = true;
        ch.claimedAt = _nowFn();

        // Award XP via gamification
        var gam = _gamification();
        if (gam && gam.addXP) {
          gam.addXP(ch.xpReward, "Challenge: " + ch.title);
        }

        // Track in claimed rewards
        if (!state.claimedRewards) state.claimedRewards = [];
        state.claimedRewards.push({
          challengeId: ch.id,
          xpReward: ch.xpReward,
          claimedAt: ch.claimedAt
        });

        _saveState(state);
        return { xpAwarded: ch.xpReward, challenge: ch };
      }
    }

    // Also check completed challenges list (from previous weeks)
    for (var j = 0; j < state.completedChallenges.length; j++) {
      var cch = state.completedChallenges[j];
      if (cch.id === challengeId) {
        if (!cch.completed) return null;
        if (cch.claimed) return null;

        cch.claimed = true;
        cch.claimedAt = _nowFn();

        var gam2 = _gamification();
        if (gam2 && gam2.addXP) {
          gam2.addXP(cch.xpReward, "Challenge: " + cch.title);
        }

        if (!state.claimedRewards) state.claimedRewards = [];
        state.claimedRewards.push({
          challengeId: cch.id,
          xpReward: cch.xpReward,
          claimedAt: cch.claimedAt
        });

        _saveState(state);
        return { xpAwarded: cch.xpReward, challenge: cch };
      }
    }

    return null;
  }

  /**
   * getCompletedChallenges() — returns all completed challenges (current + past).
   */
  function getCompletedChallenges() {
    var state = _ensureCurrentWeek();
    var result = [];

    // Current week completed
    for (var i = 0; i < state.activeChallenges.length; i++) {
      if (state.activeChallenges[i].completed) {
        result.push(state.activeChallenges[i]);
      }
    }

    // Past completed
    for (var j = 0; j < state.completedChallenges.length; j++) {
      if (state.completedChallenges[j].completed) {
        result.push(state.completedChallenges[j]);
      }
    }

    return result;
  }

  /**
   * getWeeklyChallenges() — returns all challenges for the current week (active + completed).
   */
  function getWeeklyChallenges() {
    var state = _ensureCurrentWeek();
    return state.activeChallenges.slice();
  }

  /**
   * getChallengeLeaderboard() — returns leaderboard sorted by completed challenges.
   */
  function getChallengeLeaderboard() {
    var state = _ensureCurrentWeek();
    var board = state.leaderboard || [];
    board.sort(function (a, b) { return b.score - a.score; });
    return board;
  }

  /**
   * updateLeaderboard(username, score) — add or update a leaderboard entry.
   */
  function updateLeaderboard(username, score) {
    if (!username) return null;
    var state = _ensureCurrentWeek();
    if (!state.leaderboard) state.leaderboard = [];

    var found = false;
    for (var i = 0; i < state.leaderboard.length; i++) {
      if (state.leaderboard[i].username === username) {
        state.leaderboard[i].score = score;
        state.leaderboard[i].updatedAt = _nowFn();
        found = true;
        break;
      }
    }
    if (!found) {
      state.leaderboard.push({
        username: username,
        score: score,
        updatedAt: _nowFn()
      });
    }
    _saveState(state);
    return { username: username, score: score };
  }

  /**
   * getAllChallengeDefinitions() — returns the full challenge pool.
   */
  function getAllChallengeDefinitions() {
    return CHALLENGE_POOL.slice();
  }

  /**
   * updateProgress(challengeId, progressValue) — manually update challenge progress.
   */
  function updateProgress(challengeId, progressValue) {
    var state = _ensureCurrentWeek();
    for (var i = 0; i < state.activeChallenges.length; i++) {
      var ch = state.activeChallenges[i];
      if (ch.id === challengeId) {
        ch.progress = progressValue;
        if (progressValue >= ch.target && !ch.completed) {
          ch.completed = true;
          ch.completedAt = _nowFn();
        }
        _saveState(state);
        return ch;
      }
    }
    return null;
  }

  /**
   * getTimeRemaining() — returns ms remaining in current week.
   */
  function getTimeRemaining() {
    var state = _ensureCurrentWeek();
    if (!state.activeChallenges || state.activeChallenges.length === 0) return 0;
    var endDate = state.activeChallenges[0].endDate;
    var remaining = endDate - _nowFn();
    return remaining > 0 ? remaining : 0;
  }

  /**
   * resetAll() — clears all challenge data (for testing).
   */
  function resetAll() {
    try { localStorage.removeItem(_scopedKey(STORAGE_KEY)); } catch (_e) { /* noop */ }
  }

  /* ─── Exports ─── */

  exports.CHALLENGE_POOL = CHALLENGE_POOL;
  exports.getActiveChallenges = getActiveChallenges;
  exports.getChallengeProgress = getChallengeProgress;
  exports.checkChallengeCompletion = checkChallengeCompletion;
  exports.claimChallengeReward = claimChallengeReward;
  exports.getCompletedChallenges = getCompletedChallenges;
  exports.getWeeklyChallenges = getWeeklyChallenges;
  exports.getChallengeLeaderboard = getChallengeLeaderboard;
  exports.getAllChallengeDefinitions = getAllChallengeDefinitions;
  exports.updateLeaderboard = updateLeaderboard;
  exports.updateProgress = updateProgress;
  exports.getTimeRemaining = getTimeRemaining;
  exports.resetAll = resetAll;
  exports._setNowFn = _setNowFn;
  exports._resetNowFn = _resetNowFn;
  exports._getWeekNumber = _getWeekNumber;
  exports._getWeekBounds = _getWeekBounds;
  exports._selectWeeklyChallenges = _selectWeeklyChallenges;

})(typeof module !== "undefined" ? module.exports : (window.LNVNightChallenges = {}));
