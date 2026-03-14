/**
 * Events / special nights data for venues.
 * Structure: { "Venue Name": [{ day: 0-6 (Sun-Sat), label: "Trivia", detail: "9pm" }] }
 * Can be extended via CSV column or manual curation. Placeholder for v1.5.
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

  function getEventsForVenue(venueName) {
    var map = loadEventsMap();
    var name = (venueName || "").toString().trim();
    return map[name] || [];
  }

  function getEventsForTonight(venueName) {
    var events = getEventsForVenue(venueName);
    var today = new Date().getDay();
    return events.filter(function (e) { return e.day === today; });
  }

  function getTonightsHighlights(venues, limit) {
    var today = new Date().getDay();
    var highlights = [];
    var map = loadEventsMap();
    (venues || []).forEach(function (v) {
      var name = (v.Name || "").toString().trim();
      var list = map[name] || [];
      list.filter(function (e) { return e.day === today; }).forEach(function (e) {
        highlights.push({ venue: v, event: e });
      });
    });
    return highlights.slice(0, limit || 10);
  }

  function setVenueEvents(venueName, eventList) {
    var map = loadEventsMap();
    var name = (venueName || "").toString().trim();
    if (!name) return false;
    map[name] = eventList || [];
    return saveEventsMap(map);
  }

  exports.loadEventsMap = loadEventsMap;
  exports.saveEventsMap = saveEventsMap;
  exports.getEventsForVenue = getEventsForVenue;
  exports.getEventsForTonight = getEventsForTonight;
  exports.getTonightsHighlights = getTonightsHighlights;
  exports.setVenueEvents = setVenueEvents;
  exports.DAY_NAMES = DAY_NAMES;
})(typeof module !== "undefined" ? module.exports : (window.LNVEvents = window.LNVEvents || {}));
