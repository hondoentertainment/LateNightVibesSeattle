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
  CHALLENGE_POOL,
  getActiveChallenges,
  getChallengeProgress,
  checkChallengeCompletion,
  claimChallengeReward,
  getCompletedChallenges,
  getWeeklyChallenges,
  getChallengeLeaderboard,
  getAllChallengeDefinitions,
  updateLeaderboard,
  updateProgress,
  getTimeRemaining,
  resetAll,
  _setNowFn,
  _resetNowFn,
  _getWeekNumber,
  _getWeekBounds,
  _selectWeeklyChallenges,
} from "../lib/night-challenges.js";

beforeEach(() => {
  clearStore();
  _resetNowFn();
});

afterEach(() => {
  clearStore();
  _resetNowFn();
});

/* ─── Challenge Definitions ─── */

describe("Challenge definitions", () => {
  it("has at least 15 challenges in the pool", () => {
    expect(CHALLENGE_POOL.length).toBeGreaterThanOrEqual(15);
  });

  it("every challenge has required fields", () => {
    for (const ch of CHALLENGE_POOL) {
      expect(ch).toHaveProperty("id");
      expect(ch).toHaveProperty("title");
      expect(ch).toHaveProperty("description");
      expect(ch).toHaveProperty("type");
      expect(ch).toHaveProperty("criteria");
      expect(ch).toHaveProperty("xpReward");
      expect(typeof ch.id).toBe("string");
      expect(typeof ch.title).toBe("string");
      expect(typeof ch.description).toBe("string");
      expect(typeof ch.type).toBe("string");
      expect(typeof ch.xpReward).toBe("number");
      expect(ch.xpReward).toBeGreaterThan(0);
    }
  });

  it("all challenge IDs are unique", () => {
    const ids = CHALLENGE_POOL.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has all five challenge types", () => {
    const types = new Set(CHALLENGE_POOL.map((c) => c.type));
    expect(types).toContain("exploration");
    expect(types).toContain("discovery");
    expect(types).toContain("social");
    expect(types).toContain("streak");
    expect(types).toContain("vibe");
  });

  it("getAllChallengeDefinitions returns a copy of the pool", () => {
    const defs = getAllChallengeDefinitions();
    expect(defs.length).toBe(CHALLENGE_POOL.length);
    expect(defs).not.toBe(CHALLENGE_POOL); // different reference
    expect(defs[0].id).toBe(CHALLENGE_POOL[0].id);
  });
});

/* ─── Week Number & Bounds ─── */

describe("Week number calculation", () => {
  it("returns a number between 1 and 53", () => {
    const w = _getWeekNumber(Date.now());
    expect(w).toBeGreaterThanOrEqual(1);
    expect(w).toBeLessThanOrEqual(53);
  });

  it("same day returns same week number", () => {
    const ts = new Date("2026-03-18T12:00:00").getTime();
    expect(_getWeekNumber(ts)).toBe(_getWeekNumber(ts));
  });

  it("consecutive days in same week return same week number", () => {
    const mon = new Date("2026-03-16T12:00:00").getTime(); // Monday
    const wed = new Date("2026-03-18T12:00:00").getTime(); // Wednesday
    const sun = new Date("2026-03-22T12:00:00").getTime(); // Sunday
    expect(_getWeekNumber(mon)).toBe(_getWeekNumber(wed));
    expect(_getWeekNumber(mon)).toBe(_getWeekNumber(sun));
  });

  it("different weeks return different week numbers", () => {
    const week1 = new Date("2026-03-16T12:00:00").getTime();
    const week2 = new Date("2026-03-23T12:00:00").getTime();
    expect(_getWeekNumber(week1)).not.toBe(_getWeekNumber(week2));
  });
});

describe("Week bounds", () => {
  it("start is before end", () => {
    const bounds = _getWeekBounds(Date.now());
    expect(bounds.start).toBeLessThan(bounds.end);
  });

  it("bounds span approximately 7 days", () => {
    const bounds = _getWeekBounds(Date.now());
    const diff = bounds.end - bounds.start;
    const days = diff / 86400000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
  });

  it("current time falls within bounds", () => {
    const now = Date.now();
    const bounds = _getWeekBounds(now);
    expect(now).toBeGreaterThanOrEqual(bounds.start);
    expect(now).toBeLessThanOrEqual(bounds.end);
  });
});

/* ─── Weekly Rotation (Determinism) ─── */

