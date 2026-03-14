import { describe, it, expect, beforeEach } from "vitest";

const store = {};
const mockLocalStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach(k => { delete store[k]; }); },
};
if (typeof globalThis !== "undefined") globalThis.localStorage = mockLocalStorage;

import {
  STORAGE_KEY,
  claimVenue,
  getClaimStatus,
  listClaims,
  addSpecial,
  getActiveSpecials,
  getAllActiveSpecials,
  createCrawl,
  getCrawl,
  listCrawls,
  setFeatured,
  addVenueResponse,
  getVenueResponses,
  redeemDeal,
  getRedemptionCount,
  hasRedeemed,
  trackView,
  getViewCount,
  getTopViewed,
} from "../lib/venue-owner.js";

beforeEach(() => {
  Object.keys(store).forEach(k => { delete store[k]; });
});

/* ═══════════════════════════════════════════
 * STORAGE_KEY
 * ═══════════════════════════════════════════ */

describe("STORAGE_KEY", () => {
  it("is a non-empty string", () => {
    expect(typeof STORAGE_KEY).toBe("string");
    expect(STORAGE_KEY.length).toBeGreaterThan(0);
  });
});

/* ═══════════════════════════════════════════
 * 1. Venue Claims
 * ═══════════════════════════════════════════ */

describe("claimVenue", () => {
  it("creates a pending claim with correct fields", () => {
    const claim = claimVenue("The Hideout", {
      name: "Alice", email: "alice@example.com", role: "owner"
    });
    expect(claim.venueName).toBe("The Hideout");
    expect(claim.status).toBe("pending");
    expect(claim.ownerInfo.name).toBe("Alice");
    expect(claim.ownerInfo.email).toBe("alice@example.com");
    expect(claim.ownerInfo.role).toBe("owner");
    expect(claim.id).toBeTruthy();
    expect(claim.claimedAt).toBeTruthy();
  });

  it("accepts manager role", () => {
    const claim = claimVenue("Bar X", {
      name: "Bob", email: "bob@test.com", role: "manager"
    });
    expect(claim.ownerInfo.role).toBe("manager");
  });

  it("accepts promoter role", () => {
    const claim = claimVenue("Bar X", {
      name: "Carol", email: "carol@test.com", role: "promoter"
    });
    expect(claim.ownerInfo.role).toBe("promoter");
  });

  it("throws on invalid role", () => {
    expect(() => claimVenue("Bar X", {
      name: "Dan", email: "dan@test.com", role: "dj"
    })).toThrow("role must be one of");
  });

  it("throws on missing venueName", () => {
    expect(() => claimVenue("", { name: "A", email: "a@b.c", role: "owner" }))
      .toThrow("venueName is required");
  });

  it("throws on missing ownerInfo fields", () => {
    expect(() => claimVenue("Bar X", { name: "A" }))
      .toThrow("ownerInfo requires");
  });

  it("allows multiple claims for the same venue", () => {
    claimVenue("Bar X", { name: "A", email: "a@b.c", role: "owner" });
    claimVenue("Bar X", { name: "B", email: "b@b.c", role: "manager" });
    const all = listClaims();
    const barX = all.filter(c => c.venueName === "Bar X");
    expect(barX).toHaveLength(2);
  });
});

describe("getClaimStatus", () => {
  it("returns null for unclaimed venue", () => {
    expect(getClaimStatus("Nonexistent")).toBeNull();
  });

  it("returns the latest claim for a venue", () => {
    claimVenue("Bar X", { name: "A", email: "a@b.c", role: "owner" });
    claimVenue("Bar X", { name: "B", email: "b@b.c", role: "manager" });
    const status = getClaimStatus("Bar X");
    expect(status.ownerInfo.name).toBe("B");
  });

  it("returns claim with pending status", () => {
    claimVenue("Bar Y", { name: "C", email: "c@d.e", role: "promoter" });
    const status = getClaimStatus("Bar Y");
    expect(status.status).toBe("pending");
  });
});

describe("listClaims", () => {
  it("returns empty array when no claims", () => {
    expect(listClaims()).toEqual([]);
  });

  it("returns all claims across venues", () => {
    claimVenue("Bar A", { name: "A", email: "a@b.c", role: "owner" });
    claimVenue("Bar B", { name: "B", email: "b@b.c", role: "manager" });
    claimVenue("Bar A", { name: "C", email: "c@b.c", role: "promoter" });
    const claims = listClaims();
    expect(claims).toHaveLength(3);
  });
});

