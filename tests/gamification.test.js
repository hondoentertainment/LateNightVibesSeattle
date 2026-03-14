import { describe, it, expect, beforeEach, afterEach } from "vitest";

const store = {};
const mockLocalStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
if (typeof globalThis !== "undefined") globalThis.localStorage = mockLocalStorage;

function clearStore() {
  for (const key in store) {
    delete store[key];
  }
}

import {
  ACHIEVEMENTS,
  checkAchievements,
  getUnlockedAchievements,
  getProgress,
  recordActivity,
  getCurrentStreak,
  getLongestStreak,
  isStreakActive,
  addXP,
  getXP,
  getLevel,
  getLevelProgress,
  updateLeaderboard,
  getLeaderboard,
  getUserRank,
  createChallenge,
  getActiveChallenges,
  completeChallenge,
  getChallengeProgress,
  updateChallengeProgress,
  resetAll,
  _setNowFn,
  _resetNowFn,
} from "../lib/gamification.js";

beforeEach(() => {
  clearStore();
  _resetNowFn();
});

afterEach(() => {
  clearStore();
  _resetNowFn();
});

/* ─── Achievement Definitions ─── */

describe("Achievement definitions", () => {
  it("has at least 18 achievements", () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(18);
  });

  it("every achievement has required fields", () => {
    for (const ach of ACHIEVEMENTS) {
      expect(ach).toHaveProperty("id");
      expect(ach).toHaveProperty("name");
      expect(ach).toHaveProperty("description");
      expect(ach).toHaveProperty("icon");
      expect(ach).toHaveProperty("category");
      expect(ach).toHaveProperty("threshold");
      expect(typeof ach.id).toBe("string");
      expect(typeof ach.name).toBe("string");
      expect(typeof ach.icon).toBe("string");
      expect(typeof ach.threshold).toBe("number");
    }
  });

  it("every achievement has a valid category", () => {
    const validCategories = ["exploration", "social", "streak", "mastery"];
    for (const ach of ACHIEVEMENTS) {
      expect(validCategories).toContain(ach.category);
    }
  });

  it("all achievement IDs are unique", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("contains first-crawl achievement", () => {
    expect(ACHIEVEMENTS.find((a) => a.id === "first-crawl")).toBeTruthy();
  });

  it("contains all explorer achievements", () => {
    expect(ACHIEVEMENTS.find((a) => a.id === "explorer-5")).toBeTruthy();
    expect(ACHIEVEMENTS.find((a) => a.id === "explorer-10")).toBeTruthy();
    expect(ACHIEVEMENTS.find((a) => a.id === "explorer-25")).toBeTruthy();
    expect(ACHIEVEMENTS.find((a) => a.id === "explorer-50")).toBeTruthy();
  });

  it("contains night-owl and early-bird", () => {
    expect(ACHIEVEMENTS.find((a) => a.id === "night-owl")).toBeTruthy();
    expect(ACHIEVEMENTS.find((a) => a.id === "early-bird")).toBeTruthy();
  });

  it("contains streak achievements with correct thresholds", () => {
    const s3 = ACHIEVEMENTS.find((a) => a.id === "streak-3");
    const s7 = ACHIEVEMENTS.find((a) => a.id === "streak-7");
    const s30 = ACHIEVEMENTS.find((a) => a.id === "streak-30");
    expect(s3.threshold).toBe(3);
    expect(s7.threshold).toBe(7);
    expect(s30.threshold).toBe(30);
  });

  it("contains social achievements", () => {
    expect(ACHIEVEMENTS.find((a) => a.id === "social-butterfly")).toBeTruthy();
    expect(ACHIEVEMENTS.find((a) => a.id === "squad-leader")).toBeTruthy();
  });

  it("contains mastery achievements", () => {
    expect(ACHIEVEMENTS.find((a) => a.id === "vibe-collector")).toBeTruthy();
    expect(ACHIEVEMENTS.find((a) => a.id === "vibe-master")).toBeTruthy();
    expect(ACHIEVEMENTS.find((a) => a.id === "mood-matcher")).toBeTruthy();
    expect(ACHIEVEMENTS.find((a) => a.id === "safety-first")).toBeTruthy();
  });
});