describe("Weekly rotation determinism", () => {
  it("selects the requested number of challenges", () => {
    const selected = _selectWeeklyChallenges(12, 2026, 5);
    expect(selected.length).toBe(5);
  });

  it("same week + year always produces same challenges", () => {
    const a = _selectWeeklyChallenges(12, 2026, 5);
    const b = _selectWeeklyChallenges(12, 2026, 5);
    const aIds = a.map((c) => c.id);
    const bIds = b.map((c) => c.id);
    expect(aIds).toEqual(bIds);
  });

  it("different weeks produce different challenge sets", () => {
    const a = _selectWeeklyChallenges(12, 2026, 5);
    const b = _selectWeeklyChallenges(13, 2026, 5);
    const aIds = a.map((c) => c.id).sort();
    const bIds = b.map((c) => c.id).sort();
    // They could theoretically be the same, but with 18 challenges and
    // different seeds, overlap of all 5 is extremely unlikely
    expect(aIds).not.toEqual(bIds);
  });

  it("enforces type diversity (max 2 per type)", () => {
    const selected = _selectWeeklyChallenges(12, 2026, 5);
    const typeCounts = {};
    for (const ch of selected) {
      typeCounts[ch.type] = (typeCounts[ch.type] || 0) + 1;
    }
    for (const type in typeCounts) {
      expect(typeCounts[type]).toBeLessThanOrEqual(2);
    }
  });

  it("all selected challenges are valid pool entries", () => {
    const selected = _selectWeeklyChallenges(12, 2026, 5);
    const poolIds = new Set(CHALLENGE_POOL.map((c) => c.id));
    for (const ch of selected) {
      expect(poolIds).toContain(ch.id);
    }
  });
});

/* ─── Active Challenges ─── */

describe("getActiveChallenges", () => {
  it("returns weekly challenges on first call", () => {
    const active = getActiveChallenges();
    expect(active.length).toBeGreaterThan(0);
    expect(active.length).toBeLessThanOrEqual(5);
  });

  it("each active challenge has required fields", () => {
    const active = getActiveChallenges();
    for (const ch of active) {
      expect(ch).toHaveProperty("id");
      expect(ch).toHaveProperty("title");
      expect(ch).toHaveProperty("description");
      expect(ch).toHaveProperty("type");
      expect(ch).toHaveProperty("criteria");
      expect(ch).toHaveProperty("xpReward");
      expect(ch).toHaveProperty("startDate");
      expect(ch).toHaveProperty("endDate");
      expect(ch).toHaveProperty("progress");
      expect(ch).toHaveProperty("target");
      expect(ch).toHaveProperty("completed");
      expect(ch).toHaveProperty("claimed");
      expect(ch.completed).toBe(false);
      expect(ch.claimed).toBe(false);
    }
  });

  it("returns same challenges within the same week", () => {
    const a = getActiveChallenges();
    const b = getActiveChallenges();
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
  });

  it("excludes completed challenges", () => {
    const active = getActiveChallenges();
    const firstId = active[0].id;
    updateProgress(firstId, active[0].target);
    const afterComplete = getActiveChallenges();
    const ids = afterComplete.map((c) => c.id);
    expect(ids).not.toContain(firstId);
  });
});

/* ─── getWeeklyChallenges ─── */

describe("getWeeklyChallenges", () => {
  it("returns all challenges for the week including completed", () => {
    const weekly = getWeeklyChallenges();
    expect(weekly.length).toBe(5);

    // Complete one
    const firstId = weekly[0].id;
    updateProgress(firstId, weekly[0].target);

    const weeklyAfter = getWeeklyChallenges();
    expect(weeklyAfter.length).toBe(5);
    const completed = weeklyAfter.find((c) => c.id === firstId);
    expect(completed.completed).toBe(true);
  });
});

/* ─── Progress Tracking ─── */

describe("Progress tracking", () => {
  it("getChallengeProgress returns progress info", () => {
    const active = getActiveChallenges();
    const progress = getChallengeProgress(active[0].id);
    expect(progress).not.toBeNull();
    expect(progress).toHaveProperty("id");
    expect(progress).toHaveProperty("title");
    expect(progress).toHaveProperty("progress");
    expect(progress).toHaveProperty("target");
    expect(progress).toHaveProperty("percentComplete");
    expect(progress).toHaveProperty("completed");
    expect(progress).toHaveProperty("claimed");
  });

  it("returns null for unknown challenge ID", () => {
    expect(getChallengeProgress("nonexistent-id")).toBeNull();
  });

  it("updateProgress updates challenge progress", () => {
    const active = getActiveChallenges();
    const ch = active[0];
    updateProgress(ch.id, 2);
    const progress = getChallengeProgress(ch.id);
    expect(progress.progress).toBe(2);
  });

  it("updateProgress returns null for unknown ID", () => {
    expect(updateProgress("nonexistent", 5)).toBeNull();
  });

  it("progress percentage is calculated correctly", () => {
    const active = getActiveChallenges();
    const ch = active[0];
    const half = Math.floor(ch.target / 2);
    updateProgress(ch.id, half);
    const progress = getChallengeProgress(ch.id);
    const expectedPct = Math.min(100, Math.round((half / ch.target) * 100));
    expect(progress.percentComplete).toBe(expectedPct);
  });

  it("progress percentage caps at 100", () => {
    const active = getActiveChallenges();
    const ch = active[0];
    updateProgress(ch.id, ch.target + 10);
    const progress = getChallengeProgress(ch.id);
    expect(progress.percentComplete).toBe(100);
  });
});

