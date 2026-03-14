import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  MAX_REFERRAL_REWARDS,
  ONBOARDING_STEPS,
  generateReferralCode,
  getReferralLink,
  trackReferral,
  getReferralStats,
  getReferralRewards,
  nominateCity,
  getNominations,
  voteForNomination,
  getTopNominations,
  isDuplicate,
  generateCityMeta,
  generateVenueMeta,
  generateBreadcrumbs,
  shouldShowInstallPrompt,
  recordVisit,
  dismissInstallPrompt,
  isAppInstalled,
  getInstallStats,
  generateShareContent,
  trackShare,
  getShareStats,
  getOnboardingStep,
  completeOnboardingStep,
  isOnboardingComplete,
  resetOnboarding,
} from "../lib/growth-engine.js";

// Mock localStorage
const store = {};
const localStorageMock = {
  getItem: vi.fn((key) => store[key] || null),
  setItem: vi.fn((key, val) => { store[key] = val; }),
  removeItem: vi.fn((key) => { delete store[key]; }),
  clear: vi.fn(() => { for (const k in store) delete store[k]; }),
};
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true });

// Mock window.matchMedia for PWA tests
function mockMatchMedia(matches) {
  globalThis.window = globalThis.window || {};
  globalThis.window.matchMedia = vi.fn(() => ({ matches }));
}

beforeEach(() => {
  localStorageMock.clear();
  vi.restoreAllMocks();
  // Reset matchMedia
  if (globalThis.window) {
    delete globalThis.window.matchMedia;
  }
});

/* ═══════════════════════════════════════════════════════════
   1. Referral System
   ═══════════════════════════════════════════════════════════ */

describe("Referral System", () => {
  it("generates a referral code for a username", () => {
    const code = generateReferralCode("alice");
    expect(code).toBeTruthy();
    expect(code).toMatch(/^LNV-ALICE-[A-Z0-9]{4}$/);
  });

  it("returns the same code if called again for same user", () => {
    const code1 = generateReferralCode("bob");
    const code2 = generateReferralCode("bob");
    expect(code1).toBe(code2);
  });

  it("returns null for empty username", () => {
    expect(generateReferralCode("")).toBeNull();
    expect(generateReferralCode(null)).toBeNull();
    expect(generateReferralCode(undefined)).toBeNull();
  });

  it("returns null for non-string username", () => {
    expect(generateReferralCode(123)).toBeNull();
  });

  it("strips special characters from username in code", () => {
    const code = generateReferralCode("user@name!");
    expect(code).toMatch(/^LNV-USERNAME-[A-Z0-9]{4}$/);
  });

  it("truncates long usernames to 8 chars in code", () => {
    const code = generateReferralCode("verylongusername");
    expect(code).toMatch(/^LNV-VERYLONG-[A-Z0-9]{4}$/);
  });

  it("getReferralLink returns valid URL with code", () => {
    const link = getReferralLink("LNV-TEST-ABCD");
    expect(link).toBe("https://latenightvibes.app?ref=LNV-TEST-ABCD");
  });

  it("getReferralLink returns null for empty code", () => {
    expect(getReferralLink("")).toBeNull();
    expect(getReferralLink(null)).toBeNull();
  });

  it("getReferralLink encodes special characters", () => {
    const link = getReferralLink("CODE WITH SPACE");
    expect(link).toContain("CODE%20WITH%20SPACE");
  });

  it("trackReferral increments counts", () => {
    const code = generateReferralCode("carol");
    expect(trackReferral(code)).toBe(true);
    const stats = getReferralStats("carol");
    expect(stats.totalReferrals).toBe(1);
    expect(stats.successfulInstalls).toBe(1);
  });

  it("trackReferral returns false for unknown code", () => {
    expect(trackReferral("FAKE-CODE")).toBe(false);
  });

  it("trackReferral returns false for empty code", () => {
    expect(trackReferral("")).toBe(false);
    expect(trackReferral(null)).toBe(false);
  });

  it("getReferralStats returns null for unknown user", () => {
    expect(getReferralStats("nobody")).toBeNull();
  });

  it("getReferralStats returns correct structure", () => {
    generateReferralCode("dave");
    const stats = getReferralStats("dave");
    expect(stats).toHaveProperty("code");
    expect(stats).toHaveProperty("totalReferrals");
    expect(stats).toHaveProperty("successfulInstalls");
    expect(stats.totalReferrals).toBe(0);
    expect(stats.successfulInstalls).toBe(0);
  });

  it("getReferralStats returns null for invalid input", () => {
    expect(getReferralStats("")).toBeNull();
    expect(getReferralStats(null)).toBeNull();
  });

  it("multiple referrals accumulate", () => {
    const code = generateReferralCode("eve");
    trackReferral(code);
    trackReferral(code);
    trackReferral(code);
    const stats = getReferralStats("eve");
    expect(stats.totalReferrals).toBe(3);
    expect(stats.successfulInstalls).toBe(3);
  });
});