/* ─── Achievement Checking & Unlocking ─── */

describe("Achievement checking", () => {
  it("returns empty array with null stats", () => {
    expect(checkAchievements(null)).toEqual([]);
  });

  it("returns empty array with empty stats", () => {
    expect(checkAchievements({})).toEqual([]);
  });

  it("unlocks first-crawl when venuesVisited >= 1", () => {
    const result = checkAchievements({ venuesVisited: 1 });
    expect(result).toContain("first-crawl");
  });

  it("unlocks multiple exploration achievements at once", () => {
    const result = checkAchievements({ venuesVisited: 10 });
    expect(result).toContain("first-crawl");
    expect(result).toContain("explorer-5");
    expect(result).toContain("explorer-10");
    expect(result).not.toContain("explorer-25");
  });

  it("does not duplicate unlock on second call", () => {
    checkAchievements({ venuesVisited: 1 });
    const result = checkAchievements({ venuesVisited: 1 });
    expect(result).toEqual([]);
  });

  it("unlocks new achievements on subsequent calls with higher stats", () => {
    checkAchievements({ venuesVisited: 1 });
    const result = checkAchievements({ venuesVisited: 5 });
    expect(result).toContain("explorer-5");
    expect(result).not.toContain("first-crawl");
  });

  it("unlocks night-owl achievement", () => {
    const result = checkAchievements({ nightVisits: 1 });
    expect(result).toContain("night-owl");
  });

  it("unlocks neighborhood-hopper at 3 neighborhoods", () => {
    const result = checkAchievements({ neighborhoods: 3 });
    expect(result).toContain("neighborhood-hopper");
    expect(result).not.toContain("city-hopper");
  });

  it("unlocks vibe-collector and vibe-master", () => {
    const r1 = checkAchievements({ vibeTags: 5 });
    expect(r1).toContain("vibe-collector");
    const r2 = checkAchievements({ vibeTags: 10 });
    expect(r2).toContain("vibe-master");
  });

  it("unlocks social achievements", () => {
    const result = checkAchievements({ squadSessions: 3, maxSquadMembers: 5 });
    expect(result).toContain("social-butterfly");
    expect(result).toContain("squad-leader");
  });

  it("unlocks streak achievements", () => {
    const result = checkAchievements({ currentStreak: 7 });
    expect(result).toContain("streak-3");
    expect(result).toContain("streak-7");
    expect(result).not.toContain("streak-30");
  });

  it("unlocks safety-first achievement", () => {
    const result = checkAchievements({ emergencyContacts: 1 });
    expect(result).toContain("safety-first");
  });

  it("unlocks mood-matcher at 10", () => {
    const result = checkAchievements({ moodMatches: 10 });
    expect(result).toContain("mood-matcher");
  });
});

describe("getUnlockedAchievements", () => {
  it("returns empty array initially", () => {
    expect(getUnlockedAchievements()).toEqual([]);
  });

  it("returns unlocked achievement objects after check", () => {
    checkAchievements({ venuesVisited: 1 });
    const unlocked = getUnlockedAchievements();
    expect(unlocked.length).toBe(1);
    expect(unlocked[0].id).toBe("first-crawl");
  });

  it("returns full achievement objects with all fields", () => {
    checkAchievements({ venuesVisited: 1 });
    const ach = getUnlockedAchievements()[0];
    expect(ach).toHaveProperty("id");
    expect(ach).toHaveProperty("name");
    expect(ach).toHaveProperty("description");
    expect(ach).toHaveProperty("icon");
    expect(ach).toHaveProperty("category");
    expect(ach).toHaveProperty("threshold");
  });
});

