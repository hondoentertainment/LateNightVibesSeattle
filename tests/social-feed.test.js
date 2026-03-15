import { describe, it, expect, beforeEach, vi } from "vitest";

const store = {};
const mockLocalStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
if (typeof globalThis !== "undefined") globalThis.localStorage = mockLocalStorage;

import {
  postActivity,
  deleteActivity,
  getFeed,
  getVenueFeed,
  getUserFeed,
  likePost,
  unlikePost,
  commentOnPost,
  getComments,
  getTrendingVenues,
  getTrendingHashtags,
  followUser,
  unfollowUser,
  getFollowing,
  getFollowers,
  getFollowingFeed,
  getNotifications,
  markNotificationRead,
  getUnreadCount,
  reportPost,
  getReportCount,
  isAutoHidden,
  getVisibleFeed,
} from "../lib/social-feed.js";

function clearStore() {
  for (const key in store) { delete store[key]; }
}

describe("LNVSocialFeed", () => {
  beforeEach(() => {
    clearStore();
    vi.restoreAllMocks();
  });

  /* ─── 1. postActivity ─── */
  describe("postActivity", () => {
    it("creates a checkin post with required fields", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "Bar A" });
      expect(post).not.toBeNull();
      expect(post.type).toBe("checkin");
      expect(post.venueName).toBe("Bar A");
      expect(post.userId).toBe("u1");
    });

    it("returns an id and timestamp on created post", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "Bar A" });
      expect(post.id).toBeTruthy();
      expect(typeof post.timestamp).toBe("number");
    });

    it("initializes likes as empty array", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "X" });
      expect(post.likes).toEqual([]);
    });

    it("initializes comments as empty array", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "X" });
      expect(post.comments).toEqual([]);
    });

    it("creates a review post with rating", () => {
      const post = postActivity("u1", { type: "review", venueName: "Club B", rating: 5 });
      expect(post.type).toBe("review");
      expect(post.rating).toBe(5);
    });

    it("creates a recommendation post without venueName", () => {
      const post = postActivity("u1", { type: "recommendation", message: "Try this place!" });
      expect(post).not.toBeNull();
      expect(post.type).toBe("recommendation");
      expect(post.venueName).toBeNull();
    });

    it("creates a photo post with photo field", () => {
      const post = postActivity("u1", { type: "photo", venueName: "Lounge", photo: "img.jpg" });
      expect(post.photo).toBe("img.jpg");
    });

    it("creates a milestone post", () => {
      const post = postActivity("u1", { type: "milestone", message: "100 venues visited!" });
      expect(post.type).toBe("milestone");
    });

    it("returns null for missing userId", () => {
      expect(postActivity(null, { type: "checkin", venueName: "X" })).toBeNull();
    });

    it("returns null for empty userId", () => {
      expect(postActivity("", { type: "checkin", venueName: "X" })).toBeNull();
    });

    it("returns null for missing activity", () => {
      expect(postActivity("u1", null)).toBeNull();
    });

    it("returns null for undefined activity", () => {
      expect(postActivity("u1", undefined)).toBeNull();
    });

    it("returns null for non-object activity", () => {
      expect(postActivity("u1", "string")).toBeNull();
    });

    it("returns null for invalid type", () => {
      expect(postActivity("u1", { type: "invalid", venueName: "X" })).toBeNull();
    });

    it("returns null for missing type", () => {
      expect(postActivity("u1", { venueName: "X" })).toBeNull();
    });

    it("returns null for checkin without venueName", () => {
      expect(postActivity("u1", { type: "checkin" })).toBeNull();
    });

    it("returns null for review without venueName", () => {
      expect(postActivity("u1", { type: "review" })).toBeNull();
    });

    it("returns null for photo without venueName", () => {
      expect(postActivity("u1", { type: "photo" })).toBeNull();
    });

    it("milestone does not require venueName", () => {
      const post = postActivity("u1", { type: "milestone" });
      expect(post).not.toBeNull();
    });

    it("stores optional message", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "X", message: "Great!" });
      expect(post.message).toBe("Great!");
    });

    it("defaults optional fields to null", () => {
      const post = postActivity("u1", { type: "milestone" });
      expect(post.message).toBeNull();
      expect(post.rating).toBeNull();
      expect(post.photo).toBeNull();
      expect(post.venueName).toBeNull();
    });

    it("persists post to storage", () => {
      postActivity("u1", { type: "checkin", venueName: "X" });
      expect(getFeed().length).toBe(1);
    });

    it("generates unique ids for each post", () => {
      const p1 = postActivity("u1", { type: "checkin", venueName: "A" });
      const p2 = postActivity("u1", { type: "checkin", venueName: "B" });
      expect(p1.id).not.toBe(p2.id);
    });
  });

  /* ─── 2. deleteActivity ─── */
  describe("deleteActivity", () => {
    it("deletes an existing post and returns true", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "X" });
      expect(deleteActivity(post.id)).toBe(true);
      expect(getFeed().length).toBe(0);
    });

    it("returns false for non-existent postId", () => {
      expect(deleteActivity("nonexistent")).toBe(false);
    });

    it("returns false for null postId", () => {
      expect(deleteActivity(null)).toBe(false);
    });

    it("returns false for empty string postId", () => {
      expect(deleteActivity("")).toBe(false);
    });

    it("only deletes the targeted post", () => {
      postActivity("u1", { type: "checkin", venueName: "A" });
      const p2 = postActivity("u1", { type: "checkin", venueName: "B" });
      postActivity("u1", { type: "checkin", venueName: "C" });
      deleteActivity(p2.id);
      const feed = getFeed();
      expect(feed.length).toBe(2);
      expect(feed.every(p => p.venueName !== "B")).toBe(true);
    });
  });

  /* ─── 3. getFeed ─── */
  describe("getFeed", () => {
    it("returns empty array when no posts", () => {
      expect(getFeed()).toEqual([]);
    });

    it("returns posts sorted newest first", () => {
      postActivity("u1", { type: "checkin", venueName: "A" });
      // Manually set distinct timestamps
      const key = Object.keys(store).find(k => k.includes("social_feed"));
      const raw = JSON.parse(store[key]);
      raw[0].timestamp = Date.now() - 5000;
      store[key] = JSON.stringify(raw);
      postActivity("u1", { type: "checkin", venueName: "B" });
      const feed = getFeed();
      expect(feed[0].venueName).toBe("B");
      expect(feed[1].venueName).toBe("A");
    });

    it("limits results with limit option", () => {
      for (let i = 0; i < 5; i++) {
        postActivity("u1", { type: "checkin", venueName: "V" + i });
      }
      expect(getFeed({ limit: 3 }).length).toBe(3);
    });

    it("defaults limit to 20", () => {
      for (let i = 0; i < 25; i++) {
        postActivity("u1", { type: "checkin", venueName: "V" + i });
      }
      expect(getFeed().length).toBe(20);
    });

    it("supports offset for pagination", () => {
      for (let i = 0; i < 5; i++) {
        postActivity("u1", { type: "checkin", venueName: "V" + i });
      }
      const page = getFeed({ limit: 2, offset: 2 });
      expect(page.length).toBe(2);
    });

    it("returns empty when offset exceeds available posts", () => {
      postActivity("u1", { type: "checkin", venueName: "A" });
      expect(getFeed({ offset: 100 })).toEqual([]);
    });

    it("filters by type", () => {
      postActivity("u1", { type: "checkin", venueName: "A" });
      postActivity("u1", { type: "review", venueName: "B" });
      const feed = getFeed({ type: "checkin" });
      expect(feed.length).toBe(1);
      expect(feed[0].type).toBe("checkin");
    });

    it("filters by venueName", () => {
      postActivity("u1", { type: "checkin", venueName: "A" });
      postActivity("u1", { type: "checkin", venueName: "B" });
      expect(getFeed({ venueName: "A" }).length).toBe(1);
    });

    it("filters by userId", () => {
      postActivity("u1", { type: "checkin", venueName: "A" });
      postActivity("u2", { type: "checkin", venueName: "B" });
      expect(getFeed({ userId: "u1" }).length).toBe(1);
    });

    it("combines multiple filters", () => {
      postActivity("u1", { type: "checkin", venueName: "A" });
      postActivity("u1", { type: "review", venueName: "A" });
      postActivity("u2", { type: "checkin", venueName: "A" });
      expect(getFeed({ userId: "u1", type: "checkin" }).length).toBe(1);
    });

    it("returns empty for no matching filter", () => {
      postActivity("u1", { type: "checkin", venueName: "A" });
      expect(getFeed({ type: "review" })).toEqual([]);
    });

    it("works with no options argument", () => {
      postActivity("u1", { type: "checkin", venueName: "A" });
      expect(getFeed().length).toBe(1);
    });
  });

  /* ─── getVenueFeed ─── */
  describe("getVenueFeed", () => {
    it("returns posts for a specific venue", () => {
      postActivity("u1", { type: "checkin", venueName: "A" });
      postActivity("u1", { type: "checkin", venueName: "B" });
      expect(getVenueFeed("A").length).toBe(1);
    });

    it("respects limit parameter", () => {
      for (let i = 0; i < 5; i++) {
        postActivity("u1", { type: "checkin", venueName: "A" });
      }
      expect(getVenueFeed("A", 2).length).toBe(2);
    });

    it("defaults limit to 20", () => {
      for (let i = 0; i < 25; i++) {
        postActivity("u" + i, { type: "checkin", venueName: "A" });
      }
      expect(getVenueFeed("A").length).toBe(20);
    });
  });

  /* ─── getUserFeed ─── */
  describe("getUserFeed", () => {
    it("returns posts for a specific user", () => {
      postActivity("u1", { type: "checkin", venueName: "A" });
      postActivity("u2", { type: "checkin", venueName: "B" });
      expect(getUserFeed("u1").length).toBe(1);
    });

    it("respects limit parameter", () => {
      for (let i = 0; i < 5; i++) {
        postActivity("u1", { type: "checkin", venueName: "V" + i });
      }
      expect(getUserFeed("u1", 3).length).toBe(3);
    });
  });

  /* ─── 4. likePost ─── */
  describe("likePost", () => {
    it("likes a post and returns like count", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "A" });
      expect(likePost(post.id, "u2")).toBe(1);
    });

    it("allows multiple users to like", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "A" });
      likePost(post.id, "u2");
      expect(likePost(post.id, "u3")).toBe(2);
    });

    it("prevents duplicate likes from same user", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "A" });
      likePost(post.id, "u2");
      expect(likePost(post.id, "u2")).toBe(1);
    });

    it("returns -1 for non-existent post", () => {
      expect(likePost("fake", "u1")).toBe(-1);
    });

    it("returns -1 for null postId", () => {
      expect(likePost(null, "u1")).toBe(-1);
    });

    it("returns -1 for null userId", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "A" });
      expect(likePost(post.id, null)).toBe(-1);
    });

    it("generates notification for post author on like", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "A" });
      likePost(post.id, "u2");
      const notifs = getNotifications("u1");
      expect(notifs.length).toBe(1);
      expect(notifs[0].type).toBe("like");
    });

    it("does not notify on self-like", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "A" });
      likePost(post.id, "u1");
      expect(getNotifications("u1").length).toBe(0);
    });

    it("persists likes to storage", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "A" });
      likePost(post.id, "u2");
      const feed = getFeed();
      expect(feed[0].likes).toContain("u2");
    });
  });

  /* ─── 5. unlikePost ─── */
  describe("unlikePost", () => {
    it("removes a like and returns updated count", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "A" });
      likePost(post.id, "u2");
      expect(unlikePost(post.id, "u2")).toBe(0);
    });

    it("returns count unchanged if user had not liked", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "A" });
      likePost(post.id, "u2");
      expect(unlikePost(post.id, "u3")).toBe(1);
    });

    it("returns -1 for non-existent post", () => {
      expect(unlikePost("fake", "u1")).toBe(-1);
    });

    it("returns -1 for null postId", () => {
      expect(unlikePost(null, "u1")).toBe(-1);
    });

    it("returns -1 for null userId", () => {
      expect(unlikePost("fake", null)).toBe(-1);
    });
  });

  /* ─── 6. commentOnPost ─── */
  describe("commentOnPost", () => {
    it("adds a comment and returns comment object", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "A" });
      const comment = commentOnPost(post.id, "u2", "Nice!");
      expect(comment).not.toBeNull();
      expect(comment.text).toBe("Nice!");
      expect(comment.userId).toBe("u2");
    });

    it("comment has id and timestamp", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "A" });
      const comment = commentOnPost(post.id, "u2", "Hello");
      expect(comment.id).toBeTruthy();
      expect(typeof comment.timestamp).toBe("number");
    });

    it("returns null for non-existent post", () => {
      expect(commentOnPost("fake", "u1", "text")).toBeNull();
    });

    it("returns null for null postId", () => {
      expect(commentOnPost(null, "u1", "text")).toBeNull();
    });

    it("returns null for null userId", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "A" });
      expect(commentOnPost(post.id, null, "text")).toBeNull();
    });

    it("returns null for empty text", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "A" });
      expect(commentOnPost(post.id, "u1", "")).toBeNull();
    });

    it("returns null for whitespace-only text", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "A" });
      expect(commentOnPost(post.id, "u1", "   ")).toBeNull();
    });

    it("returns null for non-string text", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "A" });
      expect(commentOnPost(post.id, "u1", 123)).toBeNull();
    });

    it("generates notification for post author on comment", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "A" });
      commentOnPost(post.id, "u2", "Cool");
      const notifs = getNotifications("u1");
      expect(notifs.length).toBe(1);
      expect(notifs[0].type).toBe("comment");
    });

    it("does not notify on self-comment", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "A" });
      commentOnPost(post.id, "u1", "My own comment");
      expect(getNotifications("u1").length).toBe(0);
    });

    it("allows multiple comments on a post", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "A" });
      commentOnPost(post.id, "u2", "First");
      commentOnPost(post.id, "u3", "Second");
      expect(getComments(post.id).length).toBe(2);
    });
  });

  /* ─── 7. getComments ─── */
  describe("getComments", () => {
    it("returns comments sorted oldest first", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "A" });
      commentOnPost(post.id, "u2", "First");
      commentOnPost(post.id, "u3", "Second");
      const comments = getComments(post.id);
      expect(comments.length).toBe(2);
      expect(comments[0].text).toBe("First");
      expect(comments[1].text).toBe("Second");
    });

    it("returns empty array for non-existent post", () => {
      expect(getComments("fake")).toEqual([]);
    });

    it("returns empty array for post with no comments", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "A" });
      expect(getComments(post.id)).toEqual([]);
    });
  });

  /* ─── 8. getTrendingVenues ─── */
  describe("getTrendingVenues", () => {
    it("returns empty array when no recent posts", () => {
      expect(getTrendingVenues()).toEqual([]);
    });

    it("returns venues ranked by score (postCount + totalLikes)", () => {
      postActivity("u1", { type: "checkin", venueName: "A" });
      postActivity("u2", { type: "checkin", venueName: "A" });
      postActivity("u3", { type: "checkin", venueName: "B" });
      const trending = getTrendingVenues();
      expect(trending[0].venueName).toBe("A");
      expect(trending[0].postCount).toBe(2);
    });

    it("includes totalLikes in score calculation", () => {
      const p1 = postActivity("u1", { type: "checkin", venueName: "B" });
      postActivity("u2", { type: "checkin", venueName: "A" });
      postActivity("u3", { type: "checkin", venueName: "A" });
      likePost(p1.id, "u2");
      likePost(p1.id, "u3");
      likePost(p1.id, "u4");
      const trending = getTrendingVenues();
      expect(trending[0].venueName).toBe("B");
      expect(trending[0].score).toBe(4);
    });

    it("respects limit parameter", () => {
      postActivity("u1", { type: "checkin", venueName: "A" });
      postActivity("u1", { type: "checkin", venueName: "B" });
      postActivity("u1", { type: "checkin", venueName: "C" });
      expect(getTrendingVenues(4, 2).length).toBe(2);
    });

    it("excludes posts without venueName", () => {
      postActivity("u1", { type: "recommendation", message: "Try it" });
      expect(getTrendingVenues()).toEqual([]);
    });

    it("excludes posts older than the time window", () => {
      postActivity("u1", { type: "checkin", venueName: "A" });
      const key = Object.keys(store).find(k => k.includes("social_feed"));
      const raw = JSON.parse(store[key]);
      raw[0].timestamp = Date.now() - 5 * 60 * 60 * 1000;
      store[key] = JSON.stringify(raw);
      expect(getTrendingVenues(4)).toEqual([]);
    });

    it("defaults to 4-hour window and limit 10", () => {
      for (let i = 0; i < 12; i++) {
        postActivity("u1", { type: "checkin", venueName: "V" + i });
      }
      expect(getTrendingVenues().length).toBe(10);
    });
  });

  /* ─── 9. getTrendingHashtags ─── */
  describe("getTrendingHashtags", () => {
    it("returns empty array when no hashtags exist", () => {
      postActivity("u1", { type: "checkin", venueName: "A", message: "no tags" });
      expect(getTrendingHashtags()).toEqual([]);
    });

    it("extracts hashtags from messages", () => {
      postActivity("u1", { type: "recommendation", message: "Great #nightlife #seattle" });
      const tags = getTrendingHashtags();
      expect(tags.length).toBe(2);
    });

    it("counts hashtag occurrences across posts", () => {
      postActivity("u1", { type: "recommendation", message: "#seattle vibes" });
      postActivity("u2", { type: "recommendation", message: "Love #seattle" });
      const tags = getTrendingHashtags();
      expect(tags[0].tag).toBe("#seattle");
      expect(tags[0].count).toBe(2);
    });

    it("normalizes hashtags to lowercase", () => {
      postActivity("u1", { type: "recommendation", message: "#Seattle" });
      postActivity("u2", { type: "recommendation", message: "#SEATTLE" });
      const tags = getTrendingHashtags();
      expect(tags.length).toBe(1);
      expect(tags[0].count).toBe(2);
    });

    it("respects limit parameter", () => {
      postActivity("u1", { type: "recommendation", message: "#a #b #c #d" });
      expect(getTrendingHashtags(4, 2).length).toBe(2);
    });

    it("excludes posts without messages", () => {
      postActivity("u1", { type: "checkin", venueName: "A" });
      expect(getTrendingHashtags()).toEqual([]);
    });

    it("excludes posts older than the time window", () => {
      postActivity("u1", { type: "recommendation", message: "#oldtag" });
      const key = Object.keys(store).find(k => k.includes("social_feed"));
      const raw = JSON.parse(store[key]);
      raw[0].timestamp = Date.now() - 5 * 60 * 60 * 1000;
      store[key] = JSON.stringify(raw);
      expect(getTrendingHashtags(4)).toEqual([]);
    });

    it("handles hashtags with underscores and numbers", () => {
      postActivity("u1", { type: "recommendation", message: "#late_night_2024" });
      const tags = getTrendingHashtags();
      expect(tags[0].tag).toBe("#late_night_2024");
    });
  });

  /* ─── 10. followUser ─── */
  describe("followUser", () => {
    it("follows another user successfully", () => {
      expect(followUser("u1", "u2")).toBe(true);
    });

    it("returns false for duplicate follow", () => {
      followUser("u1", "u2");
      expect(followUser("u1", "u2")).toBe(false);
    });

    it("returns false when following self", () => {
      expect(followUser("u1", "u1")).toBe(false);
    });

    it("returns false for null userId", () => {
      expect(followUser(null, "u2")).toBe(false);
    });

    it("returns false for null targetUserId", () => {
      expect(followUser("u1", null)).toBe(false);
    });

    it("returns false for empty userId", () => {
      expect(followUser("", "u2")).toBe(false);
    });

    it("returns false for empty targetUserId", () => {
      expect(followUser("u1", "")).toBe(false);
    });

    it("generates notification for target user", () => {
      followUser("u1", "u2");
      const notifs = getNotifications("u2");
      expect(notifs.length).toBe(1);
      expect(notifs[0].type).toBe("follow");
    });
  });

  /* ─── 11. unfollowUser ─── */
  describe("unfollowUser", () => {
    it("unfollows a followed user", () => {
      followUser("u1", "u2");
      expect(unfollowUser("u1", "u2")).toBe(true);
    });

    it("returns false if not following", () => {
      expect(unfollowUser("u1", "u2")).toBe(false);
    });

    it("returns false for null userId", () => {
      expect(unfollowUser(null, "u2")).toBe(false);
    });

    it("returns false for null targetUserId", () => {
      expect(unfollowUser("u1", null)).toBe(false);
    });

    it("removes the user from following list", () => {
      followUser("u1", "u2");
      followUser("u1", "u3");
      unfollowUser("u1", "u2");
      expect(getFollowing("u1")).toEqual(["u3"]);
    });
  });

  /* ─── 12. getFollowing ─── */
  describe("getFollowing", () => {
    it("returns list of followed user ids", () => {
      followUser("u1", "u2");
      followUser("u1", "u3");
      expect(getFollowing("u1")).toEqual(["u2", "u3"]);
    });

    it("returns empty array for user with no follows", () => {
      expect(getFollowing("u1")).toEqual([]);
    });

    it("returns empty array for null userId", () => {
      expect(getFollowing(null)).toEqual([]);
    });

    it("returns a copy, not a reference", () => {
      followUser("u1", "u2");
      const list = getFollowing("u1");
      list.push("u99");
      expect(getFollowing("u1")).toEqual(["u2"]);
    });
  });

  /* ─── 13. getFollowers ─── */
  describe("getFollowers", () => {
    it("returns users following the target", () => {
      followUser("u1", "u3");
      followUser("u2", "u3");
      const followers = getFollowers("u3");
      expect(followers).toContain("u1");
      expect(followers).toContain("u2");
      expect(followers.length).toBe(2);
    });

    it("returns empty array when no followers", () => {
      expect(getFollowers("u1")).toEqual([]);
    });

    it("returns empty array for null userId", () => {
      expect(getFollowers(null)).toEqual([]);
    });
  });

  /* ─── 14. getFollowingFeed ─── */
  describe("getFollowingFeed", () => {
    it("returns posts from followed users only", () => {
      followUser("u1", "u2");
      postActivity("u2", { type: "checkin", venueName: "A" });
      postActivity("u3", { type: "checkin", venueName: "B" });
      const feed = getFollowingFeed("u1");
      expect(feed.length).toBe(1);
      expect(feed[0].userId).toBe("u2");
    });

    it("returns empty array when not following anyone", () => {
      postActivity("u2", { type: "checkin", venueName: "A" });
      expect(getFollowingFeed("u1")).toEqual([]);
    });

    it("returns empty array for null userId", () => {
      expect(getFollowingFeed(null)).toEqual([]);
    });

    it("respects limit parameter", () => {
      followUser("u1", "u2");
      for (let i = 0; i < 5; i++) {
        postActivity("u2", { type: "checkin", venueName: "V" + i });
      }
      expect(getFollowingFeed("u1", 3).length).toBe(3);
    });

    it("sorts posts newest first", () => {
      followUser("u1", "u2");
      postActivity("u2", { type: "checkin", venueName: "First" });
      // Manually set distinct timestamps so sort order is deterministic
      const key = Object.keys(store).find(k => k.includes("social_feed"));
      const raw = JSON.parse(store[key]);
      raw[0].timestamp = Date.now() - 5000;
      store[key] = JSON.stringify(raw);
      postActivity("u2", { type: "checkin", venueName: "Second" });
      const feed = getFollowingFeed("u1");
      expect(feed[0].venueName).toBe("Second");
    });

    it("includes posts from multiple followed users", () => {
      followUser("u1", "u2");
      followUser("u1", "u3");
      postActivity("u2", { type: "checkin", venueName: "A" });
      postActivity("u3", { type: "checkin", venueName: "B" });
      expect(getFollowingFeed("u1").length).toBe(2);
    });
  });

  /* ─── 15. getNotifications ─── */
  describe("getNotifications", () => {
    it("returns notifications for a user", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "A" });
      likePost(post.id, "u2");
      expect(getNotifications("u1").length).toBe(1);
    });

    it("returns empty array for null userId", () => {
      expect(getNotifications(null)).toEqual([]);
    });

    it("returns empty array when no notifications", () => {
      expect(getNotifications("u1")).toEqual([]);
    });

    it("sorts notifications newest first", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "A" });
      likePost(post.id, "u2");
      likePost(post.id, "u3");
      const notifs = getNotifications("u1");
      expect(notifs[0].timestamp).toBeGreaterThanOrEqual(notifs[1].timestamp);
    });

    it("only returns notifications for the specified user", () => {
      const p1 = postActivity("u1", { type: "checkin", venueName: "A" });
      const p2 = postActivity("u2", { type: "checkin", venueName: "B" });
      likePost(p1.id, "u3");
      likePost(p2.id, "u3");
      expect(getNotifications("u1").length).toBe(1);
      expect(getNotifications("u2").length).toBe(1);
    });
  });

  /* ─── 16. markNotificationRead ─── */
  describe("markNotificationRead", () => {
    it("marks a notification as read", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "A" });
      likePost(post.id, "u2");
      const notifs = getNotifications("u1");
      expect(markNotificationRead(notifs[0].id)).toBe(true);
      const updated = getNotifications("u1");
      expect(updated[0].read).toBe(true);
    });

    it("returns false for non-existent notification", () => {
      expect(markNotificationRead("fake")).toBe(false);
    });

    it("returns false for null notificationId", () => {
      expect(markNotificationRead(null)).toBe(false);
    });
  });

  /* ─── 17. getUnreadCount ─── */
  describe("getUnreadCount", () => {
    it("counts unread notifications", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "A" });
      likePost(post.id, "u2");
      likePost(post.id, "u3");
      expect(getUnreadCount("u1")).toBe(2);
    });

    it("decreases after marking as read", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "A" });
      likePost(post.id, "u2");
      likePost(post.id, "u3");
      const notifs = getNotifications("u1");
      markNotificationRead(notifs[0].id);
      expect(getUnreadCount("u1")).toBe(1);
    });

    it("returns 0 for null userId", () => {
      expect(getUnreadCount(null)).toBe(0);
    });

    it("returns 0 when no notifications", () => {
      expect(getUnreadCount("u1")).toBe(0);
    });

    it("returns 0 after all notifications are read", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "A" });
      likePost(post.id, "u2");
      const notifs = getNotifications("u1");
      markNotificationRead(notifs[0].id);
      expect(getUnreadCount("u1")).toBe(0);
    });
  });

  /* ─── 18. reportPost ─── */
  describe("reportPost", () => {
    it("reports a post successfully", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "A" });
      expect(reportPost(post.id, "u2", "spam")).toBe(true);
    });

    it("prevents duplicate report from same user", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "A" });
      reportPost(post.id, "u2", "spam");
      expect(reportPost(post.id, "u2", "harassment")).toBe(false);
    });

    it("allows different users to report same post", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "A" });
      reportPost(post.id, "u2", "spam");
      expect(reportPost(post.id, "u3", "spam")).toBe(true);
    });

    it("returns false for invalid reason", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "A" });
      expect(reportPost(post.id, "u2", "invalid_reason")).toBe(false);
    });

    it("returns false for non-existent post", () => {
      expect(reportPost("fake", "u1", "spam")).toBe(false);
    });

    it("returns false for null postId", () => {
      expect(reportPost(null, "u1", "spam")).toBe(false);
    });

    it("returns false for null userId", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "A" });
      expect(reportPost(post.id, null, "spam")).toBe(false);
    });

    it("returns false for null reason", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "A" });
      expect(reportPost(post.id, "u2", null)).toBe(false);
    });

    it("accepts all valid report reasons", () => {
      const reasons = ["spam", "inappropriate", "harassment", "misinformation"];
      reasons.forEach((reason, i) => {
        const post = postActivity("u" + i, { type: "checkin", venueName: "V" + i });
        expect(reportPost(post.id, "reporter", reason)).toBe(true);
      });
    });
  });

  /* ─── 19. getReportCount ─── */
  describe("getReportCount", () => {
    it("returns the number of reports for a post", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "A" });
      reportPost(post.id, "u2", "spam");
      reportPost(post.id, "u3", "harassment");
      expect(getReportCount(post.id)).toBe(2);
    });

    it("returns 0 for unreported post", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "A" });
      expect(getReportCount(post.id)).toBe(0);
    });

    it("returns 0 for null postId", () => {
      expect(getReportCount(null)).toBe(0);
    });
  });

  /* ─── 20. isAutoHidden ─── */
  describe("isAutoHidden", () => {
    it("returns false when reports below threshold", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "A" });
      reportPost(post.id, "u2", "spam");
      reportPost(post.id, "u3", "spam");
      expect(isAutoHidden(post.id)).toBe(false);
    });

    it("returns true when reports reach threshold (3)", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "A" });
      reportPost(post.id, "u2", "spam");
      reportPost(post.id, "u3", "spam");
      reportPost(post.id, "u4", "spam");
      expect(isAutoHidden(post.id)).toBe(true);
    });

    it("returns true when reports exceed threshold", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "A" });
      reportPost(post.id, "u2", "spam");
      reportPost(post.id, "u3", "spam");
      reportPost(post.id, "u4", "spam");
      reportPost(post.id, "u5", "spam");
      expect(isAutoHidden(post.id)).toBe(true);
    });

    it("returns false for unreported post", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "A" });
      expect(isAutoHidden(post.id)).toBe(false);
    });
  });

  /* ─── 21. getVisibleFeed ─── */
  describe("getVisibleFeed", () => {
    it("excludes auto-hidden posts", () => {
      const p1 = postActivity("u1", { type: "checkin", venueName: "Good" });
      const p2 = postActivity("u1", { type: "checkin", venueName: "Bad" });
      reportPost(p2.id, "r1", "spam");
      reportPost(p2.id, "r2", "spam");
      reportPost(p2.id, "r3", "spam");
      const feed = getVisibleFeed();
      expect(feed.length).toBe(1);
      expect(feed[0].venueName).toBe("Good");
    });

    it("returns all posts when none are hidden", () => {
      postActivity("u1", { type: "checkin", venueName: "A" });
      postActivity("u1", { type: "checkin", venueName: "B" });
      expect(getVisibleFeed().length).toBe(2);
    });

    it("passes options through to getFeed", () => {
      postActivity("u1", { type: "checkin", venueName: "A" });
      postActivity("u2", { type: "checkin", venueName: "B" });
      const feed = getVisibleFeed({ userId: "u1" });
      expect(feed.length).toBe(1);
    });

    it("returns empty when all posts are hidden", () => {
      const p1 = postActivity("u1", { type: "checkin", venueName: "A" });
      reportPost(p1.id, "r1", "spam");
      reportPost(p1.id, "r2", "spam");
      reportPost(p1.id, "r3", "spam");
      expect(getVisibleFeed()).toEqual([]);
    });

    it("supports type filtering with moderation", () => {
      postActivity("u1", { type: "checkin", venueName: "A" });
      postActivity("u1", { type: "review", venueName: "B" });
      const feed = getVisibleFeed({ type: "review" });
      expect(feed.length).toBe(1);
      expect(feed[0].type).toBe("review");
    });
  });

  /* ─── 22. Notification data integrity ─── */
  describe("notification data", () => {
    it("like notification includes postId and fromUserId", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "A" });
      likePost(post.id, "u2");
      const notif = getNotifications("u1")[0];
      expect(notif.data.postId).toBe(post.id);
      expect(notif.data.fromUserId).toBe("u2");
    });

    it("comment notification includes postId, fromUserId, and commentId", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "A" });
      const comment = commentOnPost(post.id, "u2", "Wow");
      const notif = getNotifications("u1")[0];
      expect(notif.data.postId).toBe(post.id);
      expect(notif.data.fromUserId).toBe("u2");
      expect(notif.data.commentId).toBe(comment.id);
    });

    it("follow notification includes fromUserId", () => {
      followUser("u1", "u2");
      const notif = getNotifications("u2")[0];
      expect(notif.data.fromUserId).toBe("u1");
    });

    it("notifications start as unread", () => {
      followUser("u1", "u2");
      const notif = getNotifications("u2")[0];
      expect(notif.read).toBe(false);
    });

    it("notification has id and timestamp", () => {
      followUser("u1", "u2");
      const notif = getNotifications("u2")[0];
      expect(notif.id).toBeTruthy();
      expect(typeof notif.timestamp).toBe("number");
    });
  });

  /* ─── 23. Edge cases ─── */
  describe("edge cases", () => {
    it("handles corrupted localStorage data gracefully", () => {
      store["lnv_social_feed"] = "not json";
      expect(getFeed()).toEqual([]);
    });

    it("like and unlike cycle works correctly", () => {
      const post = postActivity("u1", { type: "checkin", venueName: "A" });
      expect(likePost(post.id, "u2")).toBe(1);
      expect(unlikePost(post.id, "u2")).toBe(0);
      expect(likePost(post.id, "u2")).toBe(1);
    });

    it("follow and unfollow cycle works correctly", () => {
      expect(followUser("u1", "u2")).toBe(true);
      expect(unfollowUser("u1", "u2")).toBe(true);
      expect(followUser("u1", "u2")).toBe(true);
      expect(getFollowing("u1")).toEqual(["u2"]);
    });

    it("multiple activity types from the same user", () => {
      postActivity("u1", { type: "checkin", venueName: "A" });
      postActivity("u1", { type: "review", venueName: "A", rating: 5 });
      postActivity("u1", { type: "photo", venueName: "A", photo: "img.jpg" });
      postActivity("u1", { type: "recommendation", message: "Try this!" });
      postActivity("u1", { type: "milestone", message: "100 venues!" });
      expect(getUserFeed("u1").length).toBe(5);
    });
  });
});
