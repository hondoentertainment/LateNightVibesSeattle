/**
 * Late Night Vibes — Pregame Planner (budget-aware happy hour optimization).
 * UMD-style export: works in Node (tests) and browser
 * (<script src="lib/pregame-planner.js"> → window.LNVPregamePlanner).
 */
(function (exports) {
  "use strict";

  var STORAGE_KEY = "lnv_pregame_planner";

  /* ─── City-scoped key helpers ─── */

  function _cities() {
    if (typeof module !== "undefined") {
      try { return require("./cities"); } catch (_e) { return null; }
    }
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
    } catch (_e) { /* quota exceeded or unavailable */ }
  }

  /* ─── Internal state keys ─── */

  var KEY_HAPPY_HOURS = STORAGE_KEY + "_happy_hours";
  var KEY_BUDGETS = STORAGE_KEY + "_budgets";
  var KEY_PLANS = STORAGE_KEY + "_plans";
  var KEY_GROUPS = STORAGE_KEY + "_groups";
  var KEY_TEMPLATES = STORAGE_KEY + "_templates";

  /* ─── ID generator ─── */

  var _idCounter = 0;
  function _genId(prefix) {
    _idCounter += 1;
    return (prefix || "id") + "_" + Date.now() + "_" + _idCounter;
  }

  /* ════════════════════════════════════════════════════════════════════
   *  1. Happy Hour Database
   * ════════════════════════════════════════════════════════════════════ */

  function addHappyHour(venueName, happyHour) {
    if (!venueName || typeof venueName !== "string") return null;
    if (!happyHour || typeof happyHour !== "object") return null;
    if (!Array.isArray(happyHour.days) || happyHour.days.length === 0) return null;

    for (var i = 0; i < happyHour.days.length; i++) {
      var d = happyHour.days[i];
      if (typeof d !== "number" || d < 0 || d > 6) return null;
    }

    if (typeof happyHour.startHour !== "number" || typeof happyHour.endHour !== "number") return null;
    if (happyHour.startHour < 0 || happyHour.startHour > 23) return null;
    if (happyHour.endHour < 0 || happyHour.endHour > 23) return null;
    if (happyHour.startHour >= happyHour.endHour) return null;

    var db = _readJSON(KEY_HAPPY_HOURS, {});
    if (!db[venueName]) db[venueName] = [];

    var entry = {
      days: happyHour.days.slice(),
      startHour: happyHour.startHour,
      endHour: happyHour.endHour,
      deals: Array.isArray(happyHour.deals) ? happyHour.deals.slice() : []
    };

    db[venueName].push(entry);
    _writeJSON(KEY_HAPPY_HOURS, db);
    return entry;
  }

  function getHappyHours(venueName) {
    var db = _readJSON(KEY_HAPPY_HOURS, {});
    return db[venueName] || [];
  }

  function getActiveHappyHours(dayOfWeek, hour) {
    if (typeof dayOfWeek !== "number" || typeof hour !== "number") return [];
    var db = _readJSON(KEY_HAPPY_HOURS, {});
    var results = [];

    var venues = Object.keys(db);
    for (var v = 0; v < venues.length; v++) {
      var venueName = venues[v];
      var hours = db[venueName];
      for (var h = 0; h < hours.length; h++) {
        var hh = hours[h];
        if (hh.days.indexOf(dayOfWeek) !== -1 &&
            hour >= hh.startHour && hour < hh.endHour) {
          results.push({ venueName: venueName, happyHour: hh });
        }
      }
    }
    return results;
  }

  function removeHappyHour(venueName, index) {
    if (!venueName) return false;
    var db = _readJSON(KEY_HAPPY_HOURS, {});
    if (!db[venueName]) return false;
    if (typeof index !== "number" || index < 0 || index >= db[venueName].length) return false;

    db[venueName].splice(index, 1);
    if (db[venueName].length === 0) delete db[venueName];
    _writeJSON(KEY_HAPPY_HOURS, db);
    return true;
  }

  /* ════════════════════════════════════════════════════════════════════
   *  2. Budget Planning
   * ════════════════════════════════════════════════════════════════════ */

  function createBudget(groupSize, totalBudget) {
    if (typeof groupSize !== "number" || groupSize < 1) return null;
    if (typeof totalBudget !== "number" || totalBudget <= 0) return null;

    var budget = {
      id: _genId("budget"),
      groupSize: groupSize,
      totalBudget: totalBudget,
      perPerson: totalBudget / groupSize,
      allocated: 0,
      remaining: totalBudget,
      history: []
    };

    var budgets = _readJSON(KEY_BUDGETS, []);
    budgets.push(budget);
    _writeJSON(KEY_BUDGETS, budgets);
    return budget;
  }

  function allocateSpend(budgetId, amount, description) {
    if (!budgetId || typeof amount !== "number" || amount <= 0) return null;
    var budgets = _readJSON(KEY_BUDGETS, []);

    for (var i = 0; i < budgets.length; i++) {
      if (budgets[i].id === budgetId) {
        if (amount > budgets[i].remaining) return null;
        budgets[i].allocated += amount;
        budgets[i].remaining -= amount;
        budgets[i].history.push({
          amount: amount,
          description: description || "",
          timestamp: Date.now()
        });
        _writeJSON(KEY_BUDGETS, budgets);
        return budgets[i];
      }
    }
    return null;
  }

  function getBudgetStatus(budgetId) {
    var budgets = _readJSON(KEY_BUDGETS, []);
    for (var i = 0; i < budgets.length; i++) {
      if (budgets[i].id === budgetId) return budgets[i];
    }
    return null;
  }

  function getBudgetHistory() {
    return _readJSON(KEY_BUDGETS, []);
  }

  /* ════════════════════════════════════════════════════════════════════
   *  3. Pregame Plan Builder
   * ════════════════════════════════════════════════════════════════════ */

  function _scoreVenue(venueHH, budgetPerPerson, preferences) {
    var score = 0;
    var deals = venueHH.happyHour.deals || [];

    for (var d = 0; d < deals.length; d++) {
      if (typeof deals[d].dealPrice === "number" &&
          (!budgetPerPerson || deals[d].dealPrice <= budgetPerPerson)) {
        score += 10;
      }
    }

    if (preferences) {
      if (Array.isArray(preferences.vibes)) {
        for (var vi = 0; vi < preferences.vibes.length; vi++) {
          // Check if venue name contains the vibe keyword (simple match)
          if (venueHH.venueName.toLowerCase().indexOf(
              preferences.vibes[vi].toLowerCase()) !== -1) {
            score += 5;
          }
        }
      }
      if (Array.isArray(preferences.neighborhoods)) {
        for (var ni = 0; ni < preferences.neighborhoods.length; ni++) {
          if (venueHH.venueName.toLowerCase().indexOf(
              preferences.neighborhoods[ni].toLowerCase()) !== -1) {
            score += 3;
          }
        }
      }
    }

    return score;
  }

  function createPregamePlan(options) {
    if (!options || typeof options !== "object") return null;
    if (typeof options.startTime !== "number" || typeof options.endTime !== "number") return null;
    if (options.startTime < 0 || options.startTime > 23) return null;
    if (options.endTime < 0 || options.endTime > 23) return null;
    if (options.startTime >= options.endTime) return null;

    var groupSize = options.groupSize || 1;
    var budget = options.budget || 0;
    var budgetPerPerson = budget > 0 ? budget / groupSize : 0;
    var preferences = options.preferences || {};

    // Find active happy hours in the time window (use day 0 if not specified)
    var dayOfWeek = typeof options.dayOfWeek === "number" ? options.dayOfWeek : new Date().getDay();
    var candidates = [];

    for (var hr = options.startTime; hr < options.endTime; hr++) {
      var active = getActiveHappyHours(dayOfWeek, hr);
      for (var a = 0; a < active.length; a++) {
        // Avoid duplicate venues
        var found = false;
        for (var c = 0; c < candidates.length; c++) {
          if (candidates[c].venueName === active[a].venueName) {
            found = true;
            break;
          }
        }
        if (!found) {
          candidates.push(active[a]);
        }
      }
    }

    // Score and sort
    var scored = [];
    for (var s = 0; s < candidates.length; s++) {
      scored.push({
        venue: candidates[s],
        score: _scoreVenue(candidates[s], budgetPerPerson, preferences)
      });
    }
    scored.sort(function (a, b) { return b.score - a.score; });

    // Build stops
    var duration = options.endTime - options.startTime;
    var maxStops = Math.min(scored.length, Math.max(1, Math.floor(duration)));
    var timePerStop = scored.length > 0 ? duration / maxStops : duration;
    var stops = [];
    var totalEstimated = 0;
    var fullPriceTotal = 0;

    for (var st = 0; st < maxStops; st++) {
      var v = scored[st].venue;
      var deals = v.happyHour.deals || [];
      var estimatedSpend = 0;
      var fullPrice = 0;

      for (var dd = 0; dd < deals.length; dd++) {
        var dp = typeof deals[dd].dealPrice === "number" ? deals[dd].dealPrice : 0;
        var op = typeof deals[dd].originalPrice === "number" ? deals[dd].originalPrice : dp;
        estimatedSpend += dp * groupSize;
        fullPrice += op * groupSize;
      }

      stops.push({
        venueName: v.venueName,
        arrivalTime: options.startTime + (st * timePerStop),
        departureTime: options.startTime + ((st + 1) * timePerStop),
        deals: deals,
        estimatedSpend: estimatedSpend
      });

      totalEstimated += estimatedSpend;
      fullPriceTotal += fullPrice;
    }

    var plan = {
      id: _genId("plan"),
      startTime: options.startTime,
      endTime: options.endTime,
      groupSize: groupSize,
      budget: budget,
      preferences: preferences,
      stops: stops,
      totalEstimatedSpend: totalEstimated,
      savingsVsFullPrice: fullPriceTotal - totalEstimated,
      createdAt: Date.now()
    };

    var plans = _readJSON(KEY_PLANS, []);
    plans.push(plan);
    _writeJSON(KEY_PLANS, plans);
    return plan;
  }

  function getPregamePlans() {
    return _readJSON(KEY_PLANS, []);
  }

  function deletePregamePlan(planId) {
    var plans = _readJSON(KEY_PLANS, []);
    for (var i = 0; i < plans.length; i++) {
      if (plans[i].id === planId) {
        plans.splice(i, 1);
        _writeJSON(KEY_PLANS, plans);
        return true;
      }
    }
    return false;
  }

  /* ════════════════════════════════════════════════════════════════════
   *  4. Drink Calculator
   * ════════════════════════════════════════════════════════════════════ */

  function calculateDrinks(groupSize, hoursOut, pacePerHour) {
    if (typeof groupSize !== "number" || groupSize < 1) return null;
    if (typeof hoursOut !== "number" || hoursOut < 0.5) return null;

    var pace = (typeof pacePerHour === "number" && pacePerHour > 0) ? pacePerHour : 1.5;
    var perPerson = Math.round(hoursOut * pace * 10) / 10;
    var totalDrinks = Math.round(perPerson * groupSize * 10) / 10;
    var estimatedCost = totalDrinks * 8;
    var withHappyHour = totalDrinks * 5;

    return {
      totalDrinks: totalDrinks,
      perPerson: perPerson,
      estimatedCost: estimatedCost,
      withHappyHour: withHappyHour,
      savings: estimatedCost - withHappyHour
    };
  }

  function splitBill(totalAmount, groupSize, tipPercent) {
    if (typeof totalAmount !== "number" || totalAmount <= 0) return null;
    if (typeof groupSize !== "number" || groupSize < 1) return null;

    var tip = (typeof tipPercent === "number" && tipPercent >= 0) ? tipPercent : 20;
    var tipAmount = totalAmount * (tip / 100);
    var total = totalAmount + tipAmount;

    return {
      subtotal: totalAmount,
      tip: Math.round(tipAmount * 100) / 100,
      total: Math.round(total * 100) / 100,
      perPerson: Math.round((total / groupSize) * 100) / 100
    };
  }

  /* ════════════════════════════════════════════════════════════════════
   *  5. Group Coordination
   * ════════════════════════════════════════════════════════════════════ */

  function createPregameGroup(hostName, plan) {
    if (!hostName || typeof hostName !== "string") return null;

    var group = {
      id: _genId("group"),
      host: hostName,
      plan: plan || null,
      members: [hostName],
      rsvps: {},
      chat: []
    };
    group.rsvps[hostName] = "going";

    var groups = _readJSON(KEY_GROUPS, []);
    groups.push(group);
    _writeJSON(KEY_GROUPS, groups);
    return group;
  }

  function joinGroup(groupId, userName) {
    if (!groupId || !userName) return null;
    var groups = _readJSON(KEY_GROUPS, []);

    for (var i = 0; i < groups.length; i++) {
      if (groups[i].id === groupId) {
        if (groups[i].members.indexOf(userName) !== -1) return null;
        groups[i].members.push(userName);
        _writeJSON(KEY_GROUPS, groups);
        return groups[i];
      }
    }
    return null;
  }

  function rsvp(groupId, userName, status) {
    if (!groupId || !userName || !status) return null;
    var validStatuses = ["going", "maybe", "not-going"];
    if (validStatuses.indexOf(status) === -1) return null;

    var groups = _readJSON(KEY_GROUPS, []);
    for (var i = 0; i < groups.length; i++) {
      if (groups[i].id === groupId) {
        if (groups[i].members.indexOf(userName) === -1) return null;
        groups[i].rsvps[userName] = status;
        _writeJSON(KEY_GROUPS, groups);
        return groups[i];
      }
    }
    return null;
  }

  function addGroupMessage(groupId, userName, message) {
    if (!groupId || !userName || !message) return null;
    var groups = _readJSON(KEY_GROUPS, []);

    for (var i = 0; i < groups.length; i++) {
      if (groups[i].id === groupId) {
        var msg = {
          userName: userName,
          message: message,
          timestamp: Date.now()
        };
        groups[i].chat.push(msg);
        _writeJSON(KEY_GROUPS, groups);
        return msg;
      }
    }
    return null;
  }

  function getGroup(groupId) {
    var groups = _readJSON(KEY_GROUPS, []);
    for (var i = 0; i < groups.length; i++) {
      if (groups[i].id === groupId) return groups[i];
    }
    return null;
  }

  function getGroupRSVPSummary(groupId) {
    var group = getGroup(groupId);
    if (!group) return null;

    var summary = { going: 0, maybe: 0, "not-going": 0 };
    var members = Object.keys(group.rsvps);
    for (var i = 0; i < members.length; i++) {
      var s = group.rsvps[members[i]];
      if (typeof summary[s] === "number") {
        summary[s] += 1;
      }
    }
    return summary;
  }

  /* ════════════════════════════════════════════════════════════════════
   *  6. Venue Deals Comparison
   * ════════════════════════════════════════════════════════════════════ */

  function _savingsPercent(deal) {
    if (!deal || typeof deal.originalPrice !== "number" || deal.originalPrice <= 0) return 0;
    if (typeof deal.dealPrice !== "number") return 0;
    return ((deal.originalPrice - deal.dealPrice) / deal.originalPrice) * 100;
  }

  function compareDeals(venueNames, dayOfWeek, hour) {
    if (!Array.isArray(venueNames)) return [];

    var results = [];
    for (var v = 0; v < venueNames.length; v++) {
      var venueName = venueNames[v];
      var hours = getHappyHours(venueName);
      var activeDeals = [];

      for (var h = 0; h < hours.length; h++) {
        var hh = hours[h];
        if (hh.days.indexOf(dayOfWeek) !== -1 &&
            hour >= hh.startHour && hour < hh.endHour) {
          for (var d = 0; d < (hh.deals || []).length; d++) {
            activeDeals.push(hh.deals[d]);
          }
        }
      }

      if (activeDeals.length === 0) continue;

      var totalSavings = 0;
      var bestDeal = activeDeals[0];
      var bestPct = _savingsPercent(activeDeals[0]);

      for (var ad = 0; ad < activeDeals.length; ad++) {
        var pct = _savingsPercent(activeDeals[ad]);
        var orig = typeof activeDeals[ad].originalPrice === "number" ? activeDeals[ad].originalPrice : 0;
        var dp = typeof activeDeals[ad].dealPrice === "number" ? activeDeals[ad].dealPrice : 0;
        totalSavings += orig - dp;

        if (pct > bestPct) {
          bestPct = pct;
          bestDeal = activeDeals[ad];
        }
      }

      results.push({
        venueName: venueName,
        deals: activeDeals,
        avgSavings: activeDeals.length > 0 ? totalSavings / activeDeals.length : 0,
        bestDeal: bestDeal
      });
    }

    results.sort(function (a, b) { return b.avgSavings - a.avgSavings; });
    return results;
  }

  function getBestDealsNow(dayOfWeek, hour, limit) {
    var maxResults = (typeof limit === "number" && limit > 0) ? limit : 10;
    var active = getActiveHappyHours(dayOfWeek, hour);
    var allDeals = [];

    for (var i = 0; i < active.length; i++) {
      var deals = active[i].happyHour.deals || [];
      for (var d = 0; d < deals.length; d++) {
        allDeals.push({
          venueName: active[i].venueName,
          deal: deals[d],
          savingsPercent: _savingsPercent(deals[d])
        });
      }
    }

    allDeals.sort(function (a, b) { return b.savingsPercent - a.savingsPercent; });
    return allDeals.slice(0, maxResults);
  }

  /* ════════════════════════════════════════════════════════════════════
   *  7. Pregame Templates
   * ════════════════════════════════════════════════════════════════════ */

  function saveTemplate(name, plan) {
    if (!name || typeof name !== "string") return null;
    if (!plan) return null;

    var template = {
      id: _genId("tmpl"),
      name: name,
      plan: plan,
      usageCount: 0,
      createdAt: Date.now()
    };

    var templates = _readJSON(KEY_TEMPLATES, []);
    templates.push(template);
    _writeJSON(KEY_TEMPLATES, templates);
    return template;
  }

  function getTemplates() {
    var templates = _readJSON(KEY_TEMPLATES, []);
    templates.sort(function (a, b) { return b.usageCount - a.usageCount; });
    return templates;
  }

  function useTemplate(templateId, overrides) {
    var templates = _readJSON(KEY_TEMPLATES, []);

    for (var i = 0; i < templates.length; i++) {
      if (templates[i].id === templateId) {
        templates[i].usageCount += 1;
        _writeJSON(KEY_TEMPLATES, templates);

        var plan = {};
        var src = templates[i].plan;
        var keys = Object.keys(src);
        for (var k = 0; k < keys.length; k++) {
          plan[keys[k]] = src[keys[k]];
        }

        if (overrides && typeof overrides === "object") {
          var oKeys = Object.keys(overrides);
          for (var o = 0; o < oKeys.length; o++) {
            plan[oKeys[o]] = overrides[oKeys[o]];
          }
        }

        return plan;
      }
    }
    return null;
  }

  function deleteTemplate(templateId) {
    var templates = _readJSON(KEY_TEMPLATES, []);
    for (var i = 0; i < templates.length; i++) {
      if (templates[i].id === templateId) {
        templates.splice(i, 1);
        _writeJSON(KEY_TEMPLATES, templates);
        return true;
      }
    }
    return false;
  }

  function getPopularTemplates(limit) {
    var max = (typeof limit === "number" && limit > 0) ? limit : 5;
    var templates = getTemplates();
    return templates.slice(0, max);
  }

  /* ─── Exports ─── */

  // 1. Happy Hour Database
  exports.addHappyHour = addHappyHour;
  exports.getHappyHours = getHappyHours;
  exports.getActiveHappyHours = getActiveHappyHours;
  exports.removeHappyHour = removeHappyHour;

  // 2. Budget Planning
  exports.createBudget = createBudget;
  exports.allocateSpend = allocateSpend;
  exports.getBudgetStatus = getBudgetStatus;
  exports.getBudgetHistory = getBudgetHistory;

  // 3. Pregame Plan Builder
  exports.createPregamePlan = createPregamePlan;
  exports.getPregamePlans = getPregamePlans;
  exports.deletePregamePlan = deletePregamePlan;

  // 4. Drink Calculator
  exports.calculateDrinks = calculateDrinks;
  exports.splitBill = splitBill;

  // 5. Group Coordination
  exports.createPregameGroup = createPregameGroup;
  exports.joinGroup = joinGroup;
  exports.rsvp = rsvp;
  exports.addGroupMessage = addGroupMessage;
  exports.getGroup = getGroup;
  exports.getGroupRSVPSummary = getGroupRSVPSummary;

  // 6. Venue Deals Comparison
  exports.compareDeals = compareDeals;
  exports.getBestDealsNow = getBestDealsNow;

  // 7. Pregame Templates
  exports.saveTemplate = saveTemplate;
  exports.getTemplates = getTemplates;
  exports.useTemplate = useTemplate;
  exports.deleteTemplate = deleteTemplate;
  exports.getPopularTemplates = getPopularTemplates;

})(typeof module !== "undefined" ? module.exports : (window.LNVPregamePlanner = {}));