describe("getProgress", () => {
  it("returns null for unknown achievement", () => {
    expect(getProgress("nonexistent", {})).toBeNull();
  });

  it("returns 0 progress with empty stats", () => {
    const p = getProgress("first-crawl", {});
    expect(p.current).toBe(0);
    expect(p.target).toBe(1);
    expect(p.percentComplete).toBe(0);
  });

  it("returns correct progress for partial completion", () => {
    const p = getProgress("explorer-10", { venuesVisited: 7 });
    expect(p.current).toBe(7);
    expect(p.target).toBe(10);
    expect(p.percentComplete).toBe(70);
  });

  it("caps percent at 100", () => {
    const p = getProgress("first-crawl", { venuesVisited: 5 });
    expect(p.percentComplete).toBe(100);
  });

  it("returns 0 current when stats not provided", () => {
    const p = getProgress("first-crawl");
    expect(p.current).toBe(0);
  });
});

/* ─── Streak System ─── */

describe("Streak system", () => {
  it("returns 0 streak initially", () => {
    expect(getCurrentStreak()).toBe(0);
  });

  it("isStreakActive returns false initially", () => {
    expect(isStreakActive()).toBe(false);
  });

  it("records activity and streak becomes 1", () => {
    recordActivity("visit");
    expect(getCurrentStreak()).toBe(1);
  });

  it("isStreakActive returns true after recording", () => {
    recordActivity("visit");
    expect(isStreakActive()).toBe(true);
  });

  it("does not double-count same day same type", () => {
    recordActivity("visit");
    recordActivity("visit");
    expect(getCurrentStreak()).toBe(1);
  });

  it("builds consecutive day streak", () => {
    const day1 = new Date("2026-03-10T12:00:00").getTime();
    const day2 = new Date("2026-03-11T12:00:00").getTime();
    const day3 = new Date("2026-03-12T12:00:00").getTime();

    _setNowFn(() => day1);
    recordActivity("visit");
    _setNowFn(() => day2);
    recordActivity("visit");
    _setNowFn(() => day3);
    recordActivity("visit");

    expect(getCurrentStreak()).toBe(3);
  });

  it("breaks streak when day is skipped", () => {
    const day1 = new Date("2026-03-10T12:00:00").getTime();
    const day2 = new Date("2026-03-11T12:00:00").getTime();
    // skip day 3
    const day4 = new Date("2026-03-13T12:00:00").getTime();

    _setNowFn(() => day1);
    recordActivity("visit");
    _setNowFn(() => day2);
    recordActivity("visit");
    _setNowFn(() => day4);
    recordActivity("visit");

    expect(getCurrentStreak()).toBe(1);
  });

  it("getLongestStreak tracks the best streak", () => {
    const day1 = new Date("2026-03-08T12:00:00").getTime();
    const day2 = new Date("2026-03-09T12:00:00").getTime();
    const day3 = new Date("2026-03-10T12:00:00").getTime();
    // gap
    const day5 = new Date("2026-03-12T12:00:00").getTime();

    _setNowFn(() => day1);
    recordActivity("visit");
    _setNowFn(() => day2);
    recordActivity("visit");
    _setNowFn(() => day3);
    recordActivity("visit");
    // streak was 3 here
    _setNowFn(() => day5);
    recordActivity("visit");
    // current streak is 1

    expect(getCurrentStreak()).toBe(1);
    expect(getLongestStreak()).toBe(3);
  });

  it("streak includes yesterday even if no activity today", () => {
    const yesterday = new Date("2026-03-13T12:00:00").getTime();
    const today = new Date("2026-03-14T12:00:00").getTime();

    _setNowFn(() => yesterday);
    recordActivity("visit");
    _setNowFn(() => today);

    // Yesterday counts as current streak of 1 (since gap to today <= 1 day)
    expect(getCurrentStreak()).toBe(1);
    expect(isStreakActive()).toBe(false);
  });

  it("streak is 0 if last activity was 2+ days ago", () => {
    const twoDaysAgo = new Date("2026-03-12T12:00:00").getTime();
    const today = new Date("2026-03-14T12:00:00").getTime();

    _setNowFn(() => twoDaysAgo);
    recordActivity("visit");
    _setNowFn(() => today);

    expect(getCurrentStreak()).toBe(0);
  });

  it("records different activity types on same day", () => {
    recordActivity("visit");
    recordActivity("explore");
    // Both recorded, but still same day
    expect(getCurrentStreak()).toBe(1);
  });
});