describe("Referral Rewards", () => {
  it("returns empty array with no referrals", () => {
    generateReferralCode("newbie");
    expect(getReferralRewards("newbie")).toEqual([]);
  });

  it("unlocks early-adopter at 1 referral", () => {
    const code = generateReferralCode("r1");
    trackReferral(code);
    expect(getReferralRewards("r1")).toEqual(["early-adopter"]);
  });

  it("unlocks connector at 3 referrals", () => {
    const code = generateReferralCode("r3");
    for (let i = 0; i < 3; i++) trackReferral(code);
    const rewards = getReferralRewards("r3");
    expect(rewards).toContain("early-adopter");
    expect(rewards).toContain("connector");
    expect(rewards).toHaveLength(2);
  });

  it("unlocks ambassador at 10 referrals", () => {
    const code = generateReferralCode("r10");
    for (let i = 0; i < 10; i++) trackReferral(code);
    const rewards = getReferralRewards("r10");
    expect(rewards).toContain("ambassador");
    expect(rewards).toHaveLength(3);
  });

  it("unlocks legend at 25 referrals", () => {
    const code = generateReferralCode("r25");
    for (let i = 0; i < 25; i++) trackReferral(code);
    const rewards = getReferralRewards("r25");
    expect(rewards).toContain("legend");
    expect(rewards).toHaveLength(4);
  });

  it("returns empty for unknown user", () => {
    expect(getReferralRewards("ghost")).toEqual([]);
  });

  it("returns empty for invalid input", () => {
    expect(getReferralRewards("")).toEqual([]);
    expect(getReferralRewards(null)).toEqual([]);
  });

  it("MAX_REFERRAL_REWARDS is defined correctly", () => {
    expect(MAX_REFERRAL_REWARDS).toHaveLength(4);
    expect(MAX_REFERRAL_REWARDS[0]).toEqual({ threshold: 1, reward: "early-adopter" });
    expect(MAX_REFERRAL_REWARDS[3]).toEqual({ threshold: 25, reward: "legend" });
  });
});

/* ═══════════════════════════════════════════════════════════
   2. City Nominations
   ═══════════════════════════════════════════════════════════ */

