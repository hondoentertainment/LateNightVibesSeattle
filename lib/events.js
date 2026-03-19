/**
 * Events / special nights data for venues.
 *
 * Generates recurring events dynamically based on venue Category and Vibe Tags.
 * No external API calls — pure logic suitable for a static site.
 *
 * Event shape:
 *   { name, dayOfWeek (0-6, Sun-Sat), startTime, endTime, description, recurring }
 *
 * Legacy localStorage-based events still supported for user-curated overrides.
 */
(function (exports) {
  var EVENTS_KEY = "lnv_venue_events";

  var DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  /* ─── City-scoped key helpers ─── */

  function _cities() {
    if (typeof module !== "undefined") return require("./cities");
    return (typeof window !== "undefined" && window.LNVCities) || null;
  }

  function _scopedKey() {
    var c = _cities();
    return c && c.getCityKey ? c.getCityKey(EVENTS_KEY) : EVENTS_KEY;
  }

  function _migrate() {
    var c = _cities();
    if (c && c.migrateKeyIfNeeded) c.migrateKeyIfNeeded(EVENTS_KEY);
  }

  /* ─── localStorage helpers (legacy user-curated events) ─── */

  function loadEventsMap() {
    try {
      _migrate();
      var raw = localStorage.getItem(_scopedKey());
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  function saveEventsMap(map) {
    try {
      localStorage.setItem(_scopedKey(), JSON.stringify(map));
      return true;
    } catch (_) {
      return false;
    }
  }

  function setVenueEvents(venueName, eventList) {
    var map = loadEventsMap();
    var name = (venueName || "").toString().trim();
    if (!name) return false;
    map[name] = eventList || [];
    return saveEventsMap(map);
  }

  /* ─── Recurring event rule engine ─── */

  /**
   * Each rule has:
   *   match(category, tags) → boolean
   *   events → array of recurring event templates
   */
  var EVENT_RULES = [
    // Live music venues and bars with live-music tag
    {
      match: function (cat, tags) {
        return tags.indexOf("live-music") !== -1 ||
          cat === "Music Venue / Bar" ||
          cat === "Bar / Music" ||
          cat === "Jazz Club / Restaurant";
      },
      events: [
        { name: "Live Music Night", dayOfWeek: 4, startTime: "20:00", endTime: "23:30", description: "Live bands and performers take the stage" },
        { name: "Live Music Night", dayOfWeek: 5, startTime: "21:00", endTime: "00:30", description: "Friday night live music showcase" },
        { name: "Live Music Night", dayOfWeek: 6, startTime: "21:00", endTime: "00:30", description: "Saturday night live performances" }
      ]
    },
    // Karaoke venues
    {
      match: function (cat, tags) {
        return cat === "Karaoke" ||
          cat === "Tiki / Karaoke Bar" ||
          tags.indexOf("karaoke") !== -1;
      },
      events: [
        { name: "Karaoke Night", dayOfWeek: 3, startTime: "20:00", endTime: "01:00", description: "Wednesday karaoke — sing your heart out" },
        { name: "Karaoke Night", dayOfWeek: 5, startTime: "21:00", endTime: "01:30", description: "Friday karaoke party" },
        { name: "Karaoke Night", dayOfWeek: 6, startTime: "21:00", endTime: "01:30", description: "Saturday karaoke party" }
      ]
    },
    // Game bars / interactive venues → Trivia
    {
      match: function (cat, tags) {
        return cat === "Bar / Games" ||
          cat === "Bar / Arcade" ||
          tags.indexOf("games") !== -1 ||
          tags.indexOf("interactive") !== -1;
      },
      events: [
        { name: "Trivia Night", dayOfWeek: 2, startTime: "19:00", endTime: "21:30", description: "Team trivia — prizes for top scorers" },
        { name: "Game Night", dayOfWeek: 3, startTime: "18:00", endTime: "23:00", description: "Board games, arcade tournaments & fun" }
      ]
    },
    // Sports bars → Watch parties
    {
      match: function (cat, tags) {
        return cat === "Sports Bar" ||
          tags.indexOf("sports") !== -1;
      },
      events: [
        { name: "Game Day Watch Party", dayOfWeek: 0, startTime: "10:00", endTime: "22:00", description: "Sunday sports on the big screens with drink specials" },
        { name: "Game Day Watch Party", dayOfWeek: 1, startTime: "17:30", endTime: "22:00", description: "Monday Night Football with wing specials" },
        { name: "Game Day Watch Party", dayOfWeek: 4, startTime: "17:30", endTime: "22:00", description: "Thursday Night Football watch party" }
      ]
    },
    // Upscale cocktail bars → Happy Hour
    {
      match: function (cat, tags) {
        return (cat === "Cocktail Bar" || cat === "Rooftop Bar") &&
          tags.indexOf("upscale") !== -1;
      },
      events: [
        { name: "Happy Hour", dayOfWeek: 1, startTime: "17:00", endTime: "20:00", description: "Craft cocktail happy hour specials" },
        { name: "Happy Hour", dayOfWeek: 2, startTime: "17:00", endTime: "20:00", description: "Craft cocktail happy hour specials" },
        { name: "Happy Hour", dayOfWeek: 3, startTime: "17:00", endTime: "20:00", description: "Craft cocktail happy hour specials" },
        { name: "Happy Hour", dayOfWeek: 4, startTime: "17:00", endTime: "20:00", description: "Craft cocktail happy hour specials" },
        { name: "Happy Hour", dayOfWeek: 5, startTime: "17:00", endTime: "20:00", description: "Friday happy hour — start the weekend right" }
      ]
    },
    // Nightclubs / dance clubs → DJ nights & themed nights
    {
      match: function (cat, tags) {
        return cat === "Nightclub" ||
          cat === "Club" ||
          cat === "Bar / Club" ||
          (tags.indexOf("dancey") !== -1 && tags.indexOf("high-energy") !== -1);
      },
      events: [
        { name: "DJ Night", dayOfWeek: 5, startTime: "22:00", endTime: "02:00", description: "Resident DJ spinning all night" },
        { name: "DJ Night", dayOfWeek: 6, startTime: "22:00", endTime: "02:00", description: "Saturday night DJ sets and dancing" },
        { name: "Themed Dance Night", dayOfWeek: 4, startTime: "21:00", endTime: "01:30", description: "Rotating themed dance party" }
      ]
    },
    // Late-eats restaurants → Late Night Menu
    {
      match: function (cat, tags) {
        return tags.indexOf("late-eats") !== -1 &&
          (cat.indexOf("Restaurant") !== -1 ||
           cat.indexOf("Diner") !== -1 ||
           cat === "Pizza / Bar" ||
           cat.indexOf("BBQ") !== -1);
      },
      events: [
        { name: "Late Night Menu", dayOfWeek: 4, startTime: "22:00", endTime: "01:00", description: "Special late-night food menu available" },
        { name: "Late Night Menu", dayOfWeek: 5, startTime: "22:00", endTime: "01:30", description: "Friday late-night eats and drinks" },
        { name: "Late Night Menu", dayOfWeek: 6, startTime: "22:00", endTime: "01:30", description: "Saturday late-night eats and drinks" }
      ]
    },
    // Divey bars → Open Mic & Pub Quiz
    {
      match: function (cat, tags) {
        return cat === "Dive Bar" ||
          tags.indexOf("divey") !== -1;
      },
      events: [
        { name: "Open Mic Night", dayOfWeek: 3, startTime: "20:00", endTime: "23:00", description: "Open mic — comedy, music, poetry, anything goes" },
        { name: "Pub Quiz", dayOfWeek: 1, startTime: "19:00", endTime: "21:30", description: "Monday night pub quiz with prizes" }
      ]
    },
    // Pubs and brewpubs → Quiz / Trivia
    {
      match: function (cat, tags) {
        return cat === "Pub" ||
          cat === "Brewpub" ||
          cat === "Beer Hall" ||
          cat === "Beer Bar";
      },
      events: [
        { name: "Pub Trivia", dayOfWeek: 2, startTime: "19:00", endTime: "21:30", description: "Tuesday night pub trivia" },
        { name: "Pint Night", dayOfWeek: 3, startTime: "17:00", endTime: "22:00", description: "Discounted pints and featured brews" }
      ]
    },
    // Date-friendly cocktail bars (non-upscale also get a lighter event)
    {
      match: function (cat, tags) {
        return tags.indexOf("date-friendly") !== -1 &&
          (cat === "Cocktail Bar" || cat === "Bistro / Bar" || cat === "Restaurant / Lounge");
      },
      events: [
        { name: "Date Night Special", dayOfWeek: 5, startTime: "18:00", endTime: "22:00", description: "Curated cocktail pairings for two" },
        { name: "Date Night Special", dayOfWeek: 6, startTime: "18:00", endTime: "22:00", description: "Saturday evening cocktail pairings" }
      ]
    },
    // Breweries / distilleries → Tasting events
    {
      match: function (cat) {
        return cat === "Brewery" ||
          cat === "Distillery / Bar" ||
          cat === "Cider Bar" ||
          cat === "Taproom";
      },
      events: [
        { name: "Tasting Flight Night", dayOfWeek: 4, startTime: "17:00", endTime: "21:00", description: "Guided tasting flights at special prices" },
        { name: "Tasting Flight Night", dayOfWeek: 6, startTime: "14:00", endTime: "18:00", description: "Saturday afternoon tasting event" }
      ]
    }
  ];

  /* ─── Helpers ─── */

  function _normCat(venue) {
    return ((venue && venue.Category) || "").toString().trim();
  }

  function _parseTags(venue) {
    var raw = ((venue && venue["Vibe Tags"]) || "").toString().trim();
    if (!raw) return [];
    return raw.split(",").map(function (t) { return t.trim().toLowerCase(); }).filter(Boolean);
  }

  /**
   * Stamp each event template with recurring: true (returns new objects).
   */
  function _stampRecurring(eventList) {
    return eventList.map(function (e) {
      return {
        name: e.name,
        dayOfWeek: e.dayOfWeek,
        startTime: e.startTime,
        endTime: e.endTime,
        description: e.description,
        recurring: true
      };
    });
  }

  /**
   * Generate recurring events for a venue based on its category and tags.
   */
  function generateRecurringEvents(venue) {
    if (!venue) return [];
    var cat = _normCat(venue);
    var tags = _parseTags(venue);
    var result = [];
    var seen = {}; // deduplicate by name+dayOfWeek

    for (var i = 0; i < EVENT_RULES.length; i++) {
      if (EVENT_RULES[i].match(cat, tags)) {
        var evts = _stampRecurring(EVENT_RULES[i].events);
        for (var j = 0; j < evts.length; j++) {
          var key = evts[j].name + ":" + evts[j].dayOfWeek;
          if (!seen[key]) {
            seen[key] = true;
            result.push(evts[j]);
          }
        }
      }
    }
    return result;
  }

  /* ─── Public API ─── */

  /**
   * Get all events for a venue. Merges generated recurring events with any
   * user-curated overrides from localStorage.
   *
   * If a venues array is provided, the venue object is looked up by name
   * so recurring events can be generated. Without it, only localStorage
   * events are returned (backwards compatible).
   */
  function getEventsForVenue(venueName, venues) {
    var name = (venueName || "").toString().trim();

    // Generated recurring events (need venue object)
    var recurring = [];
    if (venues && venues.length) {
      for (var i = 0; i < venues.length; i++) {
        var vn = ((venues[i].Name) || "").toString().trim();
        if (vn === name) {
          recurring = generateRecurringEvents(venues[i]);
          break;
        }
      }
    }

    // Legacy user-curated events from localStorage
    var map = loadEventsMap();
    var curated = map[name] || [];

    // Merge: curated events come after recurring
    return recurring.concat(curated);
  }

  /**
   * Get events happening tonight for a single venue.
   */
  function getEventsForTonight(venueName, venues) {
    var events = getEventsForVenue(venueName, venues);
    var today = new Date().getDay();
    return events.filter(function (e) {
      // Support both new (dayOfWeek) and legacy (day) field
      var d = typeof e.dayOfWeek === "number" ? e.dayOfWeek : e.day;
      return d === today;
    });
  }

  /**
   * Get tonight's highlights across all venues.
   * Returns [{ venue, event }] sorted by start time.
   */
  function getTonightsHighlights(venues, limit) {
    var today = new Date().getDay();
    var highlights = [];

    (venues || []).forEach(function (v) {
      var name = (v.Name || "").toString().trim();

      // Recurring generated events
      var recurring = generateRecurringEvents(v);
      recurring.forEach(function (e) {
        if (e.dayOfWeek === today) {
          highlights.push({ venue: v, event: e });
        }
      });

      // Legacy localStorage events
      var map = loadEventsMap();
      var curated = map[name] || [];
      curated.forEach(function (e) {
        var d = typeof e.dayOfWeek === "number" ? e.dayOfWeek : e.day;
        if (d === today) {
          highlights.push({ venue: v, event: e });
        }
      });
    });

    // Sort by start time
    highlights.sort(function (a, b) {
      var ta = (a.event.startTime || a.event.detail || "").toString();
      var tb = (b.event.startTime || b.event.detail || "").toString();
      return ta.localeCompare(tb);
    });

    return highlights.slice(0, limit || 10);
  }

  /**
   * Get upcoming events across all venues for the next N days.
   * Returns [{ venue, event, date }] where date is a Date object.
   */
  function getUpcomingEvents(venues, days, limit) {
    days = days || 7;
    limit = limit || 20;
    var results = [];
    var now = new Date();
    var today = now.getDay();

    (venues || []).forEach(function (v) {
      var recurring = generateRecurringEvents(v);

      for (var d = 0; d < days; d++) {
        var targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
        var dow = targetDate.getDay();

        recurring.forEach(function (e) {
          if (e.dayOfWeek === dow) {
            results.push({
              venue: v,
              event: e,
              date: targetDate
            });
          }
        });
      }
    });

    // Sort by date, then start time
    results.sort(function (a, b) {
      var dc = a.date.getTime() - b.date.getTime();
      if (dc !== 0) return dc;
      return (a.event.startTime || "").localeCompare(b.event.startTime || "");
    });

    return results.slice(0, limit);
  }

  /* ─── Exports ─── */

  exports.loadEventsMap = loadEventsMap;
  exports.saveEventsMap = saveEventsMap;
  exports.getEventsForVenue = getEventsForVenue;
  exports.getEventsForTonight = getEventsForTonight;
  exports.getTonightsHighlights = getTonightsHighlights;
  exports.getUpcomingEvents = getUpcomingEvents;
  exports.setVenueEvents = setVenueEvents;
  exports.generateRecurringEvents = generateRecurringEvents;
  exports.DAY_NAMES = DAY_NAMES;
  exports.EVENT_RULES = EVENT_RULES;
})(typeof module !== "undefined" ? module.exports : (window.LNVEvents = window.LNVEvents || {}));