/* ─── XP & Levels ─── */

describe("XP system", () => {
  it("starts at 0 XP", () => {
    expect(getXP()).toBe(0);
  });

  it("addXP increases total", () => {
    addXP(50, "test");
    expect(getXP()).toBe(50);
  });

  it("addXP accumulates", () => {
    addXP(50, "test1");
    addXP(75, "test2");
    expect(getXP()).toBe(125);
  });

  it("addXP returns result object", () => {
    const result = addXP(100, "reason");
    expect(result).toEqual({ total: 100, added: 100 });
  });

  it("addXP returns null for invalid amount", () => {
    expect(addXP(0, "test")).toBeNull();
    expect(addXP(-5, "test")).toBeNull();
    expect(addXP(null, "test")).toBeNull();
  });

  it("getLevel starts at 0", () => {
    expect(getLevel()).toBe(0);
  });

  it("getLevel returns 1 at 100 XP", () => {
    addXP(100, "test");
    expect(getLevel()).toBe(1);
  });

  it("getLevel returns 1 at 199 XP (not yet level 2)", () => {
    addXP(199, "test");
    expect(getLevel()).toBe(1);
  });

  it("getLevel returns 2 at 300 XP (100 + 200)", () => {
    addXP(300, "test");
    expect(getLevel()).toBe(2);
  });

  it("getLevel returns 3 at 600 XP (100 + 200 + 300)", () => {
    addXP(600, "test");
    expect(getLevel()).toBe(3);
  });

  it("getLevelProgress returns correct structure", () => {
    addXP(150, "test");
    const p = getLevelProgress();
    expect(p).toHaveProperty("level");
    expect(p).toHaveProperty("currentXP");
    expect(p).toHaveProperty("xpForNextLevel");
    expect(p).toHaveProperty("percentComplete");
  });

  it("getLevelProgress shows progress within level", () => {
    addXP(150, "test"); // level 1, 50 XP into level 2 (needs 200)
    const p = getLevelProgress();
    expect(p.level).toBe(1);
    expect(p.currentXP).toBe(50);
    expect(p.xpForNextLevel).toBe(200);
    expect(p.percentComplete).toBe(25);
  });

  it("getLevelProgress at 0 XP", () => {
    const p = getLevelProgress();
    expect(p.level).toBe(0);
    expect(p.currentXP).toBe(0);
    expect(p.xpForNextLevel).toBe(100);
    expect(p.percentComplete).toBe(0);
  });
});

/* ─── Leaderboard ─── */

