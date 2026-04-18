/**
 * Analytics — lightweight Plausible event helper.
 * UMD export: window.LNVAnalytics in browser, module.exports in Node.
 */
(function (exports) {
  "use strict";

  function trackEvent(name, props) {
    if (typeof window !== "undefined" && window.plausible) {
      window.plausible(name, { props: props || {} });
    }
  }

  function trackPageView(page) {
    trackEvent("pageview", { page: page });
  }

  function trackVenueView(venueName, city) {
    trackEvent("venue_view", { venue: venueName, city: city });
  }

  function trackSearch(query, resultCount) {
    trackEvent("search", { query: query, results: resultCount });
  }

  function trackMoodMatch(mood, resultCount) {
    trackEvent("mood_match", { mood: mood, results: resultCount });
  }

  function trackPlannerAction(action, venueCount) {
    trackEvent("planner_action", { action: action, venues: venueCount });
  }

  function trackCitySwitch(fromCity, toCity) {
    trackEvent("city_switch", { from: fromCity, to: toCity });
  }

  function trackSave(venueName, action) {
    trackEvent("save_venue", { venue: venueName, action: action });
  }

  exports.trackEvent = trackEvent;
  exports.trackPageView = trackPageView;
  exports.trackVenueView = trackVenueView;
  exports.trackSearch = trackSearch;
  exports.trackMoodMatch = trackMoodMatch;
  exports.trackPlannerAction = trackPlannerAction;
  exports.trackCitySwitch = trackCitySwitch;
  exports.trackSave = trackSave;

})(typeof module !== "undefined" ? module.exports : (window.LNVAnalytics = {}));
