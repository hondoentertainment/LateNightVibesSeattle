/**
 * Geo utilities: neighborhood coords, venue coords, venue-to-venue distance.
 * Used for map markers, walkability, and travel estimates.
 */
(function (exports) {
  var core = (typeof window !== "undefined" && window.LNVCore) ? window.LNVCore : {};
  var normalizeValue = core.normalizeValue || function (v) { return (v || "").toString().trim(); };
  var parseDistanceMiles = core.parseDistanceMiles || function () { return null; };
  var haversineMiles = core.haversineMiles || function () { return null; };
  var WALKABLE_MILES = (core.WALKABLE_MILES != null) ? core.WALKABLE_MILES : 0.5;

  var NEIGHBORHOOD_COORDS = {
    "Capitol Hill": [47.6253, -122.3222], "Ballard": [47.6677, -122.3846],
    "Fremont": [47.6508, -122.3502], "Downtown": [47.6062, -122.3321],
    "Belltown": [47.6145, -122.3450], "SLU": [47.6237, -122.3368],
    "South Lake Union": [47.6237, -122.3368], "Queen Anne": [47.6372, -122.3571],
    "Lower Queen Anne": [47.6255, -122.3565], "Chinatown-International District": [47.5982, -122.3252],
    "International District": [47.5982, -122.3252], "University District": [47.6588, -122.3130],
    "Wallingford": [47.6615, -122.3352], "West Seattle": [47.5607, -122.3870],
    "Georgetown": [47.5436, -122.3157], "SoDo": [47.5680, -122.3340],
    "SODO": [47.5680, -122.3340], "Greenwood": [47.6906, -122.3556],
    "Green Lake": [47.6803, -122.3290], "Magnolia": [47.6395, -122.3990],
    "Interbay": [47.6476, -122.3760], "White Center": [47.5169, -122.3530],
    "Columbia City": [47.5594, -122.2870], "Beacon Hill": [47.5630, -122.3120],
    "Central District": [47.6082, -122.2987], "First Hill": [47.6088, -122.3262],
    "Rainier Valley": [47.5430, -122.2870], "Eastside": [47.6200, -122.1800],
  };

  function getCoordsForVenue(venue) {
    var lat = parseFloat(venue.Latitude);
    var lng = parseFloat(venue.Longitude);
    if (!isNaN(lat) && !isNaN(lng)) return [lat, lng];
    var area = normalizeValue(venue.Area);
    for (var name in NEIGHBORHOOD_COORDS) {
      if (area.toLowerCase().indexOf(name.toLowerCase()) !== -1 || name.toLowerCase().indexOf(area.toLowerCase()) !== -1) {
        var c = NEIGHBORHOOD_COORDS[name];
        var jitter = function () { return (Math.random() - 0.5) * 0.004; };
        return [c[0] + jitter(), c[1] + jitter()];
      }
    }
    return null;
  }

  function venueToVenueDistanceMiles(venueA, venueB) {
    var coordsA = getCoordsForVenue(venueA);
    var coordsB = getCoordsForVenue(venueB);
    if (coordsA && coordsB && haversineMiles) {
      return haversineMiles(coordsA[0], coordsA[1], coordsB[0], coordsB[1]);
    }
    var distA = parseDistanceMiles(venueA["Driving Distance"]);
    var distB = parseDistanceMiles(venueB["Driving Distance"]);
    if (distA != null && distB != null) {
      return Math.abs(distA - distB);
    }
    return null;
  }

  function isWalkable(venueA, venueB) {
    var miles = venueToVenueDistanceMiles(venueA, venueB);
    return miles != null && miles <= WALKABLE_MILES;
  }

  exports.NEIGHBORHOOD_COORDS = NEIGHBORHOOD_COORDS;
  exports.getCoordsForVenue = getCoordsForVenue;
  exports.venueToVenueDistanceMiles = venueToVenueDistanceMiles;
  exports.isWalkable = isWalkable;
  exports.WALKABLE_MILES = WALKABLE_MILES;
})(typeof module !== "undefined" ? module.exports : (window.LNVGeo = window.LNVGeo || {}));
