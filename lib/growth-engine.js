/**
 * Late Night Vibes — Growth Engine (Phase 5: Nationwide Launch).
 *
 * Handles referrals, SEO metadata, PWA install prompts, city nominations,
 * share/viral mechanics, and onboarding flow.
 *
 * UMD-style export: works in Node (tests) and in the browser
 * (<script src="lib/growth-engine.js"> → window.LNVGrowthEngine).
 */
(function (exports) {
  "use strict";

  /* ─── Constants ─── */

  var REFERRAL_KEY = "lnv_referrals";
  var NOMINATIONS_KEY = "lnv_nominations";
  var INSTALL_KEY = "lnv_install_stats";
  var ONBOARDING_KEY = "lnv_onboarding";
  var SHARES_KEY = "lnv_shares";
  var VOTES_KEY = "lnv_votes";
  var BASE_URL = "https://latenightvibes.app";
  var INSTALL_VISIT_THRESHOLD = 3;
  var DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  var MAX_REFERRAL_REWARDS = [
    { threshold: 1, reward: "early-adopter" },
    { threshold: 3, reward: "connector" },
    { threshold: 10, reward: "ambassador" },
    { threshold: 25, reward: "legend" }
  ];

  var ONBOARDING_STEPS = [
    { step: 1, title: "Pick Your City", description: "Choose your home city to get started" },
    { step: 2, title: "Set Your Vibes", description: "Tell us what kind of nights you enjoy" },
    { step: 3, title: "Find Your First Spot", description: "Discover a venue that matches your vibe" },
    { step: 4, title: "Join a Squad", description: "Connect with friends for group outings" },
    { step: 5, title: "Enable Notifications", description: "Stay in the loop on events and deals" }
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
    if (c && c.migrateKeyIfNeeded) { c.migrateKeyIfNeeded(baseKey); }
  }

  /* ─── Storage helpers ─── */

  function _read(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch (_e) {
      return null;
    }
  }

  function _write(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (_e) { /* quota exceeded */ }
  }

  /* ─── 1. Referral System (global) ─── */

  function _getReferralStore() {
    return _read(REFERRAL_KEY) || {};
  }

  function _writeReferralStore(store) {
    _write(REFERRAL_KEY, store);
  }

  function generateReferralCode(username) {
    if (!username || typeof username !== "string") { return null; }
    var store = _getReferralStore();
    // Return existing code if already generated
    if (store[username] && store[username].code) {
      return store[username].code;
    }
    var code = "LNV-" + username.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) +
      "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
    store[username] = {
      code: code,
      totalReferrals: 0,
      successfulInstalls: 0,
      createdAt: Date.now()
    };
    _writeReferralStore(store);
    return code;
  }

  function getReferralLink(code) {
    if (!code || typeof code !== "string") { return null; }
    return BASE_URL + "?ref=" + encodeURIComponent(code);
  }

  function trackReferral(code) {
    if (!code || typeof code !== "string") { return false; }
    var store = _getReferralStore();
    // Find user with this code
    var found = false;
    for (var user in store) {
      if (store[user].code === code) {
        store[user].totalReferrals = (store[user].totalReferrals || 0) + 1;
        store[user].successfulInstalls = (store[user].successfulInstalls || 0) + 1;
        found = true;
        break;
      }
    }
    if (!found) { return false; }
    _writeReferralStore(store);
    return true;
  }

  function getReferralStats(username) {
    if (!username || typeof username !== "string") { return null; }
    var store = _getReferralStore();
    if (!store[username]) { return null; }
    return {
      code: store[username].code,
      totalReferrals: store[username].totalReferrals || 0,
      successfulInstalls: store[username].successfulInstalls || 0
    };
  }

  function getReferralRewards(username) {
    if (!username || typeof username !== "string") { return []; }
    var store = _getReferralStore();
    if (!store[username]) { return []; }
    var count = store[username].successfulInstalls || 0;
    var rewards = [];
    for (var i = 0; i < MAX_REFERRAL_REWARDS.length; i++) {
      if (count >= MAX_REFERRAL_REWARDS[i].threshold) {
        rewards.push(MAX_REFERRAL_REWARDS[i].reward);
      }
    }
    return rewards;
  }

  /* ─── 2. City Nomination (global) ─── */

  function _getNominationStore() {
    return _read(NOMINATIONS_KEY) || [];
  }

  function _writeNominationStore(nominations) {
    _write(NOMINATIONS_KEY, nominations);
  }

  function _getVoteStore() {
    return _read(VOTES_KEY) || {};
  }

  function _writeVoteStore(votes) {
    _write(VOTES_KEY, votes);
  }

  function nominateCity(cityData) {
    if (!cityData || !cityData.name || !cityData.state || !cityData.nominatorName || !cityData.reason) {
      return null;
    }
    if (isDuplicate(cityData.name, cityData.state)) {
      return null;
    }
    var nominations = _getNominationStore();
    var entry = {
      id: "nom-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      name: cityData.name,
      state: cityData.state,
      nominatorName: cityData.nominatorName,
      reason: cityData.reason,
      population: cityData.population || null,
      votes: 1,
      createdAt: Date.now()
    };
    nominations.push(entry);
    _writeNominationStore(nominations);
    return entry;
  }

  function getNominations() {
    var nominations = _getNominationStore();
    return nominations.slice().sort(function (a, b) {
      return b.votes - a.votes;
    });
  }

  function voteForNomination(cityId, userId) {
    if (!cityId) { return false; }
    var voterId = userId || "anonymous";
    var votes = _getVoteStore();
    var voteKey = voterId + ":" + cityId;
    if (votes[voteKey]) { return false; } // already voted

    var nominations = _getNominationStore();
    var found = false;
    for (var i = 0; i < nominations.length; i++) {
      if (nominations[i].id === cityId) {
        nominations[i].votes = (nominations[i].votes || 0) + 1;
        found = true;
        break;
      }
    }
    if (!found) { return false; }

    votes[voteKey] = Date.now();
    _writeVoteStore(votes);
    _writeNominationStore(nominations);
    return true;
  }

  function getTopNominations(limit) {
    var sorted = getNominations();
    return sorted.slice(0, limit || 10);
  }

  function isDuplicate(cityName, state) {
    if (!cityName || !state) { return false; }
    var nominations = _getNominationStore();
    var nameLower = cityName.toLowerCase().trim();
    var stateLower = state.toLowerCase().trim();
    for (var i = 0; i < nominations.length; i++) {
      if (nominations[i].name.toLowerCase().trim() === nameLower &&
          nominations[i].state.toLowerCase().trim() === stateLower) {
        return true;
      }
    }
    return false;
  }

  /* ─── 3. SEO Metadata ─── */

  function generateCityMeta(cityConfig) {
    if (!cityConfig || !cityConfig.name) { return null; }
    var slug = cityConfig.slug || cityConfig.name.toLowerCase().replace(/\s+/g, "-");
    var title = "Late Night Vibes " + cityConfig.name + " — Best Late-Night Spots";
    var description = cityConfig.description ||
      ("Discover the best late-night bars, clubs, and venues in " + cityConfig.name + ", " + (cityConfig.state || "") + ".");
    var canonicalUrl = BASE_URL + "/" + slug;

    var jsonLd = {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": title,
      "description": description,
      "url": canonicalUrl
    };
    if (cityConfig.lat && cityConfig.lng) {
      jsonLd.geo = {
        "@type": "GeoCoordinates",
        "latitude": cityConfig.lat,
        "longitude": cityConfig.lng
      };
    }

    return {
      title: title,
      description: description,
      ogTitle: title,
      ogDescription: description,
      canonicalUrl: canonicalUrl,
      jsonLd: jsonLd
    };
  }

  function generateVenueMeta(venue, cityConfig) {
    if (!venue || !venue.Name) { return null; }
    var cityName = (cityConfig && cityConfig.name) || "your city";
    var citySlug = (cityConfig && cityConfig.slug) || "city";
    var venueSlug = venue.Name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    var title = venue.Name + " — Late Night Vibes " + cityName;
    var description = "Check out " + venue.Name + " in " + (venue.Area || cityName) +
      ". " + (venue.Category || "Venue") + " open late.";
    var canonicalUrl = BASE_URL + "/" + citySlug + "/venue/" + venueSlug;

    var jsonLd = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "name": venue.Name,
      "description": description,
      "url": canonicalUrl
    };
    if (venue.Area) {
      jsonLd.address = {
        "@type": "PostalAddress",
        "addressLocality": cityName,
        "addressRegion": (cityConfig && cityConfig.state) || ""
      };
    }

    return {
      title: title,
      description: description,
      ogTitle: title,
      ogDescription: description,
      canonicalUrl: canonicalUrl,
      jsonLd: jsonLd
    };
  }

  function generateBreadcrumbs(cityConfig, pageName) {
    var crumbs = [
      { name: "Home", url: BASE_URL }
    ];
    if (cityConfig && cityConfig.name) {
      var citySlug = cityConfig.slug || cityConfig.name.toLowerCase().replace(/\s+/g, "-");
      crumbs.push({ name: cityConfig.name, url: BASE_URL + "/" + citySlug });
    }
    if (pageName) {
      crumbs.push({ name: pageName, url: null });
    }
    return crumbs;
  }

  /* ─── 4. PWA Install Prompts (global) ─── */

  function _getInstallStore() {
    return _read(INSTALL_KEY) || { visitCount: 0, lastVisit: null, dismissed: false, dismissedAt: null };
  }

  function _writeInstallStore(store) {
    _write(INSTALL_KEY, store);
  }

  function recordVisit() {
    var store = _getInstallStore();
    store.visitCount = (store.visitCount || 0) + 1;
    store.lastVisit = Date.now();
    _writeInstallStore(store);
    return store.visitCount;
  }

  function dismissInstallPrompt() {
    var store = _getInstallStore();
    store.dismissed = true;
    store.dismissedAt = Date.now();
    _writeInstallStore(store);
  }

  function isAppInstalled() {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(display-mode: standalone)").matches;
    }
    return false;
  }

  function shouldShowInstallPrompt() {
    if (isAppInstalled()) { return false; }
    var store = _getInstallStore();
    if ((store.visitCount || 0) < INSTALL_VISIT_THRESHOLD) { return false; }
    if (store.dismissed && store.dismissedAt) {
      var elapsed = Date.now() - store.dismissedAt;
      if (elapsed < DISMISS_COOLDOWN_MS) { return false; }
    }
    return true;
  }

  function getInstallStats() {
    return _getInstallStore();
  }

  /* ─── 5. Share & Viral Mechanics (city-scoped) ─── */

  function _getShareStore() {
    _migrate(SHARES_KEY);
    return _read(_scopedKey(SHARES_KEY)) || {};
  }

  function _writeShareStore(store) {
    _write(_scopedKey(SHARES_KEY), store);
  }

  function generateShareContent(type, data) {
    if (!type) { return null; }
    data = data || {};
    var text = "";
    var url = BASE_URL;
    var hashtags = ["LateNightVibes"];

    switch (type) {
    case "venue":
      text = "Check out " + (data.name || "this spot") + " on Late Night Vibes!";
      url = BASE_URL + "/" + (data.citySlug || "city") + "/venue/" +
        ((data.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "spot");
      hashtags.push("NightOut");
      break;
    case "crawl":
      text = "Join my night plan" + (data.cityName ? " in " + data.cityName : "") + "!";
      url = BASE_URL + "/" + (data.citySlug || "city") + "/plan" + (data.planId ? "/" + data.planId : "");
      hashtags.push("BarCrawl");
      break;
    case "achievement":
      text = "I just earned the " + (data.badge || "achievement") + " badge on Late Night Vibes!";
      url = BASE_URL + "/profile";
      hashtags.push("Achievement");
      break;
    case "city":
      text = "Explore late-night spots in " + (data.cityName || "this city") + "!";
      url = BASE_URL + "/" + (data.citySlug || "city");
      hashtags.push("CityNightlife");
      break;
    default:
      text = "Check out Late Night Vibes!";
      break;
    }

    return {
      text: text,
      url: url,
      hashtags: hashtags
    };
  }

  function trackShare(type) {
    if (!type) { return; }
    var store = _getShareStore();
    store[type] = (store[type] || 0) + 1;
    _writeShareStore(store);
  }

  function getShareStats() {
    return _getShareStore();
  }

  /* ─── 6. Onboarding Flow (global) ─── */

  function _getOnboardingStore() {
    return _read(ONBOARDING_KEY) || { completedSteps: [] };
  }

  function _writeOnboardingStore(store) {
    _write(ONBOARDING_KEY, store);
  }

  function getOnboardingStep() {
    var store = _getOnboardingStore();
    var completed = store.completedSteps || [];
    for (var i = 0; i < ONBOARDING_STEPS.length; i++) {
      if (completed.indexOf(ONBOARDING_STEPS[i].step) === -1) {
        return ONBOARDING_STEPS[i].step;
      }
    }
    return null; // all complete
  }

  function completeOnboardingStep(step) {
    if (typeof step !== "number" || step < 1 || step > ONBOARDING_STEPS.length) {
      return false;
    }
    var store = _getOnboardingStore();
    var completed = store.completedSteps || [];
    if (completed.indexOf(step) === -1) {
      completed.push(step);
    }
    store.completedSteps = completed;
    _writeOnboardingStore(store);
    return true;
  }

  function isOnboardingComplete() {
    var store = _getOnboardingStore();
    var completed = store.completedSteps || [];
    return completed.length >= ONBOARDING_STEPS.length;
  }

  function resetOnboarding() {
    _writeOnboardingStore({ completedSteps: [] });
  }

  /* ─── Exports ─── */

  exports.MAX_REFERRAL_REWARDS = MAX_REFERRAL_REWARDS;
  exports.ONBOARDING_STEPS = ONBOARDING_STEPS;

  // Referral System
  exports.generateReferralCode = generateReferralCode;
  exports.getReferralLink = getReferralLink;
  exports.trackReferral = trackReferral;
  exports.getReferralStats = getReferralStats;
  exports.getReferralRewards = getReferralRewards;

  // City Nomination
  exports.nominateCity = nominateCity;
  exports.getNominations = getNominations;
  exports.voteForNomination = voteForNomination;
  exports.getTopNominations = getTopNominations;
  exports.isDuplicate = isDuplicate;

  // SEO Metadata
  exports.generateCityMeta = generateCityMeta;
  exports.generateVenueMeta = generateVenueMeta;
  exports.generateBreadcrumbs = generateBreadcrumbs;

  // PWA Install Prompts
  exports.shouldShowInstallPrompt = shouldShowInstallPrompt;
  exports.recordVisit = recordVisit;
  exports.dismissInstallPrompt = dismissInstallPrompt;
  exports.isAppInstalled = isAppInstalled;
  exports.getInstallStats = getInstallStats;

  // Share & Viral Mechanics
  exports.generateShareContent = generateShareContent;
  exports.trackShare = trackShare;
  exports.getShareStats = getShareStats;

  // Onboarding Flow
  exports.getOnboardingStep = getOnboardingStep;
  exports.completeOnboardingStep = completeOnboardingStep;
  exports.isOnboardingComplete = isOnboardingComplete;
  exports.resetOnboarding = resetOnboarding;

})(typeof module !== "undefined" ? module.exports : (window.LNVGrowthEngine = {}));