describe("City Nominations", () => {
  it("creates a nomination with all required fields", () => {
    const nom = nominateCity({
      name: "Austin",
      state: "TX",
      nominatorName: "alice",
      reason: "Great nightlife",
    });
    expect(nom).toBeTruthy();
    expect(nom.name).toBe("Austin");
    expect(nom.state).toBe("TX");
    expect(nom.nominatorName).toBe("alice");
    expect(nom.reason).toBe("Great nightlife");
    expect(nom.id).toMatch(/^nom-/);
    expect(nom.votes).toBe(1);
  });

  it("accepts optional population", () => {
    const nom = nominateCity({
      name: "Austin",
      state: "TX",
      nominatorName: "bob",
      reason: "Fun",
      population: 950000,
    });
    expect(nom.population).toBe(950000);
  });

  it("returns null for missing required fields", () => {
    expect(nominateCity(null)).toBeNull();
    expect(nominateCity({})).toBeNull();
    expect(nominateCity({ name: "Austin" })).toBeNull();
    expect(nominateCity({ name: "Austin", state: "TX" })).toBeNull();
    expect(nominateCity({ name: "Austin", state: "TX", nominatorName: "a" })).toBeNull();
  });

  it("rejects duplicate city nominations", () => {
    nominateCity({ name: "Denver", state: "CO", nominatorName: "a", reason: "r" });
    const dup = nominateCity({ name: "Denver", state: "CO", nominatorName: "b", reason: "s" });
    expect(dup).toBeNull();
  });

  it("isDuplicate is case-insensitive", () => {
    nominateCity({ name: "Portland", state: "OR", nominatorName: "a", reason: "r" });
    expect(isDuplicate("PORTLAND", "or")).toBe(true);
    expect(isDuplicate("portland", "OR")).toBe(true);
  });

  it("isDuplicate returns false for non-existent city", () => {
    expect(isDuplicate("Atlantis", "OC")).toBe(false);
  });

  it("isDuplicate returns false for empty input", () => {
    expect(isDuplicate("", "")).toBe(false);
    expect(isDuplicate(null, null)).toBe(false);
  });

  it("getNominations returns all sorted by votes", () => {
    nominateCity({ name: "CityA", state: "AA", nominatorName: "a", reason: "r" });
    nominateCity({ name: "CityB", state: "BB", nominatorName: "a", reason: "r" });
    const noms = getNominations();
    expect(noms).toHaveLength(2);
    expect(noms[0].votes).toBeGreaterThanOrEqual(noms[1].votes);
  });

  it("voteForNomination increments vote count", () => {
    const nom = nominateCity({ name: "Miami", state: "FL", nominatorName: "a", reason: "r" });
    voteForNomination(nom.id, "user1");
    const noms = getNominations();
    const miami = noms.find((n) => n.name === "Miami");
    expect(miami.votes).toBe(2);
  });

  it("voteForNomination prevents double voting", () => {
    const nom = nominateCity({ name: "Nashville", state: "TN", nominatorName: "a", reason: "r" });
    expect(voteForNomination(nom.id, "user1")).toBe(true);
    expect(voteForNomination(nom.id, "user1")).toBe(false);
    const noms = getNominations();
    const nash = noms.find((n) => n.name === "Nashville");
    expect(nash.votes).toBe(2); // initial 1 + 1 vote
  });

  it("voteForNomination returns false for nonexistent city", () => {
    expect(voteForNomination("nom-fake", "user1")).toBe(false);
  });

  it("voteForNomination returns false for empty id", () => {
    expect(voteForNomination("", "user1")).toBe(false);
    expect(voteForNomination(null, "user1")).toBe(false);
  });

  it("different users can vote for same city", () => {
    const nom = nominateCity({ name: "Tampa", state: "FL", nominatorName: "a", reason: "r" });
    voteForNomination(nom.id, "user1");
    voteForNomination(nom.id, "user2");
    voteForNomination(nom.id, "user3");
    const noms = getNominations();
    const tampa = noms.find((n) => n.name === "Tampa");
    expect(tampa.votes).toBe(4); // 1 initial + 3
  });

  it("getTopNominations respects limit", () => {
    nominateCity({ name: "C1", state: "S1", nominatorName: "a", reason: "r" });
    nominateCity({ name: "C2", state: "S2", nominatorName: "a", reason: "r" });
    nominateCity({ name: "C3", state: "S3", nominatorName: "a", reason: "r" });
    const top = getTopNominations(2);
    expect(top).toHaveLength(2);
  });

  it("getTopNominations defaults to 10", () => {
    const top = getTopNominations();
    expect(top.length).toBeLessThanOrEqual(10);
  });
});

/* ═══════════════════════════════════════════════════════════
   3. SEO Metadata
   ═══════════════════════════════════════════════════════════ */