/* ═══════════════════════════════════════════
 * 2. Specials & Promotions
 * ═══════════════════════════════════════════ */

describe("addSpecial", () => {
  it("creates a special with generated id", () => {
    const s = addSpecial("Bar X", {
      title: "Half-price cocktails",
      description: "All cocktails 50% off",
      validFrom: "2025-01-01T00:00:00Z",
      validUntil: "2030-12-31T23:59:59Z",
      type: "drink"
    });
    expect(s.id).toBeTruthy();
    expect(s.title).toBe("Half-price cocktails");
    expect(s.type).toBe("drink");
    expect(s.venueName).toBe("Bar X");
  });

  it("accepts all valid types", () => {
    const types = ["drink", "food", "cover", "event", "other"];
    types.forEach(type => {
      const s = addSpecial("Bar " + type, { title: "Test", type: type });
      expect(s.type).toBe(type);
    });
  });

  it("throws on invalid type", () => {
    expect(() => addSpecial("Bar X", { title: "T", type: "invalid" }))
      .toThrow("type must be one of");
  });

  it("throws on missing title", () => {
    expect(() => addSpecial("Bar X", { type: "drink" }))
      .toThrow("special requires title and type");
  });

  it("throws on missing venueName", () => {
    expect(() => addSpecial("", { title: "T", type: "drink" }))
      .toThrow("venueName is required");
  });

  it("defaults description to empty string", () => {
    const s = addSpecial("Bar X", { title: "T", type: "drink" });
    expect(s.description).toBe("");
  });
});

describe("getActiveSpecials", () => {
  it("returns empty array for venue with no specials", () => {
    expect(getActiveSpecials("No Specials")).toEqual([]);
  });

  it("returns active specials only", () => {
    addSpecial("Bar X", {
      title: "Active",
      type: "drink",
      validFrom: "2020-01-01T00:00:00Z",
      validUntil: "2099-12-31T23:59:59Z"
    });
    addSpecial("Bar X", {
      title: "Expired",
      type: "food",
      validFrom: "2020-01-01T00:00:00Z",
      validUntil: "2020-06-01T00:00:00Z"
    });
    const active = getActiveSpecials("Bar X");
    expect(active).toHaveLength(1);
    expect(active[0].title).toBe("Active");
  });

  it("excludes future specials (validFrom in the future)", () => {
    addSpecial("Bar X", {
      title: "Future",
      type: "event",
      validFrom: "2099-01-01T00:00:00Z",
      validUntil: "2099-12-31T23:59:59Z"
    });
    expect(getActiveSpecials("Bar X")).toHaveLength(0);
  });

  it("includes specials with no validUntil (open-ended)", () => {
    addSpecial("Bar X", {
      title: "Forever",
      type: "cover",
      validFrom: "2020-01-01T00:00:00Z"
    });
    const active = getActiveSpecials("Bar X");
    expect(active).toHaveLength(1);
    expect(active[0].title).toBe("Forever");
  });
});

describe("getAllActiveSpecials", () => {
  it("returns empty object when no specials", () => {
    expect(getAllActiveSpecials()).toEqual({});
  });

  it("groups active specials by venue", () => {
    addSpecial("Bar A", {
      title: "A special",
      type: "drink",
      validFrom: "2020-01-01T00:00:00Z",
      validUntil: "2099-12-31T23:59:59Z"
    });
    addSpecial("Bar B", {
      title: "B special",
      type: "food",
      validFrom: "2020-01-01T00:00:00Z",
      validUntil: "2099-12-31T23:59:59Z"
    });
    const grouped = getAllActiveSpecials();
    expect(Object.keys(grouped)).toHaveLength(2);
    expect(grouped["Bar A"]).toHaveLength(1);
    expect(grouped["Bar B"]).toHaveLength(1);
  });

  it("excludes venues with only expired specials", () => {
    addSpecial("Bar C", {
      title: "Old",
      type: "drink",
      validFrom: "2020-01-01T00:00:00Z",
      validUntil: "2020-06-01T00:00:00Z"
    });
    const grouped = getAllActiveSpecials();
    expect(grouped["Bar C"]).toBeUndefined();
  });
});

/* ═══════════════════════════════════════════
 * 3. Curated Crawls
 * ═══════════════════════════════════════════ */

