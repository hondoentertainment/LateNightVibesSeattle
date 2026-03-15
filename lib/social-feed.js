/**
 * Late Night Vibes — Social Feed (real-time activity feed for nightlife).
 * UMD-style export: works in Node (tests) and browser
 * (<script src="lib/social-feed.js"> → window.LNVSocialFeed).
 */
(function (exports) {
  "use strict";

  var STORAGE_KEY = "lnv_social_feed";
  var FOLLOWS_KEY = "lnv_social_follows";
  var NOTIFICATIONS_KEY = "lnv_social_notifications";
  var REPORTS_KEY = "lnv_social_reports";

  var VALID_TYPES = ["checkin", "review", "recommendation", "photo", "milestone"];
  var VALID_REPORT_REASONS = ["spam", "inappropriate", "harassment", "misinformation"];
  var AUTO_HIDE_THRESHOLD = 3;

  /* ─── City-scoped key helpers ─── */

  function _cities() {
    if (typeof module !== "undefined") return require("./cities");
    return (typeof window !== "undefined" && window.LNVCities) || null;
  }

  function _scopedKey(baseKey) {
    var c = _cities();
    var key = baseKey || STORAGE_KEY;
    return c && c.getCityKey ? c.getCityKey(key) : key;
  }

  function _migrate(baseKey) {
    var c = _cities();
    var key = baseKey || STORAGE_KEY;
    if (c && c.migrateKeyIfNeeded) c.migrateKeyIfNeeded(key);
  }

  /* ─── Storage helpers ─── */

  function _readStore(baseKey) {
    try {
      _migrate(baseKey);
      return JSON.parse(localStorage.getItem(_scopedKey(baseKey)) || "[]");
    } catch (_e) {
      return [];
    }
  }

  function _writeStore(data, baseKey) {
    try {
      localStorage.setItem(_scopedKey(baseKey), JSON.stringify(data));
    } catch (_e) { /* quota exceeded — silently fail */ }
  }

  function _readPosts() {
    return _readStore(STORAGE_KEY);
  }

  function _writePosts(posts) {
    _writeStore(posts, STORAGE_KEY);
  }

  function _readFollows() {
    try {
      _migrate(FOLLOWS_KEY);
      return JSON.parse(localStorage.getItem(_scopedKey(FOLLOWS_KEY)) || "{}");
    } catch (_e) {
      return {};
    }
  }

  function _writeFollows(follows) {
    try {
      localStorage.setItem(_scopedKey(FOLLOWS_KEY), JSON.stringify(follows));
    } catch (_e) { /* quota exceeded */ }
  }

  function _readNotifications() {
    return _readStore(NOTIFICATIONS_KEY);
  }

  function _writeNotifications(notifications) {
    _writeStore(notifications, NOTIFICATIONS_KEY);
  }

  function _readReports() {
    return _readStore(REPORTS_KEY);
  }

  function _writeReports(reports) {
    _writeStore(reports, REPORTS_KEY);
  }

  function _generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function _findPost(postId) {
    var posts = _readPosts();
    for (var i = 0; i < posts.length; i++) {
      if (posts[i].id === postId) return posts[i];
    }
    return null;
  }

  function _addNotification(userId, type, data) {
    var notifications = _readNotifications();
    notifications.push({
      id: _generateId(),
      userId: userId,
      type: type,
      data: data,
      timestamp: Date.now(),
      read: false
    });
    _writeNotifications(notifications);
  }

  /* ─── 1. Activity Posts ─── */

  function postActivity(userId, activity) {
    if (!userId || !activity || typeof activity !== "object") return null;
    var type = activity.type;
    if (!type || VALID_TYPES.indexOf(type) === -1) return null;

    // venueName required for checkin, review, photo
    if ((type === "checkin" || type === "review" || type === "photo") && !activity.venueName) {
      return null;
    }

    var post = {
      id: _generateId(),
      userId: userId,
      type: type,
      venueName: activity.venueName || null,
      message: activity.message || null,
      rating: activity.rating || null,
      photo: activity.photo || null,
      timestamp: Date.now(),
      likes: [],
      comments: []
    };

    var posts = _readPosts();
    posts.push(post);
    _writePosts(posts);
    return post;
  }

  function deleteActivity(postId) {
    if (!postId) return false;
    var posts = _readPosts();
    var len = posts.length;
    var filtered = posts.filter(function (p) { return p.id !== postId; });
    if (filtered.length === len) return false;
    _writePosts(filtered);
    return true;
  }

  /* ─── 2. Feed Retrieval ─── */

  function getFeed(options) {
    var opts = options || {};
    var limit = opts.limit || 20;
    var offset = opts.offset || 0;
    var posts = _readPosts();

    // Sort newest first
    posts.sort(function (a, b) { return b.timestamp - a.timestamp; });

    // Apply filters
    if (opts.type) {
      posts = posts.filter(function (p) { return p.type === opts.type; });
    }
    if (opts.venueName) {
      posts = posts.filter(function (p) { return p.venueName === opts.venueName; });
    }
    if (opts.userId) {
      posts = posts.filter(function (p) { return p.userId === opts.userId; });
    }

    return posts.slice(offset, offset + limit);
  }

  function getVenueFeed(venueName, limit) {
    return getFeed({ venueName: venueName, limit: limit || 20 });
  }

  function getUserFeed(userId, limit) {
    return getFeed({ userId: userId, limit: limit || 20 });
  }

  /* ─── 3. Social Interactions ─── */

  function likePost(postId, userId) {
    if (!postId || !userId) return -1;
    var posts = _readPosts();
    for (var i = 0; i < posts.length; i++) {
      if (posts[i].id === postId) {
        if (posts[i].likes.indexOf(userId) === -1) {
          posts[i].likes.push(userId);
          _writePosts(posts);
          // Notify post author (if not self-like)
          if (posts[i].userId !== userId) {
            _addNotification(posts[i].userId, "like", {
              postId: postId,
              fromUserId: userId
            });
          }
        }
        return posts[i].likes.length;
      }
    }
    return -1;
  }

  function unlikePost(postId, userId) {
    if (!postId || !userId) return -1;
    var posts = _readPosts();
    for (var i = 0; i < posts.length; i++) {
      if (posts[i].id === postId) {
        var idx = posts[i].likes.indexOf(userId);
        if (idx !== -1) {
          posts[i].likes.splice(idx, 1);
          _writePosts(posts);
        }
        return posts[i].likes.length;
      }
    }
    return -1;
  }

  function commentOnPost(postId, userId, text) {
    if (!postId || !userId || !text || typeof text !== "string" || text.trim() === "") return null;
    var posts = _readPosts();
    for (var i = 0; i < posts.length; i++) {
      if (posts[i].id === postId) {
        var comment = {
          id: _generateId(),
          userId: userId,
          text: text,
          timestamp: Date.now()
        };
        posts[i].comments.push(comment);
        _writePosts(posts);
        // Notify post author (if not self-comment)
        if (posts[i].userId !== userId) {
          _addNotification(posts[i].userId, "comment", {
            postId: postId,
            fromUserId: userId,
            commentId: comment.id
          });
        }
        return comment;
      }
    }
    return null;
  }

  function getComments(postId) {
    var post = _findPost(postId);
    if (!post) return [];
    var comments = post.comments.slice();
    comments.sort(function (a, b) { return a.timestamp - b.timestamp; });
    return comments;
  }

  /* ─── 4. Trending ─── */

  function getTrendingVenues(hours, limit) {
    var h = hours || 4;
    var lim = limit || 10;
    var cutoff = Date.now() - (h * 60 * 60 * 1000);
    var posts = _readPosts();
    var venueMap = {};

    for (var i = 0; i < posts.length; i++) {
      var p = posts[i];
      if (p.timestamp < cutoff || !p.venueName) continue;
      if (!venueMap[p.venueName]) {
        venueMap[p.venueName] = { venueName: p.venueName, postCount: 0, totalLikes: 0 };
      }
      venueMap[p.venueName].postCount++;
      venueMap[p.venueName].totalLikes += p.likes.length;
    }

    var results = [];
    for (var key in venueMap) {
      var v = venueMap[key];
      v.score = v.postCount + v.totalLikes;
      results.push(v);
    }
    results.sort(function (a, b) { return b.score - a.score; });
    return results.slice(0, lim);
  }

  function getTrendingHashtags(hours, limit) {
    var h = hours || 4;
    var lim = limit || 10;
    var cutoff = Date.now() - (h * 60 * 60 * 1000);
    var posts = _readPosts();
    var tagMap = {};

    for (var i = 0; i < posts.length; i++) {
      var p = posts[i];
      if (p.timestamp < cutoff || !p.message) continue;
      var matches = p.message.match(/#[a-zA-Z0-9_]+/g);
      if (!matches) continue;
      for (var j = 0; j < matches.length; j++) {
        var tag = matches[j].toLowerCase();
        tagMap[tag] = (tagMap[tag] || 0) + 1;
      }
    }

    var results = [];
    for (var tag in tagMap) {
      results.push({ tag: tag, count: tagMap[tag] });
    }
    results.sort(function (a, b) { return b.count - a.count; });
    return results.slice(0, lim);
  }

  /* ─── 5. Following System ─── */

  function followUser(userId, targetUserId) {
    if (!userId || !targetUserId || userId === targetUserId) return false;
    var follows = _readFollows();
    if (!follows[userId]) follows[userId] = [];
    if (follows[userId].indexOf(targetUserId) !== -1) return false;
    follows[userId].push(targetUserId);
    _writeFollows(follows);
    // Notify the target user
    _addNotification(targetUserId, "follow", { fromUserId: userId });
    return true;
  }

  function unfollowUser(userId, targetUserId) {
    if (!userId || !targetUserId) return false;
    var follows = _readFollows();
    if (!follows[userId]) return false;
    var idx = follows[userId].indexOf(targetUserId);
    if (idx === -1) return false;
    follows[userId].splice(idx, 1);
    _writeFollows(follows);
    return true;
  }

  function getFollowing(userId) {
    if (!userId) return [];
    var follows = _readFollows();
    return follows[userId] ? follows[userId].slice() : [];
  }

  function getFollowers(userId) {
    if (!userId) return [];
    var follows = _readFollows();
    var followers = [];
    for (var uid in follows) {
      if (follows[uid].indexOf(userId) !== -1) {
        followers.push(uid);
      }
    }
    return followers;
  }

  function getFollowingFeed(userId, limit) {
    if (!userId) return [];
    var following = getFollowing(userId);
    if (following.length === 0) return [];
    var posts = _readPosts();
    posts = posts.filter(function (p) {
      return following.indexOf(p.userId) !== -1;
    });
    posts.sort(function (a, b) { return b.timestamp - a.timestamp; });
    return posts.slice(0, limit || 20);
  }

  /* ─── 6. Notifications ─── */

  function getNotifications(userId) {
    if (!userId) return [];
    var notifications = _readNotifications();
    return notifications
      .filter(function (n) { return n.userId === userId; })
      .sort(function (a, b) { return b.timestamp - a.timestamp; });
  }

  function markNotificationRead(notificationId) {
    if (!notificationId) return false;
    var notifications = _readNotifications();
    for (var i = 0; i < notifications.length; i++) {
      if (notifications[i].id === notificationId) {
        notifications[i].read = true;
        _writeNotifications(notifications);
        return true;
      }
    }
    return false;
  }

  function getUnreadCount(userId) {
    if (!userId) return 0;
    var notifications = _readNotifications();
    var count = 0;
    for (var i = 0; i < notifications.length; i++) {
      if (notifications[i].userId === userId && !notifications[i].read) {
        count++;
      }
    }
    return count;
  }

  /* ─── 7. Content Moderation ─── */

  function reportPost(postId, userId, reason) {
    if (!postId || !userId || !reason) return false;
    if (VALID_REPORT_REASONS.indexOf(reason) === -1) return false;
    var post = _findPost(postId);
    if (!post) return false;

    var reports = _readReports();
    // Check for duplicate report
    for (var i = 0; i < reports.length; i++) {
      if (reports[i].postId === postId && reports[i].userId === userId) return false;
    }
    reports.push({
      id: _generateId(),
      postId: postId,
      userId: userId,
      reason: reason,
      timestamp: Date.now()
    });
    _writeReports(reports);
    return true;
  }

  function getReportCount(postId) {
    if (!postId) return 0;
    var reports = _readReports();
    var count = 0;
    for (var i = 0; i < reports.length; i++) {
      if (reports[i].postId === postId) count++;
    }
    return count;
  }

  function isAutoHidden(postId) {
    return getReportCount(postId) >= AUTO_HIDE_THRESHOLD;
  }

  function getVisibleFeed(options) {
    var allPosts = getFeed(options);
    return allPosts.filter(function (p) { return !isAutoHidden(p.id); });
  }

  /* ─── Exports ─── */

  exports.postActivity = postActivity;
  exports.deleteActivity = deleteActivity;
  exports.getFeed = getFeed;
  exports.getVenueFeed = getVenueFeed;
  exports.getUserFeed = getUserFeed;
  exports.likePost = likePost;
  exports.unlikePost = unlikePost;
  exports.commentOnPost = commentOnPost;
  exports.getComments = getComments;
  exports.getTrendingVenues = getTrendingVenues;
  exports.getTrendingHashtags = getTrendingHashtags;
  exports.followUser = followUser;
  exports.unfollowUser = unfollowUser;
  exports.getFollowing = getFollowing;
  exports.getFollowers = getFollowers;
  exports.getFollowingFeed = getFollowingFeed;
  exports.getNotifications = getNotifications;
  exports.markNotificationRead = markNotificationRead;
  exports.getUnreadCount = getUnreadCount;
  exports.reportPost = reportPost;
  exports.getReportCount = getReportCount;
  exports.isAutoHidden = isAutoHidden;
  exports.getVisibleFeed = getVisibleFeed;

})(typeof module !== "undefined" ? module.exports : (window.LNVSocialFeed = {}));