describe("SEO Metadata", () => {
  const seattleConfig = {
    name: "Seattle",
    slug: "seattle",
    state: "WA",
    lat: 47.6062,
    lng: -122.3321,
    description: "Discover Seattle's best late-night bars and clubs.",
  };

  it("generateCityMeta returns all required fields", () => {
    const meta = generateCityMeta(seattleConfig);
    expect(meta).toHaveProperty("title");
    expect(meta).toHaveProperty("description");
    expect(meta).toHaveProperty("ogTitle");
    expect(meta).toHaveProperty("ogDescription");
    expect(meta).toHaveProperty("canonicalUrl");
    expect(meta).toHaveProperty("jsonLd");
  });

  it("generateCityMeta title includes city name", () => {
    const meta = generateCityMeta(seattleConfig);
    expect(meta.title).toContain("Seattle");
  });

  it("generateCityMeta uses provided description", () => {
    const meta = generateCityMeta(seattleConfig);
    expect(meta.description).toBe(seattleConfig.description);
  });

  it("generateCityMeta canonicalUrl uses slug", () => {
    const meta = generateCityMeta(seattleConfig);
    expect(meta.canonicalUrl).toBe("https://latenightvibes.app/seattle");
  });

  it("generateCityMeta jsonLd includes geo when lat/lng present", () => {
    const meta = generateCityMeta(seattleConfig);
    expect(meta.jsonLd.geo).toBeDefined();
    expect(meta.jsonLd.geo.latitude).toBe(47.6062);
  });

  it("generateCityMeta jsonLd omits geo when no lat/lng", () => {
    const meta = generateCityMeta({ name: "TestCity", slug: "test" });
    expect(meta.jsonLd.geo).toBeUndefined();
  });

  it("generateCityMeta returns null for missing config", () => {
    expect(generateCityMeta(null)).toBeNull();
    expect(generateCityMeta({})).toBeNull();
  });

  it("generateCityMeta generates slug from name when slug missing", () => {
    const meta = generateCityMeta({ name: "New York City" });
    expect(meta.canonicalUrl).toContain("new-york-city");
  });

  it("generateCityMeta generates fallback description", () => {
    const meta = generateCityMeta({ name: "Austin", state: "TX", slug: "austin" });
    expect(meta.description).toContain("Austin");
    expect(meta.description).toContain("TX");
  });

  it("generateVenueMeta returns all required fields", () => {
    const venue = { Name: "The Owl", Area: "Capitol Hill", Category: "Cocktail Bar" };
    const meta = generateVenueMeta(venue, seattleConfig);
    expect(meta).toHaveProperty("title");
    expect(meta).toHaveProperty("description");
    expect(meta).toHaveProperty("ogTitle");
    expect(meta).toHaveProperty("ogDescription");
    expect(meta).toHaveProperty("canonicalUrl");
    expect(meta).toHaveProperty("jsonLd");
  });

  it("generateVenueMeta title includes venue and city", () => {
    const venue = { Name: "The Owl" };
    const meta = generateVenueMeta(venue, seattleConfig);
    expect(meta.title).toContain("The Owl");
    expect(meta.title).toContain("Seattle");
  });

  it("generateVenueMeta canonical URL is properly slugified", () => {
    const venue = { Name: "Joe's Bar & Grill" };
    const meta = generateVenueMeta(venue, seattleConfig);
    expect(meta.canonicalUrl).toContain("/venue/joe-s-bar-grill");
  });

  it("generateVenueMeta returns null for missing venue", () => {
    expect(generateVenueMeta(null, seattleConfig)).toBeNull();
    expect(generateVenueMeta({}, seattleConfig)).toBeNull();
  });

  it("generateVenueMeta jsonLd uses LocalBusiness type", () => {
    const venue = { Name: "Test", Area: "SoDo" };
    const meta = generateVenueMeta(venue, seattleConfig);
    expect(meta.jsonLd["@type"]).toBe("LocalBusiness");
  });

  it("generateBreadcrumbs returns Home as first crumb", () => {
    const crumbs = generateBreadcrumbs(seattleConfig);
    expect(crumbs[0].name).toBe("Home");
    expect(crumbs[0].url).toBe("https://latenightvibes.app");
  });

  it("generateBreadcrumbs includes city", () => {
    const crumbs = generateBreadcrumbs(seattleConfig);
    expect(crumbs).toHaveLength(2);
    expect(crumbs[1].name).toBe("Seattle");
  });

  it("generateBreadcrumbs includes page name when provided", () => {
    const crumbs = generateBreadcrumbs(seattleConfig, "Venues");
    expect(crumbs).toHaveLength(3);
    expect(crumbs[2].name).toBe("Venues");
    expect(crumbs[2].url).toBeNull();
  });

  it("generateBreadcrumbs with no city returns just Home", () => {
    const crumbs = generateBreadcrumbs(null);
    expect(crumbs).toHaveLength(1);
    expect(crumbs[0].name).toBe("Home");
  });
});

/* ═══════════════════════════════════════════════════════════
   4. PWA Install Prompts
   ═══════════════════════════════════════════════════════════ */

