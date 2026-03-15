import { describe, it, expect, beforeEach, vi } from "vitest";

const store = {};
const mockLocalStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
if (typeof globalThis !== "undefined") globalThis.localStorage = mockLocalStorage;

import {
  addHappyHour,
  getHappyHours,
  getActiveHappyHours,
  removeHappyHour,
  createBudget,
  allocateSpend,
  getBudgetStatus,
  getBudgetHistory,
  createPregamePlan,
  getPregamePlans,
  deletePregamePlan,
  calculateDrinks,
  splitBill,
  createPregameGroup,
  joinGroup,
  rsvp,
  addGroupMessage,
  getGroup,
  getGroupRSVPSummary,
  compareDeals,
  getBestDealsNow,
  saveTemplate,
  getTemplates,
  useTemplate,
  deleteTemplate,
  getPopularTemplates,
} from "../lib/pregame-planner.js";

function clearStore() {
  for (const key in store) {
    delete store[key];
  }
}

const validHH = {
  days: [5, 6],
  startHour: 16,
  endHour: 19,
  deals: [
    { item: "Well Drinks", originalPrice: 12, dealPrice: 6 },
    { item: "Nachos", originalPrice: 14, dealPrice: 8 },
  ],
};

describe("LNVPregamePlanner", () => {
  beforeEach(() => {
    clearStore();
    vi.restoreAllMocks();
  });

  /* ══════════════════════════════════════════
   * 1. Happy Hour Database
   * ══════════════════════════════════════════ */
  describe("addHappyHour", () => {
    it("creates a valid happy hour entry", () => {
      const result = addHappyHour("The Pub", validHH);
      expect(result).not.toBeNull();
      expect(result.days).toEqual([5, 6]);
      expect(result.startHour).toBe(16);
      expect(result.endHour).toBe(19);
      expect(result.deals).toHaveLength(2);
    });

    it("returns null for empty venue name", () => {
      expect(addHappyHour("", validHH)).toBeNull();
      expect(addHappyHour(null, validHH)).toBeNull();
    });

    it("returns null for missing happyHour object", () => {
      expect(addHappyHour("Pub", null)).toBeNull();
      expect(addHappyHour("Pub", "string")).toBeNull();
    });

    it("returns null for empty days array", () => {
      expect(addHappyHour("Pub", { ...validHH, days: [] })).toBeNull();
    });

    it("returns null for invalid day values", () => {
      expect(addHappyHour("Pub", { ...validHH, days: [7] })).toBeNull();
      expect(addHappyHour("Pub", { ...validHH, days: [-1] })).toBeNull();
    });

    it("returns null when startHour >= endHour", () => {
      expect(addHappyHour("Pub", { ...validHH, startHour: 19, endHour: 16 })).toBeNull();
      expect(addHappyHour("Pub", { ...validHH, startHour: 17, endHour: 17 })).toBeNull();
    });

    it("returns null for non-numeric hours", () => {
      expect(addHappyHour("Pub", { ...validHH, startHour: "five" })).toBeNull();
    });

    it("allows happy hour with no deals", () => {
      const result = addHappyHour("Pub", { days: [1], startHour: 15, endHour: 18 });
      expect(result).not.toBeNull();
      expect(result.deals).toEqual([]);
    });

    it("stores multiple happy hours for the same venue", () => {
      addHappyHour("Pub", validHH);
      addHappyHour("Pub", { days: [1, 2], startHour: 14, endHour: 17, deals: [] });
      expect(getHappyHours("Pub")).toHaveLength(2);
    });
  });

  describe("getHappyHours", () => {
    it("returns empty array for unknown venue", () => {
      expect(getHappyHours("Unknown")).toEqual([]);
    });

    it("returns all happy hours for a venue", () => {
      addHappyHour("Bar", validHH);
      const hours = getHappyHours("Bar");
      expect(hours).toHaveLength(1);
      expect(hours[0].startHour).toBe(16);
    });
  });

  describe("getActiveHappyHours", () => {
    it("returns matching happy hours for day and hour", () => {
      addHappyHour("Bar", validHH);
      const active = getActiveHappyHours(5, 17);
      expect(active).toHaveLength(1);
      expect(active[0].venueName).toBe("Bar");
    });

    it("returns empty when no match", () => {
      addHappyHour("Bar", validHH);
      expect(getActiveHappyHours(5, 20)).toEqual([]);
      expect(getActiveHappyHours(1, 17)).toEqual([]);
    });

    it("returns empty for non-numeric inputs", () => {
      expect(getActiveHappyHours("five", 17)).toEqual([]);
    });

    it("does not include endHour (exclusive)", () => {
      addHappyHour("Bar", validHH);
      expect(getActiveHappyHours(5, 19)).toEqual([]);
    });

    it("includes startHour (inclusive)", () => {
      addHappyHour("Bar", validHH);
      expect(getActiveHappyHours(5, 16)).toHaveLength(1);
    });
  });

  describe("removeHappyHour", () => {
    it("removes a happy hour by index", () => {
      addHappyHour("Bar", validHH);
      expect(removeHappyHour("Bar", 0)).toBe(true);
      expect(getHappyHours("Bar")).toEqual([]);
    });

    it("returns false for invalid index", () => {
      addHappyHour("Bar", validHH);
      expect(removeHappyHour("Bar", 5)).toBe(false);
      expect(removeHappyHour("Bar", -1)).toBe(false);
    });

    it("returns false for unknown venue", () => {
      expect(removeHappyHour("Unknown", 0)).toBe(false);
    });
  });

  /* ══════════════════════════════════════════
   * 2. Budget Planning
   * ══════════════════════════════════════════ */
  describe("createBudget", () => {
    it("creates a valid budget", () => {
      const b = createBudget(4, 200);
      expect(b).not.toBeNull();
      expect(b.groupSize).toBe(4);
      expect(b.totalBudget).toBe(200);
      expect(b.perPerson).toBe(50);
      expect(b.allocated).toBe(0);
      expect(b.remaining).toBe(200);
      expect(b.id).toBeDefined();
    });

    it("returns null for invalid groupSize", () => {
      expect(createBudget(0, 100)).toBeNull();
      expect(createBudget(-1, 100)).toBeNull();
      expect(createBudget("four", 100)).toBeNull();
    });

    it("returns null for invalid totalBudget", () => {
      expect(createBudget(4, 0)).toBeNull();
      expect(createBudget(4, -50)).toBeNull();
    });
  });

  describe("allocateSpend", () => {
    it("tracks spending against budget", () => {
      const b = createBudget(2, 100);
      const updated = allocateSpend(b.id, 30, "Drinks round 1");
      expect(updated).not.toBeNull();
      expect(updated.allocated).toBe(30);
      expect(updated.remaining).toBe(70);
    });

    it("returns null when amount exceeds remaining", () => {
      const b = createBudget(2, 100);
      expect(allocateSpend(b.id, 150, "Too much")).toBeNull();
    });

    it("returns null for invalid budget id", () => {
      expect(allocateSpend("fake_id", 10, "test")).toBeNull();
    });

    it("returns null for non-positive amount", () => {
      const b = createBudget(2, 100);
      expect(allocateSpend(b.id, 0, "test")).toBeNull();
      expect(allocateSpend(b.id, -10, "test")).toBeNull();
    });

    it("allows multiple allocations", () => {
      const b = createBudget(2, 100);
      allocateSpend(b.id, 25, "Round 1");
      const updated = allocateSpend(b.id, 25, "Round 2");
      expect(updated.allocated).toBe(50);
      expect(updated.remaining).toBe(50);
    });
  });

  describe("getBudgetStatus", () => {
    it("returns budget by id", () => {
      const b = createBudget(3, 150);
      expect(getBudgetStatus(b.id)).not.toBeNull();
      expect(getBudgetStatus(b.id).totalBudget).toBe(150);
    });

    it("returns null for unknown id", () => {
      expect(getBudgetStatus("unknown")).toBeNull();
    });
  });

  describe("getBudgetHistory", () => {
    it("returns all budgets", () => {
      createBudget(2, 100);
      createBudget(4, 200);
      expect(getBudgetHistory()).toHaveLength(2);
    });

    it("returns empty array when none exist", () => {
      expect(getBudgetHistory()).toEqual([]);
    });
  });

  /* ══════════════════════════════════════════
   * 3. Pregame Plan Builder
   * ══════════════════════════════════════════ */
  describe("createPregamePlan", () => {
    it("creates a plan from active happy hours", () => {
      addHappyHour("Bar A", { days: [5], startHour: 16, endHour: 20, deals: [{ item: "Beer", originalPrice: 8, dealPrice: 4 }] });
      const plan = createPregamePlan({ startTime: 16, endTime: 19, dayOfWeek: 5, groupSize: 2 });
      expect(plan).not.toBeNull();
      expect(plan.stops.length).toBeGreaterThanOrEqual(1);
      expect(plan.stops[0].venueName).toBe("Bar A");
    });

    it("returns null for missing startTime or endTime", () => {
      expect(createPregamePlan({ endTime: 19 })).toBeNull();
      expect(createPregamePlan({ startTime: 16 })).toBeNull();
    });

    it("returns null when startTime >= endTime", () => {
      expect(createPregamePlan({ startTime: 19, endTime: 16 })).toBeNull();
      expect(createPregamePlan({ startTime: 17, endTime: 17 })).toBeNull();
    });

    it("returns null for null options", () => {
      expect(createPregamePlan(null)).toBeNull();
    });

    it("calculates savings vs full price", () => {
      addHappyHour("Bar", { days: [5], startHour: 16, endHour: 20, deals: [{ item: "Beer", originalPrice: 10, dealPrice: 5 }] });
      const plan = createPregamePlan({ startTime: 16, endTime: 18, dayOfWeek: 5, groupSize: 1 });
      expect(plan.savingsVsFullPrice).toBeGreaterThan(0);
    });

    it("creates a plan with empty stops when no happy hours match", () => {
      const plan = createPregamePlan({ startTime: 16, endTime: 19, dayOfWeek: 5 });
      expect(plan).not.toBeNull();
      expect(plan.stops).toEqual([]);
    });
  });

  describe("getPregamePlans", () => {
    it("returns saved plans", () => {
      addHappyHour("Bar", { days: [5], startHour: 16, endHour: 20, deals: [] });
      createPregamePlan({ startTime: 16, endTime: 18, dayOfWeek: 5 });
      expect(getPregamePlans()).toHaveLength(1);
    });
  });

  describe("deletePregamePlan", () => {
    it("deletes a plan by id", () => {
      const plan = createPregamePlan({ startTime: 10, endTime: 12 });
      expect(deletePregamePlan(plan.id)).toBe(true);
      expect(getPregamePlans()).toHaveLength(0);
    });

    it("returns false for unknown plan id", () => {
      expect(deletePregamePlan("fake")).toBe(false);
    });
  });

  /* ══════════════════════════════════════════
   * 4. Drink Calculator
   * ══════════════════════════════════════════ */
  describe("calculateDrinks", () => {
    it("calculates drinks with default pace", () => {
      const result = calculateDrinks(4, 3);
      expect(result).not.toBeNull();
      expect(result.perPerson).toBe(4.5);
      expect(result.totalDrinks).toBe(18);
      expect(result.estimatedCost).toBe(144);
      expect(result.withHappyHour).toBe(90);
      expect(result.savings).toBe(54);
    });

    it("uses custom pace when provided", () => {
      const result = calculateDrinks(2, 2, 2);
      expect(result.perPerson).toBe(4);
      expect(result.totalDrinks).toBe(8);
    });

    it("returns null for invalid groupSize", () => {
      expect(calculateDrinks(0, 3)).toBeNull();
      expect(calculateDrinks(-1, 3)).toBeNull();
    });

    it("returns null for hoursOut below 0.5", () => {
      expect(calculateDrinks(2, 0.3)).toBeNull();
    });

    it("handles groupSize of 1", () => {
      const result = calculateDrinks(1, 2);
      expect(result.totalDrinks).toBe(result.perPerson);
    });

    it("accepts hoursOut of exactly 0.5", () => {
      const result = calculateDrinks(2, 0.5);
      expect(result).not.toBeNull();
    });
  });

  describe("splitBill", () => {
    it("splits bill with default 20% tip", () => {
      const result = splitBill(100, 4);
      expect(result.subtotal).toBe(100);
      expect(result.tip).toBe(20);
      expect(result.total).toBe(120);
      expect(result.perPerson).toBe(30);
    });

    it("uses custom tip percent", () => {
      const result = splitBill(100, 2, 15);
      expect(result.tip).toBe(15);
      expect(result.total).toBe(115);
      expect(result.perPerson).toBe(57.5);
    });

    it("handles 0% tip", () => {
      const result = splitBill(100, 4, 0);
      expect(result.tip).toBe(0);
      expect(result.total).toBe(100);
    });

    it("returns null for invalid inputs", () => {
      expect(splitBill(0, 4)).toBeNull();
      expect(splitBill(-50, 2)).toBeNull();
      expect(splitBill(100, 0)).toBeNull();
      expect(splitBill(100, -1)).toBeNull();
    });

    it("rounds to 2 decimal places", () => {
      const result = splitBill(99, 7);
      expect(result.perPerson).toBe(Math.round((99 * 1.2 / 7) * 100) / 100);
    });
  });

  /* ══════════════════════════════════════════
   * 5. Group Coordination
   * ══════════════════════════════════════════ */
  describe("createPregameGroup", () => {
    it("creates a group with host as first member", () => {
      const g = createPregameGroup("Alice", { venue: "Bar" });
      expect(g).not.toBeNull();
      expect(g.host).toBe("Alice");
      expect(g.members).toContain("Alice");
      expect(g.rsvps.Alice).toBe("going");
      expect(g.chat).toEqual([]);
    });

    it("returns null for empty host name", () => {
      expect(createPregameGroup("")).toBeNull();
      expect(createPregameGroup(null)).toBeNull();
    });

    it("allows null plan", () => {
      const g = createPregameGroup("Alice");
      expect(g.plan).toBeNull();
    });
  });

  describe("joinGroup", () => {
    it("adds a member to the group", () => {
      const g = createPregameGroup("Alice");
      const updated = joinGroup(g.id, "Bob");
      expect(updated).not.toBeNull();
      expect(updated.members).toContain("Bob");
    });

    it("prevents duplicate members", () => {
      const g = createPregameGroup("Alice");
      expect(joinGroup(g.id, "Alice")).toBeNull();
    });

    it("returns null for unknown group", () => {
      expect(joinGroup("fake", "Bob")).toBeNull();
    });
  });

  describe("rsvp", () => {
    it("allows valid RSVP status", () => {
      const g = createPregameGroup("Alice");
      joinGroup(g.id, "Bob");
      const updated = rsvp(g.id, "Bob", "maybe");
      expect(updated).not.toBeNull();
      expect(updated.rsvps.Bob).toBe("maybe");
    });

    it("rejects invalid RSVP status", () => {
      const g = createPregameGroup("Alice");
      expect(rsvp(g.id, "Alice", "thinking")).toBeNull();
    });

    it("requires membership before RSVP", () => {
      const g = createPregameGroup("Alice");
      expect(rsvp(g.id, "Charlie", "going")).toBeNull();
    });

    it("allows not-going status", () => {
      const g = createPregameGroup("Alice");
      const updated = rsvp(g.id, "Alice", "not-going");
      expect(updated.rsvps.Alice).toBe("not-going");
    });
  });

  describe("addGroupMessage", () => {
    it("adds a chat message", () => {
      const g = createPregameGroup("Alice");
      const msg = addGroupMessage(g.id, "Alice", "Let's meet at 8!");
      expect(msg).not.toBeNull();
      expect(msg.userName).toBe("Alice");
      expect(msg.message).toBe("Let's meet at 8!");
      expect(msg.timestamp).toBeDefined();
    });

    it("returns null for missing message", () => {
      const g = createPregameGroup("Alice");
      expect(addGroupMessage(g.id, "Alice", "")).toBeNull();
      expect(addGroupMessage(g.id, "Alice", null)).toBeNull();
    });

    it("returns null for unknown group", () => {
      expect(addGroupMessage("fake", "Alice", "hi")).toBeNull();
    });
  });

  describe("getGroup", () => {
    it("returns group by id", () => {
      const g = createPregameGroup("Alice");
      expect(getGroup(g.id)).not.toBeNull();
      expect(getGroup(g.id).host).toBe("Alice");
    });

    it("returns null for unknown id", () => {
      expect(getGroup("unknown")).toBeNull();
    });
  });

  describe("getGroupRSVPSummary", () => {
    it("counts RSVPs by status", () => {
      const g = createPregameGroup("Alice");
      joinGroup(g.id, "Bob");
      joinGroup(g.id, "Carol");
      rsvp(g.id, "Bob", "maybe");
      rsvp(g.id, "Carol", "not-going");
      const summary = getGroupRSVPSummary(g.id);
      expect(summary.going).toBe(1);
      expect(summary.maybe).toBe(1);
      expect(summary["not-going"]).toBe(1);
    });

    it("returns null for unknown group", () => {
      expect(getGroupRSVPSummary("fake")).toBeNull();
    });
  });

  /* ══════════════════════════════════════════
   * 6. Venue Deals Comparison
   * ══════════════════════════════════════════ */
  describe("compareDeals", () => {
    it("compares deals across venues", () => {
      addHappyHour("Bar A", { days: [5], startHour: 16, endHour: 20, deals: [{ item: "Beer", originalPrice: 10, dealPrice: 5 }] });
      addHappyHour("Bar B", { days: [5], startHour: 16, endHour: 20, deals: [{ item: "Wine", originalPrice: 15, dealPrice: 12 }] });
      const results = compareDeals(["Bar A", "Bar B"], 5, 17);
      expect(results).toHaveLength(2);
      expect(results[0].venueName).toBe("Bar A");
    });

    it("excludes venues with no active deals", () => {
      addHappyHour("Bar A", { days: [5], startHour: 16, endHour: 20, deals: [{ item: "Beer", originalPrice: 10, dealPrice: 5 }] });
      const results = compareDeals(["Bar A", "Bar C"], 5, 17);
      expect(results).toHaveLength(1);
    });

    it("returns empty for non-array input", () => {
      expect(compareDeals("not-array", 5, 17)).toEqual([]);
    });

    it("identifies best deal per venue", () => {
      addHappyHour("Bar", {
        days: [5], startHour: 16, endHour: 20,
        deals: [
          { item: "Beer", originalPrice: 10, dealPrice: 8 },
          { item: "Cocktail", originalPrice: 16, dealPrice: 8 },
        ]
      });
      const results = compareDeals(["Bar"], 5, 17);
      expect(results[0].bestDeal.item).toBe("Cocktail");
    });
  });

  describe("getBestDealsNow", () => {
    it("ranks deals by savings percentage", () => {
      addHappyHour("Bar A", { days: [5], startHour: 16, endHour: 20, deals: [{ item: "Beer", originalPrice: 10, dealPrice: 5 }] });
      addHappyHour("Bar B", { days: [5], startHour: 16, endHour: 20, deals: [{ item: "Wine", originalPrice: 20, dealPrice: 5 }] });
      const deals = getBestDealsNow(5, 17);
      expect(deals[0].deal.item).toBe("Wine");
    });

    it("respects limit parameter", () => {
      addHappyHour("Bar", { days: [5], startHour: 16, endHour: 20, deals: [
        { item: "A", originalPrice: 10, dealPrice: 5 },
        { item: "B", originalPrice: 10, dealPrice: 6 },
        { item: "C", originalPrice: 10, dealPrice: 7 },
      ] });
      expect(getBestDealsNow(5, 17, 2)).toHaveLength(2);
    });

    it("returns empty when no happy hours active", () => {
      expect(getBestDealsNow(5, 17)).toEqual([]);
    });
  });

  /* ══════════════════════════════════════════
   * 7. Pregame Templates
   * ══════════════════════════════════════════ */
  describe("saveTemplate", () => {
    it("saves a template", () => {
      const tmpl = saveTemplate("Friday Night", { startTime: 18, endTime: 22 });
      expect(tmpl).not.toBeNull();
      expect(tmpl.name).toBe("Friday Night");
      expect(tmpl.usageCount).toBe(0);
      expect(tmpl.id).toBeDefined();
    });

    it("returns null for empty name", () => {
      expect(saveTemplate("", {})).toBeNull();
      expect(saveTemplate(null, {})).toBeNull();
    });

    it("returns null for missing plan", () => {
      expect(saveTemplate("Test", null)).toBeNull();
    });
  });

  describe("getTemplates", () => {
    it("returns templates sorted by usageCount desc", () => {
      const t1 = saveTemplate("A", { a: 1 });
      const t2 = saveTemplate("B", { b: 2 });
      useTemplate(t2.id);
      useTemplate(t2.id);
      useTemplate(t1.id);
      const templates = getTemplates();
      expect(templates[0].name).toBe("B");
      expect(templates[0].usageCount).toBe(2);
    });

    it("returns empty when none saved", () => {
      expect(getTemplates()).toEqual([]);
    });
  });

  describe("useTemplate", () => {
    it("returns a plan from template with overrides", () => {
      const tmpl = saveTemplate("Standard", { startTime: 18, endTime: 22, groupSize: 4 });
      const plan = useTemplate(tmpl.id, { groupSize: 6, budget: 300 });
      expect(plan.startTime).toBe(18);
      expect(plan.groupSize).toBe(6);
      expect(plan.budget).toBe(300);
    });

    it("increments usageCount", () => {
      const tmpl = saveTemplate("Test", { a: 1 });
      useTemplate(tmpl.id);
      useTemplate(tmpl.id);
      const templates = getTemplates();
      expect(templates[0].usageCount).toBe(2);
    });

    it("returns null for unknown template", () => {
      expect(useTemplate("fake")).toBeNull();
    });

    it("works without overrides", () => {
      const tmpl = saveTemplate("Simple", { startTime: 20 });
      const plan = useTemplate(tmpl.id);
      expect(plan.startTime).toBe(20);
    });
  });

  describe("deleteTemplate", () => {
    it("deletes a template", () => {
      const tmpl = saveTemplate("Test", { a: 1 });
      expect(deleteTemplate(tmpl.id)).toBe(true);
      expect(getTemplates()).toHaveLength(0);
    });

    it("returns false for unknown template", () => {
      expect(deleteTemplate("fake")).toBe(false);
    });
  });

  describe("getPopularTemplates", () => {
    it("returns top N templates by usage", () => {
      const t1 = saveTemplate("A", { a: 1 });
      const t2 = saveTemplate("B", { b: 2 });
      saveTemplate("C", { c: 3 });
      useTemplate(t2.id);
      useTemplate(t1.id);
      useTemplate(t1.id);
      const popular = getPopularTemplates(2);
      expect(popular).toHaveLength(2);
      expect(popular[0].name).toBe("A");
    });

    it("defaults to 5", () => {
      for (let i = 0; i < 7; i++) {
        saveTemplate("T" + i, { i });
      }
      expect(getPopularTemplates()).toHaveLength(5);
    });
  });

  /* ══════════════════════════════════════════
   * Edge Cases
   * ══════════════════════════════════════════ */
  describe("edge cases", () => {
    it("handles corrupt localStorage gracefully", () => {
      store["lnv_pregame_planner_happy_hours"] = "not json";
      expect(getHappyHours("Bar")).toEqual([]);
    });

    it("handles empty store", () => {
      expect(getHappyHours("Any")).toEqual([]);
      expect(getBudgetHistory()).toEqual([]);
      expect(getPregamePlans()).toEqual([]);
      expect(getTemplates()).toEqual([]);
    });

    it("multiple groups can coexist", () => {
      const g1 = createPregameGroup("Alice");
      const g2 = createPregameGroup("Bob");
      expect(getGroup(g1.id).host).toBe("Alice");
      expect(getGroup(g2.id).host).toBe("Bob");
    });
  });
});