/* ─── Completion Detection ─── */

describe("Completion detection", () => {
  it("checkChallengeCompletion returns false when not complete", () => {
    const active = getActiveChallenges();
    const result = checkChallengeCompletion(active[0].id);
    expect(result).toBe(false);
  });

  it("checkChallengeCompletion returns false for unknown ID", () => {
    expect(checkChallengeCompletion("nonexistent")).toBe(false);
  });

  it("updateProgress auto-completes at target", () => {
    const active = getActiveChallenges();
    const ch = active[0];
    updateProgress(ch.id, ch.target);
    const progress = getChallengeProgress(ch.id);
    expect(progress.completed).toBe(true);
  });

  it("checkChallengeCompletion returns false for already completed", () => {
    const active = getActiveChallenges();
    const ch = active[0];
    updateProgress(ch.id, ch.target);
    const result = checkChallengeCompletion(ch.id);
    expect(result).toBe(false); // already completed
  });
});

/* ─── Reward Claiming ─── */

describe("Reward claiming", () => {
  it("claimChallengeReward returns null for incomplete challenge", () => {
    const active = getActiveChallenges();
    expect(claimChallengeReward(active[0].id)).toBeNull();
  });

  it("claimChallengeReward returns null for unknown ID", () => {
    expect(claimChallengeReward("nonexistent")).toBeNull();
  });

  it("claimChallengeReward works for completed challenge", () => {
    const active = getActiveChallenges();
    const ch = active[0];
    updateProgress(ch.id, ch.target);
    const result = claimChallengeReward(ch.id);
    expect(result).not.toBeNull();
    expect(result.xpAwarded).toBe(ch.xpReward);
    expect(result.challenge.claimed).toBe(true);
  });

  it("prevents double-claiming", () => {
    const active = getActiveChallenges();
    const ch = active[0];
    updateProgress(ch.id, ch.target);
    const first = claimChallengeReward(ch.id);
    expect(first).not.toBeNull();
    const second = claimChallengeReward(ch.id);
    expect(second).toBeNull();
  });

  it("claimed challenge shows as claimed in progress", () => {
    const active = getActiveChallenges();
    const ch = active[0];
    updateProgress(ch.id, ch.target);
    claimChallengeReward(ch.id);
    const progress = getChallengeProgress(ch.id);
    expect(progress.claimed).toBe(true);
  });
});

/* ─── Completed Challenges ─── */

describe("getCompletedChallenges", () => {
  it("returns empty array initially", () => {
    // Need to call getActiveChallenges first to init
    getActiveChallenges();
    const completed = getCompletedChallenges();
    expect(completed).toEqual([]);
  });

  it("includes completed challenges", () => {
    const active = getActiveChallenges();
    const ch = active[0];
    updateProgress(ch.id, ch.target);
    const completed = getCompletedChallenges();
    expect(completed.length).toBe(1);
    expect(completed[0].id).toBe(ch.id);
  });

  it("includes multiple completed challenges", () => {
    const active = getActiveChallenges();
    updateProgress(active[0].id, active[0].target);
    updateProgress(active[1].id, active[1].target);
    const completed = getCompletedChallenges();
    expect(completed.length).toBe(2);
  });
});

/* ─── Leaderboard ─── */

describe("Challenge leaderboard", () => {
  it("starts empty", () => {
    getActiveChallenges(); // init state
    expect(getChallengeLeaderboard()).toEqual([]);
  });

  it("adds entries", () => {
    getActiveChallenges();
    updateLeaderboard("alice", 500);
    const board = getChallengeLeaderboard();
    expect(board.length).toBe(1);
    expect(board[0].username).toBe("alice");
    expect(board[0].score).toBe(500);
  });

  it("sorts by score descending", () => {
    getActiveChallenges();
    updateLeaderboard("alice", 300);
    updateLeaderboard("bob", 800);
    updateLeaderboard("carol", 500);
    const board = getChallengeLeaderboard();
    expect(board[0].username).toBe("bob");
    expect(board[1].username).toBe("carol");
    expect(board[2].username).toBe("alice");
  });

  it("updates existing entry", () => {
    getActiveChallenges();
    updateLeaderboard("alice", 300);
    updateLeaderboard("alice", 900);
    const board = getChallengeLeaderboard();
    expect(board.length).toBe(1);
    expect(board[0].score).toBe(900);
  });

  it("returns null for empty username", () => {
    getActiveChallenges();
    expect(updateLeaderboard(null, 100)).toBeNull();
    expect(updateLeaderboard("", 100)).toBeNull();
  });
});