describe("PWA Install Prompts", () => {
  it("recordVisit increments visit count", () => {
    expect(recordVisit()).toBe(1);
    expect(recordVisit()).toBe(2);
    expect(recordVisit()).toBe(3);
  });

  it("getInstallStats returns initial state", () => {
    const stats = getInstallStats();
    expect(stats.visitCount).toBe(0);
    expect(stats.dismissed).toBe(false);
    expect(stats.dismissedAt).toBeNull();
  });

  it("getInstallStats reflects visits", () => {
    recordVisit();
    recordVisit();
    const stats = getInstallStats();
    expect(stats.visitCount).toBe(2);
    expect(stats.lastVisit).toBeTruthy();
  });

  it("shouldShowInstallPrompt returns false with < 3 visits", () => {
    recordVisit();
    recordVisit();
    expect(shouldShowInstallPrompt()).toBe(false);
  });

  it("shouldShowInstallPrompt returns true after 3 visits", () => {
    recordVisit();
    recordVisit();
    recordVisit();
    expect(shouldShowInstallPrompt()).toBe(true);
  });

  it("shouldShowInstallPrompt returns false after dismiss within cooldown", () => {
    recordVisit();
    recordVisit();
    recordVisit();
    dismissInstallPrompt();
    expect(shouldShowInstallPrompt()).toBe(false);
  });

  it("shouldShowInstallPrompt returns true after dismiss cooldown expires", () => {
    recordVisit();
    recordVisit();
    recordVisit();
    // Manually set dismissedAt to 8 days ago
    const installStore = JSON.parse(localStorage.getItem("lnv_install_stats"));
    installStore.dismissed = true;
    installStore.dismissedAt = Date.now() - 8 * 24 * 60 * 60 * 1000;
    localStorage.setItem("lnv_install_stats", JSON.stringify(installStore));
    expect(shouldShowInstallPrompt()).toBe(true);
  });

  it("shouldShowInstallPrompt returns false when app installed", () => {
    recordVisit();
    recordVisit();
    recordVisit();
    mockMatchMedia(true); // standalone mode
    expect(shouldShowInstallPrompt()).toBe(false);
  });

  it("isAppInstalled returns false when no matchMedia", () => {
    expect(isAppInstalled()).toBe(false);
  });

  it("isAppInstalled returns true in standalone mode", () => {
    mockMatchMedia(true);
    expect(isAppInstalled()).toBe(true);
  });

  it("isAppInstalled returns false in browser mode", () => {
    mockMatchMedia(false);
    expect(isAppInstalled()).toBe(false);
  });

  it("dismissInstallPrompt records timestamp", () => {
    const before = Date.now();
    dismissInstallPrompt();
    const stats = getInstallStats();
    expect(stats.dismissed).toBe(true);
    expect(stats.dismissedAt).toBeGreaterThanOrEqual(before);
  });
});

/* ═══════════════════════════════════════════════════════════
   5. Share & Viral Mechanics
   ═══════════════════════════════════════════════════════════ */

describe("Share & Viral Mechanics", () => {
  it("generates venue share content", () => {
    const content = generateShareContent("venue", { name: "The Owl", citySlug: "seattle" });
    expect(content.text).toContain("The Owl");
    expect(content.url).toContain("/seattle/venue/the-owl");
    expect(content.hashtags).toContain("LateNightVibes");
    expect(content.hashtags).toContain("NightOut");
  });

  it("generates crawl share content", () => {
    const content = generateShareContent("crawl", { cityName: "Seattle", citySlug: "seattle", planId: "abc123" });
    expect(content.text).toContain("Seattle");
    expect(content.url).toContain("/seattle/plan/abc123");
    expect(content.hashtags).toContain("BarCrawl");
  });

  it("generates achievement share content", () => {
    const content = generateShareContent("achievement", { badge: "Night Owl" });
    expect(content.text).toContain("Night Owl");
    expect(content.url).toContain("/profile");
    expect(content.hashtags).toContain("Achievement");
  });

  it("generates city share content", () => {
    const content = generateShareContent("city", { cityName: "Chicago", citySlug: "chicago" });
    expect(content.text).toContain("Chicago");
    expect(content.url).toContain("/chicago");
    expect(content.hashtags).toContain("CityNightlife");
  });

  it("generates default share content for unknown type", () => {
    const content = generateShareContent("unknown");
    expect(content.text).toContain("Late Night Vibes");
    expect(content.hashtags).toContain("LateNightVibes");
  });

  it("returns null for empty type", () => {
    expect(generateShareContent("")).toBeNull();
    expect(generateShareContent(null)).toBeNull();
  });

  it("handles missing data gracefully", () => {
    const content = generateShareContent("venue");
    expect(content.text).toContain("this spot");
    expect(content.url).toBeTruthy();
  });

  it("trackShare records share events", () => {
    trackShare("venue");
    trackShare("venue");
    trackShare("crawl");
    const stats = getShareStats();
    expect(stats.venue).toBe(2);
    expect(stats.crawl).toBe(1);
  });

  it("getShareStats returns empty object initially", () => {
    const stats = getShareStats();
    expect(Object.keys(stats)).toHaveLength(0);
  });

  it("trackShare ignores empty type", () => {
    trackShare("");
    trackShare(null);
    const stats = getShareStats();
    expect(Object.keys(stats)).toHaveLength(0);
  });
});

