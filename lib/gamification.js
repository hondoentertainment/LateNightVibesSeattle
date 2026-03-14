/**
 * Late Night Vibes — Gamification (achievements, streaks, XP, leaderboards, challenges).
 *
 * Tracks user achievements, streaks, leaderboards, and challenges.
 * Data persists in localStorage under `lnv_gamification_*` keys.
 *
 * UMD-style export: works in Node (tests) and in the browser
 * (<script src="lib/gamification.js"> → window.LNVGamification).
 */
(function (exports) {
  "use strict";

  var STORAGE_ACHIEVEMENTS = "lnv_gamification_achievements";
  var STORAGE_STREAKS = "lnv_gamification_streaks";
  var STORAGE_XP = "lnv_gamification_xp";
  var STORAGE_LEADERBOARD = "lnv_gamification_leaderboard";
  var STORAGE_CHALLENGES = "lnv_gamification_challenges";

  /* ─── Achievement Definitions ─── */

  var ACHIEVEMENTS = [
    // Exploration
    { id: "first-crawl", name: "First Crawl", description: "Visit 1 venue", icon: "\uD83C\uDF1F", category: "exploration", threshold: 1 },
    { id: "explorer-5", name: "Explorer", description: "Visit 5 venues", icon: "\uD83D\uDDFA\uFE0F", category: "exploration", threshold: 5 },
    { id: "explorer-10", name: "Seasoned Explorer", description: "Visit 10 venues", icon: "\uD83E\uDDED", category: "exploration", threshold: 10 },
    { id: "explorer-25", name: "Veteran Explorer", description: "Visit 25 venues", icon: "\uD83C\uDF0D", category: "exploration", threshold: 25 },
    { id: "explorer-50", name: "Legendary Explorer", description: "Visit 50 venues", icon: "\uD83D\uDE80", category: "exploration", threshold: 50 },
    { id: "night-owl", name: "Night Owl", description: "Visit a venue after midnight", icon: "\uD83E\uDD89", category: "exploration", threshold: 1 },
    { id: "early-bird", name: "Early Bird", description: "Visit a venue before 10pm", icon: "\uD83D\uDC26", category: "exploration", threshold: 1 },
    { id: "neighborhood-hopper", name: "Neighborhood Hopper", description: "Visit venues in 3+ neighborhoods", icon: "\uD83C\uDFD8\uFE0F", category: "exploration", threshold: 3 },
    { id: "city-hopper", name: "City Hopper", description: "Visit venues in 5+ neighborhoods", icon: "\uD83C\uDF06", category: "exploration", threshold: 5 },

    // Mastery
    { id: "vibe-collector", name: "Vibe Collector", description: "Experience 5+ different vibe tags", icon: "\uD83C\uDFA8", category: "mastery", threshold: 5 },
    { id: "vibe-master", name: "Vibe Master", description: "Experience 10+ different vibe tags", icon: "\uD83C\uDFAD", category: "mastery", threshold: 10 },
    { id: "mood-matcher", name: "Mood Matcher", description: "Use mood match 10 times", icon: "\uD83C\uDFAF", category: "mastery", threshold: 10 },
    { id: "safety-first", name: "Safety First", description: "Set up emergency contacts", icon: "\uD83D\uDEE1\uFE0F", category: "mastery", threshold: 1 },

    // Social
    { id: "social-butterfly", name: "Social Butterfly", description: "Create 3+ squad sessions", icon: "\uD83E\uDD8B", category: "social", threshold: 3 },
    { id: "squad-leader", name: "Squad Leader", description: "Have 5+ members in a session", icon: "\uD83D\uDC51", category: "social", threshold: 5 },

    // Streak
    { id: "streak-3", name: "3-Day Streak", description: "Maintain a 3-day activity streak", icon: "\uD83D\uDD25", category: "streak", threshold: 3 },
    { id: "streak-7", name: "Weekly Warrior", description: "Maintain a 7-day activity streak", icon: "\u26A1", category: "streak", threshold: 7 },
    { id: "streak-30", name: "Monthly Legend", description: "Maintain a 30-day activity streak", icon: "\uD83C\uDFC6", category: "streak", threshold: 30 }
  ];

  /* ─── City-scoped key helpers ─── */

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

  function _readJSON(baseKey, fallback) {
    try {
      _migrate(baseKey);
      var raw = localStorage.getItem(_scopedKey(baseKey));
      return raw ? JSON.parse(raw) : fallback;
    } catch (_e) {
      return fallback;
    }
  }

  function _writeJSON(baseKey, data) {
    try {
      localStorage.setItem(_scopedKey(baseKey), JSON.stringify(data));
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

  /* ─── Day key helper ─── */

  function _dayKey(timestamp) {
    var d = new Date(timestamp);
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1);
    if (m.length < 2) m = "0" + m;
    var day = String(d.getDate());
    if (day.length < 2) day = "0" + day;
    return y + "-" + m + "-" + day;
  }

  /* ─── Achievement stat-to-id mapping ─── */

  var STAT_MAPPINGS = {
    venuesVisited:      ["first-crawl", "explorer-5", "explorer-10", "explorer-25", "explorer-50"],
    nightVisits:        ["night-owl"],
    earlyVisits:        ["early-bird"],
    neighborhoods:      ["neighborhood-hopper", "city-hopper"],
    vibeTags:           ["vibe-collector", "vibe-master"],
    moodMatches:        ["mood-matcher"],
    emergencyContacts:  ["safety-first"],
    squadSessions:      ["social-butterfly"],
    maxSquadMembers:    ["squad-leader"],
    currentStreak:      ["streak-3", "streak-7", "streak-30"]
  };

  /* ─── Achievement Tracking ─── */

  function _getAchievementById(id) {
    for (var i = 0; i < ACHIEVEMENTS.length; i++) {
      if (ACHIEVEMENTS[i].id === id) return ACHIEVEMENTS[i];
    }
    return null;
  }

  /**
   * checkAchievements(userStats)
   * Takes a stats object and returns array of newly unlocked achievement IDs.
   */
  function checkAchievements(userStats) {
    if (!userStats) return [];
    var unlocked = _readJSON(STORAGE_ACHIEVEMENTS, []);
    var newlyUnlocked = [];

    for (var statKey in STAT_MAPPINGS) {
      if (!STAT_MAPPINGS.hasOwnProperty(statKey)) continue;
      var val = userStats[statKey];
      if (val === undefined || val === null) continue;

      var ids = STAT_MAPPINGS[statKey];
      for (var i = 0; i < ids.length; i++) {
        var achId = ids[i];
        if (unlocked.indexOf(achId) !== -1) continue;

        var ach = _getAchievementById(achId);
        if (ach && val >= ach.threshold) {
          unlocked.push(achId);
          newlyUnlocked.push(achId);
        }
      }
    }

    if (newlyUnlocked.length > 0) {
      _writeJSON(STORAGE_ACHIEVEMENTS, unlocked);
    }
    return newlyUnlocked;
  }

  /**
   * getUnlockedAchievements() — returns array of unlocked achievement objects.
   */
  function getUnlockedAchievements() {
    var ids = _readJSON(STORAGE_ACHIEVEMENTS, []);
    var result = [];
    for (var i = 0; i < ids.length; i++) {
      var ach = _getAchievementById(ids[i]);
      if (ach) result.push(ach);
    }
    return result;
  }

  /**
   * getProgress(achievementId) — returns {current, target, percentComplete}.
   * Requires userStats to be passed for current value lookup.
   */
  function getProgress(achievementId, userStats) {
    var ach = _getAchievementById(achievementId);
    if (!ach) return null;

    var current = 0;
    if (userStats) {
      for (var statKey in STAT_MAPPINGS) {
        if (!STAT_MAPPINGS.hasOwnProperty(statKey)) continue;
        var ids = STAT_MAPPINGS[statKey];
        if (ids.indexOf(achievementId) !== -1) {
          current = userStats[statKey] || 0;
          break;
        }
      }
    }

    var pct = Math.min(100, Math.round((current / ach.threshold) * 100));
    return { current: current, target: ach.threshold, percentComplete: pct };
  }

  /* ─── Streak System ─── */

  /**
   * recordActivity(type) — records daily activity of given type.
   */
  function recordActivity(type) {
    var data = _readJSON(STORAGE_STREAKS, { activities: [], longestStreak: 0 });
    var today = _dayKey(_nowFn());
    var entry = { date: today, type: type || "general", timestamp: _nowFn() };

    // Check if already recorded today for this type
    var dominated = false;
    for (var i = 0; i < data.activities.length; i++) {
      if (data.activities[i].date === today && data.activities[i].type === (type || "general")) {
        dominated = true;
        break;
      }
    }
    if (!dominated) {
      data.activities.push(entry);
    }

    // Update longest streak
    var current = _computeCurrentStreak(data.activities);
    if (current > data.longestStreak) {
      data.longestStreak = current;
    }

    _writeJSON(STORAGE_STREAKS, data);
    return entry;
  }

  function _uniqueDays(activities) {
    var daySet = {};
    for (var i = 0; i < activities.length; i++) {
      daySet[activities[i].date] = true;
    }
    var days = [];
    for (var key in daySet) {
      if (daySet.hasOwnProperty(key)) days.push(key);
    }
    days.sort();
    return days;
  }

  function _computeCurrentStreak(activities) {
    var days = _uniqueDays(activities);
    if (days.length === 0) return 0;

    var today = _dayKey(_nowFn());
    var lastDay = days[days.length - 1];

    // Streak must include today or yesterday to be current
    var todayDate = new Date(today + "T00:00:00");
    var lastDate = new Date(lastDay + "T00:00:00");
    var diffDays = Math.round((todayDate - lastDate) / (24 * 60 * 60 * 1000));
    if (diffDays > 1) return 0;

    var streak = 1;
    for (var i = days.length - 2; i >= 0; i--) {
      var d1 = new Date(days[i + 1] + "T00:00:00");
      var d2 = new Date(days[i] + "T00:00:00");
      var gap = Math.round((d1 - d2) / (24 * 60 * 60 * 1000));
      if (gap === 1) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  /**
   * getCurrentStreak() — returns consecutive days count.
   */
  function getCurrentStreak() {
    var data = _readJSON(STORAGE_STREAKS, { activities: [], longestStreak: 0 });
    return _computeCurrentStreak(data.activities);
  }

  /**
   * getLongestStreak() — returns the longest streak ever recorded.
   */
  function getLongestStreak() {
    var data = _readJSON(STORAGE_STREAKS, { activities: [], longestStreak: 0 });
    // Recompute to ensure accuracy
    var current = _computeCurrentStreak(data.activities);
    return Math.max(data.longestStreak, current);
  }

  /**
   * isStreakActive() — checks if today has activity.
   */
  function isStreakActive() {
    var data = _readJSON(STORAGE_STREAKS, { activities: [], longestStreak: 0 });
    var today = _dayKey(_nowFn());
    for (var i = 0; i < data.activities.length; i++) {
      if (data.activities[i].date === today) return true;
    }
    return false;
  }

  /* ─── XP & Levels ─── */

  /**
   * addXP(amount, reason) — adds XP with reason tracking.
   */
  function addXP(amount, reason) {
    if (!amount || amount <= 0) return null;
    var data = _readJSON(STORAGE_XP, { total: 0, history: [] });
    var entry = { amount: amount, reason: reason || "", timestamp: _nowFn() };
    data.total += amount;
    data.history.push(entry);
    _writeJSON(STORAGE_XP, data);
    return { total: data.total, added: amount };
  }

  /**
   * getXP() — returns total XP.
   */
  function getXP() {
    var data = _readJSON(STORAGE_XP, { total: 0, history: [] });
    return data.total;
  }

  /**
   * getLevel() — returns current level.
   * Level N needs N*100 XP to reach (cumulative: 100, 300, 600, 1000, ...).
   */
  function getLevel() {
    var xp = getXP();
    var level = 0;
    var cumulative = 0;
    while (cumulative + (level + 1) * 100 <= xp) {
      level++;
      cumulative += level * 100;
    }
    return level;
  }

  /**
   * getLevelProgress() — returns {level, currentXP, xpForNextLevel, percentComplete}.
   */
  function getLevelProgress() {
    var xp = getXP();
    var level = 0;
    var cumulative = 0;
    while (cumulative + (level + 1) * 100 <= xp) {
      level++;
      cumulative += level * 100;
    }
    var xpInLevel = xp - cumulative;
    var xpNeeded = (level + 1) * 100;
    var pct = Math.min(100, Math.round((xpInLevel / xpNeeded) * 100));
    return {
      level: level,
      currentXP: xpInLevel,
      xpForNextLevel: xpNeeded,
      percentComplete: pct
    };
  }

  /* ─── Leaderboard ─── */

  /**
   * updateLeaderboard(username, score, city) — adds/updates an entry.
   */
  function updateLeaderboard(username, score, city) {
    if (!username) return null;
    var data = _readJSON(STORAGE_LEADERBOARD, []);
    var found = false;
    for (var i = 0; i < data.length; i++) {
      if (data[i].username === username && data[i].city === (city || "default")) {
        data[i].score = score;
        data[i].updatedAt = _nowFn();
        found = true;
        break;
      }
    }
    if (!found) {
      data.push({
        username: username,
        score: score,
        city: city || "default",
        updatedAt: _nowFn()
      });
    }
    _writeJSON(STORAGE_LEADERBOARD, data);
    return { username: username, score: score, city: city || "default" };
  }

  /**
   * getLeaderboard(city?, limit?) — returns sorted entries.
   */
  function getLeaderboard(city, limit) {
    var data = _readJSON(STORAGE_LEADERBOARD, []);
    var filtered = data;
    if (city) {
      filtered = [];
      for (var i = 0; i < data.length; i++) {
        if (data[i].city === city) filtered.push(data[i]);
      }
    }
    filtered.sort(function (a, b) { return b.score - a.score; });
    if (limit && limit > 0) {
      filtered = filtered.slice(0, limit);
    }
    return filtered;
  }

  /**
   * getUserRank(username, city?) — returns 1-based rank or null.
   */
  function getUserRank(username, city) {
    var board = getLeaderboard(city);
    for (var i = 0; i < board.length; i++) {
      if (board[i].username === username) return i + 1;
    }
    return null;
  }

  /* ─── Challenges ─── */

  function _generateId() {
    return "ch_" + _nowFn().toString(36) + "_" + Math.random().toString(36).substr(2, 6);
  }

  /**
   * createChallenge(challengeData)
   * challengeData: {title, description, type, target, expiresAt, reward: {xp, badge?}}
   */
  function createChallenge(challengeData) {
    if (!challengeData || !challengeData.title) return null;
    var data = _readJSON(STORAGE_CHALLENGES, []);
    var challenge = {
      id: _generateId(),
      title: challengeData.title,
      description: challengeData.description || "",
      type: challengeData.type || "visit",
      target: challengeData.target || 1,
      progress: 0,
      completed: false,
      createdAt: _nowFn(),
      expiresAt: challengeData.expiresAt || null,
      reward: challengeData.reward || { xp: 0 }
    };
    data.push(challenge);
    _writeJSON(STORAGE_CHALLENGES, data);
    return challenge;
  }

  /**
   * getActiveChallenges() — returns non-expired, non-completed challenges.
   */
  function getActiveChallenges() {
    var data = _readJSON(STORAGE_CHALLENGES, []);
    var now = _nowFn();
    var active = [];
    for (var i = 0; i < data.length; i++) {
      var ch = data[i];
      if (ch.completed) continue;
      if (ch.expiresAt && new Date(ch.expiresAt).getTime() < now) continue;
      active.push(ch);
    }
    return active;
  }

  /**
   * completeChallenge(challengeId) — marks a challenge as completed and awards XP.
   */
  function completeChallenge(challengeId) {
    var data = _readJSON(STORAGE_CHALLENGES, []);
    var challenge = null;
    for (var i = 0; i < data.length; i++) {
      if (data[i].id === challengeId) {
        data[i].completed = true;
        data[i].completedAt = _nowFn();
        challenge = data[i];
        break;
      }
    }
    if (!challenge) return null;
    _writeJSON(STORAGE_CHALLENGES, data);

    // Award XP if specified
    if (challenge.reward && challenge.reward.xp) {
      addXP(challenge.reward.xp, "Challenge: " + challenge.title);
    }
    return challenge;
  }

  /**
   * getChallengeProgress(challengeId) — returns progress info.
   */
  function getChallengeProgress(challengeId) {
    var data = _readJSON(STORAGE_CHALLENGES, []);
    for (var i = 0; i < data.length; i++) {
      if (data[i].id === challengeId) {
        var ch = data[i];
        var pct = Math.min(100, Math.round((ch.progress / ch.target) * 100));
        return {
          id: ch.id,
          title: ch.title,
          progress: ch.progress,
          target: ch.target,
          percentComplete: pct,
          completed: ch.completed
        };
      }
    }
    return null;
  }

  /**
   * updateChallengeProgress(challengeId, progress) — updates progress value.
   */
  function updateChallengeProgress(challengeId, progress) {
    var data = _readJSON(STORAGE_CHALLENGES, []);
    for (var i = 0; i < data.length; i++) {
      if (data[i].id === challengeId) {
        data[i].progress = progress;
        if (progress >= data[i].target) {
          data[i].completed = true;
          data[i].completedAt = _nowFn();
          if (data[i].reward && data[i].reward.xp) {
            addXP(data[i].reward.xp, "Challenge: " + data[i].title);
          }
        }
        _writeJSON(STORAGE_CHALLENGES, data);
        return data[i];
      }
    }
    return null;
  }

  /**
   * resetAll() — clears all gamification data (useful for testing).
   */
  function resetAll() {
    var keys = [STORAGE_ACHIEVEMENTS, STORAGE_STREAKS, STORAGE_XP, STORAGE_LEADERBOARD, STORAGE_CHALLENGES];
    for (var i = 0; i < keys.length; i++) {
      try { localStorage.removeItem(_scopedKey(keys[i])); } catch (_e) { /* noop */ }
    }
  }

  /* ─── Exports ─── */

  exports.ACHIEVEMENTS = ACHIEVEMENTS;
  exports.checkAchievements = checkAchievements;
  exports.getUnlockedAchievements = getUnlockedAchievements;
  exports.getProgress = getProgress;
  exports.recordActivity = recordActivity;
  exports.getCurrentStreak = getCurrentStreak;
  exports.getLongestStreak = getLongestStreak;
  exports.isStreakActive = isStreakActive;
  exports.addXP = addXP;
  exports.getXP = getXP;
  exports.getLevel = getLevel;
  exports.getLevelProgress = getLevelProgress;
  exports.updateLeaderboard = updateLeaderboard;
  exports.getLeaderboard = getLeaderboard;
  exports.getUserRank = getUserRank;
  exports.createChallenge = createChallenge;
  exports.getActiveChallenges = getActiveChallenges;
  exports.completeChallenge = completeChallenge;
  exports.getChallengeProgress = getChallengeProgress;
  exports.updateChallengeProgress = updateChallengeProgress;
  exports.resetAll = resetAll;
  exports._setNowFn = _setNowFn;
  exports._resetNowFn = _resetNowFn;

})(typeof module !== "undefined" ? module.exports : (window.LNVGamification = {}));