describe("createCrawl", () => {
  it("creates a crawl with all fields", () => {
    const crawl = createCrawl({
      title: "Capitol Hill Hop",
      description: "Best bars on the hill",
      curator: "Alice",
      stops: [
        { venueName: "Bar A", note: "Start here", order: 1 },
        { venueName: "Bar B", note: "Great cocktails", order: 2 }
      ],
      theme: "cocktails",
      estimatedDuration: 120,
      city: "seattle"
    });
    expect(crawl.id).toBeTruthy();
    expect(crawl.title).toBe("Capitol Hill Hop");
    expect(crawl.stops).toHaveLength(2);
    expect(crawl.featured).toBe(false);
    expect(crawl.city).toBe("seattle");
    expect(crawl.estimatedDuration).toBe(120);
  });

  it("throws on missing title", () => {
    expect(() => createCrawl({ curator: "A", stops: [{ venueName: "B" }] }))
      .toThrow("title and curator");
  });

  it("throws on empty stops", () => {
    expect(() => createCrawl({ title: "T", curator: "A", stops: [] }))
      .toThrow("at least one stop");
  });

  it("throws on missing stops", () => {
    expect(() => createCrawl({ title: "T", curator: "A" }))
      .toThrow("at least one stop");
  });

  it("defaults optional fields", () => {
    const crawl = createCrawl({
      title: "Minimal",
      curator: "Bob",
      stops: [{ venueName: "Bar A" }]
    });
    expect(crawl.description).toBe("");
    expect(crawl.theme).toBe("");
    expect(crawl.estimatedDuration).toBe(0);
    expect(crawl.city).toBe("");
  });
});

describe("getCrawl", () => {
  it("returns crawl by id", () => {
    const created = createCrawl({
      title: "Test", curator: "A", stops: [{ venueName: "B" }]
    });
    const found = getCrawl(created.id);
    expect(found).not.toBeNull();
    expect(found.title).toBe("Test");
  });

  it("returns null for nonexistent id", () => {
    expect(getCrawl("nonexistent")).toBeNull();
  });
});

describe("listCrawls", () => {
  it("returns empty array when no crawls", () => {
    expect(listCrawls()).toEqual([]);
  });

  it("returns all crawls when no city filter", () => {
    createCrawl({ title: "A", curator: "X", stops: [{ venueName: "B" }], city: "seattle" });
    createCrawl({ title: "B", curator: "X", stops: [{ venueName: "C" }], city: "portland" });
    expect(listCrawls()).toHaveLength(2);
  });

  it("filters by city slug", () => {
    createCrawl({ title: "A", curator: "X", stops: [{ venueName: "B" }], city: "seattle" });
    createCrawl({ title: "B", curator: "X", stops: [{ venueName: "C" }], city: "portland" });
    const seattle = listCrawls("seattle");
    expect(seattle).toHaveLength(1);
    expect(seattle[0].title).toBe("A");
  });

  it("returns empty array for city with no crawls", () => {
    createCrawl({ title: "A", curator: "X", stops: [{ venueName: "B" }], city: "seattle" });
    expect(listCrawls("austin")).toEqual([]);
  });
});

describe("setFeatured", () => {
  it("sets featured flag to true", () => {
    const crawl = createCrawl({
      title: "Feature Me", curator: "A", stops: [{ venueName: "B" }]
    });
    const updated = setFeatured(crawl.id, true);
    expect(updated.featured).toBe(true);
  });

  it("sets featured flag to false", () => {
    const crawl = createCrawl({
      title: "Unfeature Me", curator: "A", stops: [{ venueName: "B" }]
    });
    setFeatured(crawl.id, true);
    const updated = setFeatured(crawl.id, false);
    expect(updated.featured).toBe(false);
  });

  it("returns null for nonexistent crawl", () => {
    expect(setFeatured("nonexistent", true)).toBeNull();
  });

  it("persists featured state", () => {
    const crawl = createCrawl({
      title: "Persist", curator: "A", stops: [{ venueName: "B" }]
    });
    setFeatured(crawl.id, true);
    const retrieved = getCrawl(crawl.id);
    expect(retrieved.featured).toBe(true);
  });
});

/* ═══════════════════════════════════════════
 * 4. Venue Responses
 * ═══════════════════════════════════════════ */

