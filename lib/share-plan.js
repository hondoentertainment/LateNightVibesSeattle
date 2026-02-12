/**
 * Pure encode/decode logic for shared night plans (group planning links).
 * Used by planner.js for share and load from URL.
 * UMD-style export for Node (tests) and browser.
 */
(function (exports) {
  function normalizeValue(value) {
    return (value || "").toString().trim();
  }

  function encodeSharePlan(stops, startMin, slotDuration) {
    const payload = {
      s: stops.map((v) => ({
        n: normalizeValue(v.Name),
        a: normalizeValue(v.Area),
        c: normalizeValue(v.Category),
        t: normalizeValue(v["Typical Closing Time"]),
        l: normalizeValue(v["Google Maps Driving Link"]),
      })),
      start: startMin,
      dur: slotDuration,
    };
    return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  }

  function decodeSharePlan(encoded) {
    const json = decodeURIComponent(escape(atob(encoded)));
    return JSON.parse(json);
  }

  exports.encodeSharePlan = encodeSharePlan;
  exports.decodeSharePlan = decodeSharePlan;
})(typeof module !== "undefined" ? module.exports : (window.LNVSharePlan = window.LNVSharePlan || {}));