/* ─── Time Remaining ─── */

describe("getTimeRemaining", () => {
  it("returns a positive number", () => {
    getActiveChallenges();
    const remaining = getTimeRemaining();
    expect(remaining).toBeGreaterThanOrEqual(0);
  });

  it("decreases as time passes", () => {
    const now = new Date("2026-03-18T12:00:00").getTime();
    _setNowFn(() => now);
    getActiveChallenges();
    const r1 = getTimeRemaining();

    _setNowFn(() => now + 3600000); // +1 hour
    const r2 = getTimeRemaining();
    expect(r2).toBeLessThan(r1);
  });

  it("returns 0 when at exact end of week", () => {
    const now = new Date("2026-03-18T12:00:00").getTime();
    _setNowFn(() => now);
    const active = getActiveChallenges();
    const endDate = active[0].endDate;

    // Set time to the exact end of the week
    _setNowFn(() => endDate);
    const remaining = getTimeRemaining();
    expect(remaining).toBe(0);
  });
});

/* ─── Week Rotation ─── */

describe("Week change rotation", () => {
  it("generates new challenges when week changes", () => {
    // Week 1
    const week1Start = new Date("2026-03-16T12:00:00").getTime(); // Monday
    _setNowFn(() => week1Start);
    const week1Challenges = getActiveChallenges();
    const week1Ids = week1Challenges.map((c) => c.id);

    // Clear and advance to next week
    clearStore();
    const week2Start = new Date("2026-03-23T12:00:00").getTime(); // Next Monday
    _setNowFn(() => week2Start);
    const week2Challenges = getActiveChallenges();
    const week2Ids = week2Challenges.map((c) => c.id);

    // Different weeks should have different challenges
    expect(week1Ids.sort()).not.toEqual(week2Ids.sort());
  });

  it("archives old challenges when week changes", () => {
    // Start in week 1
    const week1Start = new Date("2026-03-16T12:00:00").getTime();
    _setNowFn(() => week1Start);
    const week1Active = getActiveChallenges();
    expect(week1Active.length).toBe(5);

    // Complete one challenge
    updateProgress(week1Active[0].id, week1Active[0].target);

    // Move to next week
    const week2Start = new Date("2026-03-23T12:00:00").getTime();
    _setNowFn(() => week2Start);

    // Old challenges should be archived
    const completed = getCompletedChallenges();
    // The completed challenge from week 1 should appear in history
    const week1Completed = completed.filter((c) => c.weekKey && c.weekKey.indexOf("W12") !== -1);
    expect(week1Completed.length).toBeGreaterThanOrEqual(1);
  });
});

/* ─── Edge Cases ─── */

describe("Edge cases", () => {
  it("resetAll clears all challenge data", () => {
    getActiveChallenges();
    updateLeaderboard("alice", 500);
    resetAll();
    // After reset, should generate fresh challenges
    const active = getActiveChallenges();
    expect(active.length).toBe(5);
    expect(getChallengeLeaderboard()).toEqual([]);
  });

  it("handles rapid successive calls", () => {
    for (let i = 0; i < 10; i++) {
      getActiveChallenges();
    }
    const active = getActiveChallenges();
    expect(active.length).toBeLessThanOrEqual(5);
  });

  it("challenge target is always > 0", () => {
    const active = getActiveChallenges();
    for (const ch of active) {
      expect(ch.target).toBeGreaterThan(0);
    }
  });

  it("start date is before end date for all challenges", () => {
    const active = getActiveChallenges();
    for (const ch of active) {
      expect(ch.startDate).toBeLessThan(ch.endDate);
    }
  });

  it("all active challenges belong to current week", () => {
    const active = getActiveChallenges();
    const now = Date.now();
    for (const ch of active) {
      expect(ch.startDate).toBeLessThanOrEqual(now);
      expect(ch.endDate).toBeGreaterThanOrEqual(now);
    }
  });

  it("completing all challenges leaves none active", () => {
    const active = getActiveChallenges();
    for (const ch of active) {
      updateProgress(ch.id, ch.target);
    }
    expect(getActiveChallenges().length).toBe(0);
    expect(getCompletedChallenges().length).toBe(5);
  });

  it("claiming all rewards works without error", () => {
    const active = getActiveChallenges();
    for (const ch of active) {
      updateProgress(ch.id, ch.target);
      const result = claimChallengeReward(ch.id);
      expect(result).not.toBeNull();
      expect(result.xpAwarded).toBeGreaterThan(0);
    }
    // Double-claim should all return null
    const weekly = getWeeklyChallenges();
    for (const ch of weekly) {
      expect(claimChallengeReward(ch.id)).toBeNull();
    }
  });
});