/* ═══════════════════════════════════════════════════════════
   6. Onboarding Flow
   ═══════════════════════════════════════════════════════════ */

describe("Onboarding Flow", () => {
  it("ONBOARDING_STEPS has 5 steps", () => {
    expect(ONBOARDING_STEPS).toHaveLength(5);
  });

  it("ONBOARDING_STEPS have correct titles", () => {
    expect(ONBOARDING_STEPS[0].title).toBe("Pick Your City");
    expect(ONBOARDING_STEPS[1].title).toBe("Set Your Vibes");
    expect(ONBOARDING_STEPS[2].title).toBe("Find Your First Spot");
    expect(ONBOARDING_STEPS[3].title).toBe("Join a Squad");
    expect(ONBOARDING_STEPS[4].title).toBe("Enable Notifications");
  });

  it("getOnboardingStep returns 1 initially", () => {
    expect(getOnboardingStep()).toBe(1);
  });

  it("completeOnboardingStep advances to next step", () => {
    completeOnboardingStep(1);
    expect(getOnboardingStep()).toBe(2);
  });

  it("completing all steps returns null for getOnboardingStep", () => {
    for (let i = 1; i <= 5; i++) completeOnboardingStep(i);
    expect(getOnboardingStep()).toBeNull();
  });

  it("isOnboardingComplete returns false initially", () => {
    expect(isOnboardingComplete()).toBe(false);
  });

  it("isOnboardingComplete returns true after all steps", () => {
    for (let i = 1; i <= 5; i++) completeOnboardingStep(i);
    expect(isOnboardingComplete()).toBe(true);
  });

  it("completeOnboardingStep rejects invalid step numbers", () => {
    expect(completeOnboardingStep(0)).toBe(false);
    expect(completeOnboardingStep(6)).toBe(false);
    expect(completeOnboardingStep(-1)).toBe(false);
    expect(completeOnboardingStep("abc")).toBe(false);
  });

  it("completeOnboardingStep is idempotent", () => {
    completeOnboardingStep(1);
    completeOnboardingStep(1);
    expect(getOnboardingStep()).toBe(2);
  });

  it("resetOnboarding clears progress", () => {
    completeOnboardingStep(1);
    completeOnboardingStep(2);
    resetOnboarding();
    expect(getOnboardingStep()).toBe(1);
    expect(isOnboardingComplete()).toBe(false);
  });

  it("steps can be completed out of order", () => {
    completeOnboardingStep(3);
    completeOnboardingStep(5);
    expect(getOnboardingStep()).toBe(1); // first incomplete
    completeOnboardingStep(1);
    expect(getOnboardingStep()).toBe(2);
  });
});

/* ═══════════════════════════════════════════════════════════
   7. Edge Cases
   ═══════════════════════════════════════════════════════════ */

describe("Edge Cases", () => {
  it("referral system handles corrupted localStorage", () => {
    localStorage.setItem("lnv_referrals", "not-json{{{");
    const stats = getReferralStats("anyone");
    expect(stats).toBeNull();
  });

  it("nominations handle corrupted localStorage", () => {
    localStorage.setItem("lnv_nominations", "broken");
    const noms = getNominations();
    expect(Array.isArray(noms)).toBe(true);
  });

  it("install stats handle corrupted localStorage", () => {
    localStorage.setItem("lnv_install_stats", "{{bad");
    const stats = getInstallStats();
    expect(stats).toBeTruthy();
    expect(stats.visitCount).toBe(0);
  });

  it("onboarding handles corrupted localStorage", () => {
    localStorage.setItem("lnv_onboarding", "nope");
    expect(getOnboardingStep()).toBe(1);
  });

  it("share stats handle corrupted localStorage", () => {
    localStorage.setItem("lnv_shares", "broken!!");
    const stats = getShareStats();
    expect(stats).toBeTruthy();
  });

  it("generateVenueMeta works without cityConfig", () => {
    const venue = { Name: "Test Venue" };
    const meta = generateVenueMeta(venue, null);
    expect(meta).toBeTruthy();
    expect(meta.title).toContain("Test Venue");
  });

  it("generateShareContent with venue missing name", () => {
    const content = generateShareContent("venue", { citySlug: "seattle" });
    expect(content.text).toContain("this spot");
  });

  it("generateShareContent crawl without planId", () => {
    const content = generateShareContent("crawl", { citySlug: "seattle" });
    expect(content.url).toContain("/seattle/plan");
    expect(content.url).not.toContain("undefined");
  });
});