describe("addVenueResponse", () => {
  it("adds a response with auto-set timestamp", () => {
    const resp = addVenueResponse("Bar X", {
      text: "Thanks for visiting!", author: "Owner Bob"
    });
    expect(resp.text).toBe("Thanks for visiting!");
    expect(resp.author).toBe("Owner Bob");
    expect(resp.timestamp).toBeTruthy();
    expect(resp.id).toBeTruthy();
  });

  it("throws on missing text", () => {
    expect(() => addVenueResponse("Bar X", { author: "A" }))
      .toThrow("response requires text and author");
  });

  it("throws on missing author", () => {
    expect(() => addVenueResponse("Bar X", { text: "Hi" }))
      .toThrow("response requires text and author");
  });

  it("throws on missing venueName", () => {
    expect(() => addVenueResponse("", { text: "Hi", author: "A" }))
      .toThrow("venueName is required");
  });

  it("enforces 24-hour rate limit per venue", () => {
    addVenueResponse("Bar X", { text: "First", author: "A" });
    expect(() => addVenueResponse("Bar X", { text: "Second", author: "A" }))
      .toThrow("Rate limited");
  });

  it("allows responses to different venues within rate limit window", () => {
    addVenueResponse("Bar X", { text: "Hi", author: "A" });
    const resp = addVenueResponse("Bar Y", { text: "Hello", author: "A" });
    expect(resp.text).toBe("Hello");
  });
});

describe("getVenueResponses", () => {
  it("returns empty array for venue with no responses", () => {
    expect(getVenueResponses("Bar X")).toEqual([]);
  });

  it("returns all responses for a venue", () => {
    addVenueResponse("Bar X", { text: "Response 1", author: "A" });
    // Find the actual storage key used (may be city-scoped)
    const storeKey = Object.keys(store).find(k => k.includes("responses"));
    const data = JSON.parse(store[storeKey]);
    data["Bar X"][0].timestamp = "2020-01-01T00:00:00Z";
    store[storeKey] = JSON.stringify(data);
    addVenueResponse("Bar X", { text: "Response 2", author: "B" });
    const responses = getVenueResponses("Bar X");
    expect(responses).toHaveLength(2);
  });
});

/* ═══════════════════════════════════════════
 * 5. Deal Tracking
 * ═══════════════════════════════════════════ */

describe("redeemDeal", () => {
  it("records a redemption", () => {
    const record = redeemDeal("special-1", "Bar X");
    expect(record.specialId).toBe("special-1");
    expect(record.venueName).toBe("Bar X");
    expect(record.redeemedAt).toBeTruthy();
    expect(record.deviceId).toBeTruthy();
  });

  it("throws on missing specialId", () => {
    expect(() => redeemDeal("", "Bar X")).toThrow("specialId is required");
  });

  it("throws on missing venueName", () => {
    expect(() => redeemDeal("special-1", "")).toThrow("venueName is required");
  });

  it("allows multiple redemptions of same deal", () => {
    redeemDeal("special-1", "Bar X");
    redeemDeal("special-1", "Bar X");
    expect(getRedemptionCount("special-1")).toBe(2);
  });
});

describe("getRedemptionCount", () => {
  it("returns 0 for unredeemed deal", () => {
    expect(getRedemptionCount("nonexistent")).toBe(0);
  });

  it("returns correct count after multiple redemptions", () => {
    redeemDeal("deal-a", "Bar X");
    redeemDeal("deal-a", "Bar Y");
    redeemDeal("deal-a", "Bar Z");
    expect(getRedemptionCount("deal-a")).toBe(3);
  });
});

describe("hasRedeemed", () => {
  it("returns false for unredeemed deal", () => {
    expect(hasRedeemed("nonexistent")).toBe(false);
  });

  it("returns true after redeeming", () => {
    redeemDeal("deal-b", "Bar X");
    expect(hasRedeemed("deal-b")).toBe(true);
  });
});

/* ═══════════════════════════════════════════
 * 6. Analytics
 * ═══════════════════════════════════════════ */

describe("trackView", () => {
  it("increments view count", () => {
    trackView("Bar X");
    expect(getViewCount("Bar X")).toBe(1);
    trackView("Bar X");
    expect(getViewCount("Bar X")).toBe(2);
  });

  it("returns current count after tracking", () => {
    expect(trackView("Bar Y")).toBe(1);
    expect(trackView("Bar Y")).toBe(2);
  });

  it("handles undefined venueName gracefully", () => {
    expect(trackView(undefined)).toBeUndefined();
  });

  it("handles empty string venueName gracefully", () => {
    expect(trackView("")).toBeUndefined();
  });
});