describe("Leaderboard", () => {
  it("starts empty", () => {
    expect(getLeaderboard()).toEqual([]);
  });

  it("adds an entry", () => {
    updateLeaderboard("alice", 500, "seattle");
    const board = getLeaderboard();
    expect(board.length).toBe(1);
    expect(board[0].username).toBe("alice");
    expect(board[0].score).toBe(500);
  });

  it("sorts by score descending", () => {
    updateLeaderboard("alice", 500, "seattle");
    updateLeaderboard("bob", 800, "seattle");
    updateLeaderboard("carol", 300, "seattle");
    const board = getLeaderboard();
    expect(board[0].username).toBe("bob");
    expect(board[1].username).toBe("alice");
    expect(board[2].username).toBe("carol");
  });

  it("updates existing entry score", () => {
    updateLeaderboard("alice", 500, "seattle");
    updateLeaderboard("alice", 900, "seattle");
    const board = getLeaderboard();
    expect(board.length).toBe(1);
    expect(board[0].score).toBe(900);
  });

  it("filters by city", () => {
    updateLeaderboard("alice", 500, "seattle");
    updateLeaderboard("bob", 800, "portland");
    const seattle = getLeaderboard("seattle");
    expect(seattle.length).toBe(1);
    expect(seattle[0].username).toBe("alice");
  });

  it("respects limit parameter", () => {
    updateLeaderboard("alice", 500, "seattle");
    updateLeaderboard("bob", 800, "seattle");
    updateLeaderboard("carol", 300, "seattle");
    const top2 = getLeaderboard(null, 2);
    expect(top2.length).toBe(2);
  });

  it("getUserRank returns correct rank", () => {
    updateLeaderboard("alice", 500, "seattle");
    updateLeaderboard("bob", 800, "seattle");
    updateLeaderboard("carol", 300, "seattle");
    expect(getUserRank("bob")).toBe(1);
    expect(getUserRank("alice")).toBe(2);
    expect(getUserRank("carol")).toBe(3);
  });

  it("getUserRank returns null for unknown user", () => {
    expect(getUserRank("nobody")).toBeNull();
  });

  it("getUserRank filters by city", () => {
    updateLeaderboard("alice", 500, "seattle");
    updateLeaderboard("bob", 800, "portland");
    expect(getUserRank("alice", "seattle")).toBe(1);
    expect(getUserRank("bob", "seattle")).toBeNull();
  });

  it("returns null when updating with no username", () => {
    expect(updateLeaderboard(null, 100, "seattle")).toBeNull();
    expect(updateLeaderboard("", 100, "seattle")).toBeNull();
  });

  it("uses default city when none specified", () => {
    updateLeaderboard("alice", 100);
    const board = getLeaderboard("default");
    expect(board.length).toBe(1);
  });
});

/* ─── Challenges ─── */

