/**
 * Venue Owner — Creator & Nightlife Partnerships for Late Night Vibes.
 *
 * Enables venue owners, creators, and promoters to manage content:
 * venue claims, specials/promotions, curated crawls, venue responses,
 * deal tracking, and basic analytics.
 *
 * UMD-style export: works in Node (tests) and in the browser
 * (<script src="lib/venue-owner.js"> → window.LNVVenueOwner).
 */
(function (exports) {
  "use strict";

  var STORAGE_KEY = "lnv_venue_owner";

  /* ─── City-scoped key helpers ─── */

  function _cities() {
    if (typeof module !== "undefined") return require("./cities");
    return (typeof window !== "undefined" && window.LNVCities) || null;
  }

  function _scopedKey(suffix) {
    var c = _cities();
    var base = suffix ? STORAGE_KEY + "_" + suffix : STORAGE_KEY;
    return c && c.getCityKey ? c.getCityKey(base) : base;
  }

  function _migrate() {
    var c = _cities();
    if (c && c.migrateKeyIfNeeded) c.migrateKeyIfNeeded(STORAGE_KEY);
  }

  /* ─── Persistence helpers ─── */

  function _load(suffix) {
    try {
      _migrate();
      var raw = (typeof localStorage !== "undefined")
        ? localStorage.getItem(_scopedKey(suffix))
        : null;
      if (raw) return JSON.parse(raw);
    } catch (_e) { /* ignore */ }
    return null;
  }

  function _save(suffix, data) {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(_scopedKey(suffix), JSON.stringify(data));
      }
    } catch (_e) { /* ignore */ }
  }

  function _loadObj(suffix) {
    return _load(suffix) || {};
  }

  function _loadArr(suffix) {
    return _load(suffix) || [];
  }

  /* ─── ID generation ─── */

  function generateId() {
    var chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    var id = "";
    for (var i = 0; i < 8; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }

  /* ─── Device ID (for per-user tracking) ─── */

  function _getDeviceId() {
    var key = "lnv_device_id";
    try {
      if (typeof localStorage !== "undefined") {
        var existing = localStorage.getItem(key);
        if (existing) return existing;
        var id = "dev_" + generateId() + "_" + Date.now();
        localStorage.setItem(key, id);
        return id;
      }
    } catch (_e) { /* ignore */ }
    return "dev_anonymous";
  }

  /* ═══════════════════════════════════════════
   * 1. Venue Claims
   * ═══════════════════════════════════════════ */

  var CLAIMS_KEY = "claims";

  /**
   * Submit a claim request for a venue.
   * ownerInfo: { name, email, role: "owner"|"manager"|"promoter" }
   * Returns the created claim object.
   */
  function claimVenue(venueName, ownerInfo) {
    if (!venueName || typeof venueName !== "string") {
      throw new Error("venueName is required");
    }
    if (!ownerInfo || !ownerInfo.name || !ownerInfo.email || !ownerInfo.role) {
      throw new Error("ownerInfo requires name, email, and role");
    }
    var validRoles = ["owner", "manager", "promoter"];
    if (validRoles.indexOf(ownerInfo.role) === -1) {
      throw new Error("role must be one of: " + validRoles.join(", "));
    }

    var claims = _loadObj(CLAIMS_KEY);
    var claim = {
      venueName: venueName,
      ownerInfo: {
        name: ownerInfo.name,
        email: ownerInfo.email,
        role: ownerInfo.role
      },
      status: "pending",
      claimedAt: new Date().toISOString(),
      id: generateId()
    };
    if (!claims[venueName]) {
      claims[venueName] = [];
    }
    claims[venueName].push(claim);
    _save(CLAIMS_KEY, claims);
    return claim;
  }

  /**
   * Get claim status for a venue. Returns the latest claim object or null.
   */
  function getClaimStatus(venueName) {
    var claims = _loadObj(CLAIMS_KEY);
    var arr = claims[venueName];
    if (!arr || arr.length === 0) return null;
    return arr[arr.length - 1];
  }

  /**
   * List all claims across all venues.
   */
  function listClaims() {
    var claims = _loadObj(CLAIMS_KEY);
    var result = [];
    var keys = Object.keys(claims);
    for (var i = 0; i < keys.length; i++) {
      var arr = claims[keys[i]];
      for (var j = 0; j < arr.length; j++) {
        result.push(arr[j]);
      }
    }
    return result;
  }

  /* ═══════════════════════════════════════════
   * 2. Specials & Promotions
   * ═══════════════════════════════════════════ */

  var SPECIALS_KEY = "specials";

  /**
   * Add a special/promotion for a venue.
   * special: { title, description, validFrom (ISO), validUntil (ISO),
   *            type: "drink"|"food"|"cover"|"event"|"other" }
   * Returns the created special with an id.
   */
  function addSpecial(venueName, special) {
    if (!venueName || typeof venueName !== "string") {
      throw new Error("venueName is required");
    }
    if (!special || !special.title || !special.type) {
      throw new Error("special requires title and type");
    }
    var validTypes = ["drink", "food", "cover", "event", "other"];
    if (validTypes.indexOf(special.type) === -1) {
      throw new Error("type must be one of: " + validTypes.join(", "));
    }

    var specials = _loadObj(SPECIALS_KEY);
    var entry = {
      id: generateId(),
      venueName: venueName,
      title: special.title,
      description: special.description || "",
      validFrom: special.validFrom || new Date().toISOString(),
      validUntil: special.validUntil || null,
      type: special.type,
      createdAt: new Date().toISOString()
    };
    if (!specials[venueName]) {
      specials[venueName] = [];
    }
    specials[venueName].push(entry);
    _save(SPECIALS_KEY, specials);
    return entry;
  }

  /**
   * Get active (non-expired) specials for a venue.
   */
  function getActiveSpecials(venueName) {
    var specials = _loadObj(SPECIALS_KEY);
    var arr = specials[venueName] || [];
    var now = new Date().toISOString();
    return arr.filter(function (s) {
      if (s.validUntil && s.validUntil < now) return false;
      if (s.validFrom && s.validFrom > now) return false;
      return true;
    });
  }

  /**
   * Get all active specials grouped by venue.
   * Returns { "Venue Name": [specials], ... }
   */
  function getAllActiveSpecials() {
    var specials = _loadObj(SPECIALS_KEY);
    var result = {};
    var now = new Date().toISOString();
    var keys = Object.keys(specials);
    for (var i = 0; i < keys.length; i++) {
      var venue = keys[i];
      var active = specials[venue].filter(function (s) {
        if (s.validUntil && s.validUntil < now) return false;
        if (s.validFrom && s.validFrom > now) return false;
        return true;
      });
      if (active.length > 0) {
        result[venue] = active;
      }
    }
    return result;
  }

  /* ═══════════════════════════════════════════
   * 3. Curated Crawls
   * ═══════════════════════════════════════════ */

  var CRAWLS_KEY = "crawls";

  /**
   * Create a curated crawl.
   * crawlData: { title, description, curator, stops: [{venueName, note, order}],
   *              theme, estimatedDuration (minutes), city (slug) }
   * Returns the created crawl with id and featured flag.
   */
  function createCrawl(crawlData) {
    if (!crawlData || !crawlData.title || !crawlData.curator) {
      throw new Error("crawlData requires title and curator");
    }
    if (!crawlData.stops || !Array.isArray(crawlData.stops) || crawlData.stops.length === 0) {
      throw new Error("crawlData requires at least one stop");
    }

    var crawls = _loadArr(CRAWLS_KEY);
    var crawl = {
      id: generateId(),
      title: crawlData.title,
      description: crawlData.description || "",
      curator: crawlData.curator,
      stops: crawlData.stops.map(function (stop) {
        return {
          venueName: stop.venueName,
          note: stop.note || "",
          order: typeof stop.order === "number" ? stop.order : 0
        };
      }),
      theme: crawlData.theme || "",
      estimatedDuration: crawlData.estimatedDuration || 0,
      city: crawlData.city || "",
      featured: false,
      createdAt: new Date().toISOString()
    };
    crawls.push(crawl);
    _save(CRAWLS_KEY, crawls);
    return crawl;
  }

  /**
   * Get a crawl by ID.
   */
  function getCrawl(crawlId) {
    var crawls = _loadArr(CRAWLS_KEY);
    for (var i = 0; i < crawls.length; i++) {
      if (crawls[i].id === crawlId) return crawls[i];
    }
    return null;
  }

  /**
   * List crawls, optionally filtered by city slug.
   */
  function listCrawls(citySlug) {
    var crawls = _loadArr(CRAWLS_KEY);
    if (!citySlug) return crawls;
    return crawls.filter(function (c) {
      return c.city === citySlug;
    });
  }

  /**
   * Set the featured flag on a crawl.
   */
  function setFeatured(crawlId, featured) {
    var crawls = _loadArr(CRAWLS_KEY);
    for (var i = 0; i < crawls.length; i++) {
      if (crawls[i].id === crawlId) {
        crawls[i].featured = !!featured;
        _save(CRAWLS_KEY, crawls);
        return crawls[i];
      }
    }
    return null;
  }

  /* ═══════════════════════════════════════════
   * 4. Venue Responses
   * ═══════════════════════════════════════════ */

  var RESPONSES_KEY = "responses";
  var RESPONSE_RATE_LIMIT_MS = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Add a venue response. Rate-limited to 1 per 24h per venue.
   * response: { text, author }
   * Returns the created response or throws on rate limit.
   */
  function addVenueResponse(venueName, response) {
    if (!venueName || typeof venueName !== "string") {
      throw new Error("venueName is required");
    }
    if (!response || !response.text || !response.author) {
      throw new Error("response requires text and author");
    }

    var responses = _loadObj(RESPONSES_KEY);
    var arr = responses[venueName] || [];

    // Rate limit check: 1 response per 24h per venue
    if (arr.length > 0) {
      var last = arr[arr.length - 1];
      var elapsed = Date.now() - new Date(last.timestamp).getTime();
      if (elapsed < RESPONSE_RATE_LIMIT_MS) {
        throw new Error("Rate limited: only 1 response per 24 hours per venue");
      }
    }

    var entry = {
      id: generateId(),
      text: response.text,
      author: response.author,
      timestamp: new Date().toISOString()
    };
    arr.push(entry);
    responses[venueName] = arr;
    _save(RESPONSES_KEY, responses);
    return entry;
  }

  /**
   * Get all responses for a venue.
   */
  function getVenueResponses(venueName) {
    var responses = _loadObj(RESPONSES_KEY);
    return responses[venueName] || [];
  }

  /* ═══════════════════════════════════════════
   * 5. Deal Tracking
   * ═══════════════════════════════════════════ */

  var REDEMPTIONS_KEY = "redemptions";

  /**
   * Record a deal redemption.
   * Returns the redemption record.
   */
  function redeemDeal(specialId, venueName) {
    if (!specialId) throw new Error("specialId is required");
    if (!venueName) throw new Error("venueName is required");

    var redemptions = _loadObj(REDEMPTIONS_KEY);
    var deviceId = _getDeviceId();

    if (!redemptions[specialId]) {
      redemptions[specialId] = [];
    }

    var record = {
      specialId: specialId,
      venueName: venueName,
      deviceId: deviceId,
      redeemedAt: new Date().toISOString()
    };
    redemptions[specialId].push(record);
    _save(REDEMPTIONS_KEY, redemptions);
    return record;
  }

  /**
   * Get total redemption count for a special.
   */
  function getRedemptionCount(specialId) {
    var redemptions = _loadObj(REDEMPTIONS_KEY);
    var arr = redemptions[specialId] || [];
    return arr.length;
  }

  /**
   * Check if the current device has redeemed a special.
   */
  function hasRedeemed(specialId) {
    var redemptions = _loadObj(REDEMPTIONS_KEY);
    var arr = redemptions[specialId] || [];
    var deviceId = _getDeviceId();
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].deviceId === deviceId) return true;
    }
    return false;
  }

  /* ═══════════════════════════════════════════
   * 6. Analytics (basic)
   * ═══════════════════════════════════════════ */

  var ANALYTICS_KEY = "analytics";

  /**
   * Track a venue page view.
   */
  function trackView(venueName) {
    if (!venueName) return;
    var analytics = _loadObj(ANALYTICS_KEY);
    if (!analytics[venueName]) {
      analytics[venueName] = 0;
    }
    analytics[venueName] += 1;
    _save(ANALYTICS_KEY, analytics);
    return analytics[venueName];
  }

  /**
   * Get view count for a venue.
   */
  function getViewCount(venueName) {
    var analytics = _loadObj(ANALYTICS_KEY);
    return analytics[venueName] || 0;
  }

  /**
   * Get top viewed venues.
   * Returns array of { venueName, views } sorted descending.
   */
  function getTopViewed(limit) {
    var analytics = _loadObj(ANALYTICS_KEY);
    var entries = Object.keys(analytics).map(function (name) {
      return { venueName: name, views: analytics[name] };
    });
    entries.sort(function (a, b) { return b.views - a.views; });
    if (typeof limit === "number" && limit > 0) {
      return entries.slice(0, limit);
    }
    return entries;
  }

  /* ─── Exports ─── */

  exports.STORAGE_KEY = STORAGE_KEY;

  // Claims
  exports.claimVenue = claimVenue;
  exports.getClaimStatus = getClaimStatus;
  exports.listClaims = listClaims;

  // Specials
  exports.addSpecial = addSpecial;
  exports.getActiveSpecials = getActiveSpecials;
  exports.getAllActiveSpecials = getAllActiveSpecials;

  // Curated Crawls
  exports.createCrawl = createCrawl;
  exports.getCrawl = getCrawl;
  exports.listCrawls = listCrawls;
  exports.setFeatured = setFeatured;

  // Venue Responses
  exports.addVenueResponse = addVenueResponse;
  exports.getVenueResponses = getVenueResponses;

  // Deal Tracking
  exports.redeemDeal = redeemDeal;
  exports.getRedemptionCount = getRedemptionCount;
  exports.hasRedeemed = hasRedeemed;

  // Analytics
  exports.trackView = trackView;
  exports.getViewCount = getViewCount;
  exports.getTopViewed = getTopViewed;

})(typeof module !== "undefined" ? module.exports : (window.LNVVenueOwner = {}));