describe("getViewCount", () => {
  it("returns 0 for untracked venue", () => {
    expect(getViewCount("Nonexistent")).toBe(0);
  });

  it("returns correct count", () => {
    trackView("Bar X");
    trackView("Bar X");
    trackView("Bar X");
    expect(getViewCount("Bar X")).toBe(3);
  });
});

describe("getTopViewed", () => {
  it("returns empty array when no views", () => {
    expect(getTopViewed(5)).toEqual([]);
  });

  it("returns venues sorted by view count descending", () => {
    trackView("Bar A");
    trackView("Bar B");
    trackView("Bar B");
    trackView("Bar C");
    trackView("Bar C");
    trackView("Bar C");
    const top = getTopViewed(10);
    expect(top[0].venueName).toBe("Bar C");
    expect(top[0].views).toBe(3);
    expect(top[1].venueName).toBe("Bar B");
    expect(top[1].views).toBe(2);
    expect(top[2].venueName).toBe("Bar A");
    expect(top[2].views).toBe(1);
  });

  it("respects limit parameter", () => {
    trackView("Bar A");
    trackView("Bar B");
    trackView("Bar C");
    const top = getTopViewed(2);
    expect(top).toHaveLength(2);
  });

  it("returns all when no limit", () => {
    trackView("Bar A");
    trackView("Bar B");
    const top = getTopViewed();
    expect(top).toHaveLength(2);
  });
});

/* ═══════════════════════════════════════════
 * Edge Cases
 * ═══════════════════════════════════════════ */

describe("edge cases", () => {
  it("handles claims with empty storage", () => {
    Object.keys(store).forEach(k => { delete store[k]; });
    expect(listClaims()).toEqual([]);
  });

  it("handles specials for venue with no specials array", () => {
    expect(getActiveSpecials("Ghost Venue")).toEqual([]);
  });

  it("handles getCrawl with empty storage", () => {
    expect(getCrawl("any-id")).toBeNull();
  });

  it("handles venue responses for unresponded venue", () => {
    expect(getVenueResponses("Silent Venue")).toEqual([]);
  });

  it("handles getRedemptionCount for never-redeemed special", () => {
    expect(getRedemptionCount("phantom-deal")).toBe(0);
  });

  it("handles getViewCount for never-viewed venue", () => {
    expect(getViewCount("Invisible Bar")).toBe(0);
  });

  it("handles getTopViewed with zero limit", () => {
    trackView("Bar A");
    // limit=0 is not > 0, so returns all
    const top = getTopViewed(0);
    expect(top).toHaveLength(1);
  });

  it("crawl stops default note and order", () => {
    const crawl = createCrawl({
      title: "Minimal Stops",
      curator: "Test",
      stops: [{ venueName: "Bar A" }]
    });
    expect(crawl.stops[0].note).toBe("");
    expect(crawl.stops[0].order).toBe(0);
  });

  it("duplicate claim for same venue by same owner is allowed", () => {
    claimVenue("Bar X", { name: "A", email: "a@b.c", role: "owner" });
    claimVenue("Bar X", { name: "A", email: "a@b.c", role: "owner" });
    const claims = listClaims().filter(c => c.venueName === "Bar X");
    expect(claims).toHaveLength(2);
  });

  it("special with null ownerInfo throws", () => {
    expect(() => claimVenue("Bar X", null)).toThrow();
  });

  it("createCrawl with non-array stops throws", () => {
    expect(() => createCrawl({ title: "T", curator: "A", stops: "not-array" }))
      .toThrow("at least one stop");
  });

  it("addVenueResponse with null response throws", () => {
    expect(() => addVenueResponse("Bar X", null))
      .toThrow("response requires text and author");
  });

  it("multiple venues tracked independently in analytics", () => {
    trackView("Bar A");
    trackView("Bar A");
    trackView("Bar B");
    expect(getViewCount("Bar A")).toBe(2);
    expect(getViewCount("Bar B")).toBe(1);
  });

  it("getTopViewed returns correct structure", () => {
    trackView("Bar A");
    const top = getTopViewed(1);
    expect(top[0]).toHaveProperty("venueName");
    expect(top[0]).toHaveProperty("views");
  });
});