describe("Challenges", () => {
  it("returns null for invalid challenge data", () => {
    expect(createChallenge(null)).toBeNull();
    expect(createChallenge({})).toBeNull();
  });

  it("creates a challenge with correct fields", () => {
    const ch = createChallenge({
      title: "Visit 5 bars",
      description: "Explore the nightlife",
      type: "visit",
      target: 5,
      expiresAt: "2026-04-01T00:00:00Z",
      reward: { xp: 200, badge: "bar-hopper" },
    });
    expect(ch).toBeTruthy();
    expect(ch.id).toBeTruthy();
    expect(ch.title).toBe("Visit 5 bars");
    expect(ch.type).toBe("visit");
    expect(ch.target).toBe(5);
    expect(ch.progress).toBe(0);
    expect(ch.completed).toBe(false);
    expect(ch.reward.xp).toBe(200);
    expect(ch.reward.badge).toBe("bar-hopper");
  });

  it("getActiveChallenges returns non-completed challenges", () => {
    createChallenge({ title: "Test", target: 5 });
    const active = getActiveChallenges();
    expect(active.length).toBe(1);
  });

  it("getActiveChallenges excludes completed challenges", () => {
    const ch = createChallenge({ title: "Test", target: 5 });
    completeChallenge(ch.id);
    const active = getActiveChallenges();
    expect(active.length).toBe(0);
  });

  it("getActiveChallenges excludes expired challenges", () => {
    createChallenge({
      title: "Expired",
      target: 5,
      expiresAt: "2020-01-01T00:00:00Z",
    });
    const active = getActiveChallenges();
    expect(active.length).toBe(0);
  });

  it("getActiveChallenges includes non-expired challenges", () => {
    createChallenge({
      title: "Future",
      target: 5,
      expiresAt: "2030-01-01T00:00:00Z",
    });
    const active = getActiveChallenges();
    expect(active.length).toBe(1);
  });

  it("completeChallenge marks as completed", () => {
    const ch = createChallenge({ title: "Test", target: 5 });
    const result = completeChallenge(ch.id);
    expect(result.completed).toBe(true);
    expect(result.completedAt).toBeTruthy();
  });

  it("completeChallenge awards XP", () => {
    const ch = createChallenge({ title: "Test", target: 5, reward: { xp: 100 } });
    completeChallenge(ch.id);
    expect(getXP()).toBe(100);
  });

  it("completeChallenge returns null for unknown ID", () => {
    expect(completeChallenge("nonexistent")).toBeNull();
  });

  it("getChallengeProgress returns correct info", () => {
    const ch = createChallenge({ title: "Test", target: 10 });
    const progress = getChallengeProgress(ch.id);
    expect(progress.progress).toBe(0);
    expect(progress.target).toBe(10);
    expect(progress.percentComplete).toBe(0);
    expect(progress.completed).toBe(false);
  });

  it("getChallengeProgress returns null for unknown ID", () => {
    expect(getChallengeProgress("nonexistent")).toBeNull();
  });

  it("updateChallengeProgress updates progress", () => {
    const ch = createChallenge({ title: "Test", target: 10 });
    updateChallengeProgress(ch.id, 5);
    const p = getChallengeProgress(ch.id);
    expect(p.progress).toBe(5);
    expect(p.percentComplete).toBe(50);
  });

  it("updateChallengeProgress auto-completes at target", () => {
    const ch = createChallenge({ title: "Test", target: 5, reward: { xp: 50 } });
    updateChallengeProgress(ch.id, 5);
    const p = getChallengeProgress(ch.id);
    expect(p.completed).toBe(true);
    expect(getXP()).toBe(50);
  });

  it("updateChallengeProgress returns null for unknown ID", () => {
    expect(updateChallengeProgress("nonexistent", 5)).toBeNull();
  });

  it("creates multiple challenges independently", () => {
    const ch1 = createChallenge({ title: "A", target: 5 });
    const ch2 = createChallenge({ title: "B", target: 10 });
    expect(ch1.id).not.toBe(ch2.id);
    expect(getActiveChallenges().length).toBe(2);
  });
});

/* ─── Edge Cases ─── */

describe("Edge cases", () => {
  it("resetAll clears everything", () => {
    addXP(100, "test");
    checkAchievements({ venuesVisited: 1 });
    recordActivity("visit");
    updateLeaderboard("alice", 500, "seattle");
    createChallenge({ title: "Test", target: 5 });

    resetAll();

    expect(getXP()).toBe(0);
    expect(getUnlockedAchievements()).toEqual([]);
    expect(getCurrentStreak()).toBe(0);
    expect(getLeaderboard()).toEqual([]);
    expect(getActiveChallenges()).toEqual([]);
  });

  it("handles massive XP values", () => {
    addXP(1000000, "big");
    expect(getXP()).toBe(1000000);
    expect(getLevel()).toBeGreaterThan(0);
  });

  it("challenge with no expiresAt never expires", () => {
    createChallenge({ title: "Forever", target: 100 });
    const active = getActiveChallenges();
    expect(active.length).toBe(1);
  });

  it("challenge defaults to visit type", () => {
    const ch = createChallenge({ title: "Default" });
    expect(ch.type).toBe("visit");
  });

  it("challenge defaults target to 1", () => {
    const ch = createChallenge({ title: "Default" });
    expect(ch.target).toBe(1);
  });

  it("addXP with empty reason still works", () => {
    const result = addXP(10);
    expect(result.total).toBe(10);
  });

  it("leaderboard handles ties in score", () => {
    updateLeaderboard("alice", 500, "seattle");
    updateLeaderboard("bob", 500, "seattle");
    const board = getLeaderboard();
    expect(board.length).toBe(2);
    // Both have score 500
    expect(board[0].score).toBe(500);
    expect(board[1].score).toBe(500);
  });
});
