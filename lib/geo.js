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
    seattle: {
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
      "Pioneer Square": [47.6015, -122.3340],
    },
    "new-york": {
      "Manhattan": [40.7831, -73.9712], "Brooklyn": [40.6782, -73.9442],
      "Queens": [40.7282, -73.7949], "Bronx": [40.8448, -73.8648],
      "Staten Island": [40.5795, -74.1502], "East Village": [40.7265, -73.9815],
      "West Village": [40.7336, -74.0027], "Williamsburg": [40.7081, -73.9571],
      "Harlem": [40.8116, -73.9465], "Lower East Side": [40.7150, -73.9843],
      "SoHo": [40.7233, -73.9985], "Chelsea": [40.7465, -74.0014],
      "Bushwick": [40.6944, -73.9213], "Astoria": [40.7723, -73.9301],
    },
    "los-angeles": {
      "Hollywood": [34.0928, -118.3287], "Silver Lake": [34.0869, -118.2702],
      "Echo Park": [34.0782, -118.2606], "Downtown LA": [34.0407, -118.2468],
      "West Hollywood": [34.0900, -118.3617], "Venice": [33.9850, -118.4695],
      "Santa Monica": [34.0195, -118.4912], "Koreatown": [34.0578, -118.3005],
      "Los Feliz": [34.1064, -118.2838], "Highland Park": [34.1114, -118.1901],
      "Arts District": [34.0404, -118.2321], "Culver City": [34.0211, -118.3965],
    },
    chicago: {
      "Wicker Park": [41.9088, -87.6796], "Logan Square": [41.9234, -87.7083],
      "Lincoln Park": [41.9214, -87.6513], "Lakeview": [41.9434, -87.6539],
      "Pilsen": [41.8523, -87.6563], "River North": [41.8920, -87.6310],
      "Wrigleyville": [41.9484, -87.6553], "Andersonville": [41.9795, -87.6688],
      "Bucktown": [41.9116, -87.6798], "Hyde Park": [41.7943, -87.5907],
      "Old Town": [41.9113, -87.6381], "Uptown": [41.9664, -87.6534],
    },
    houston: {
      "Montrose": [29.7445, -95.3908], "Midtown": [29.7388, -95.3774],
      "Heights": [29.7907, -95.3982], "Downtown Houston": [29.7604, -95.3698],
      "EaDo": [29.7494, -95.3502], "Rice Village": [29.7158, -95.4128],
      "Washington Avenue": [29.7678, -95.3977], "Upper Kirby": [29.7330, -95.4208],
      "Memorial Park": [29.7643, -95.4340], "River Oaks": [29.7505, -95.4267],
      "Third Ward": [29.7252, -95.3572], "Medical Center": [29.7079, -95.3990],
    },
    phoenix: {
      "Downtown Phoenix": [33.4484, -112.0740], "Scottsdale": [33.4942, -111.9261],
      "Tempe": [33.4255, -111.9400], "Old Town Scottsdale": [33.4920, -111.9260],
      "Roosevelt Row": [33.4527, -112.0649], "Arcadia": [33.5080, -111.9830],
      "Mill Avenue": [33.4253, -111.9400], "Central Phoenix": [33.4609, -112.0740],
      "Chandler": [33.3062, -111.8413], "Mesa": [33.4152, -111.8315],
      "Gilbert": [33.3528, -111.7890], "Camelback East": [33.5091, -112.0148],
    },
    philadelphia: {
      "Center City": [39.9526, -75.1652], "Fishtown": [39.9736, -75.1326],
      "Northern Liberties": [39.9662, -75.1384], "South Philly": [39.9295, -75.1680],
      "Old City": [39.9508, -75.1440], "University City": [39.9522, -75.1932],
      "Rittenhouse Square": [39.9495, -75.1714], "Manayunk": [40.0268, -75.2241],
      "East Passyunk": [39.9315, -75.1600], "Fairmount": [39.9680, -75.1750],
      "Kensington": [39.9814, -75.1220], "Spring Garden": [39.9615, -75.1590],
    },
    "san-antonio": {
      "Downtown": [29.4241, -98.4936], "Southtown": [29.4150, -98.4955],
      "Pearl District": [29.4425, -98.4800], "The Strip": [29.4620, -98.5196],
      "St. Mary's Strip": [29.4460, -98.4970], "Alamo Heights": [29.4841, -98.4627],
      "King William": [29.4140, -98.4916], "Stone Oak": [29.6260, -98.4840],
      "Monte Vista": [29.4560, -98.5020], "Tobin Hill": [29.4490, -98.4910],
      "Hemisfair": [29.4200, -98.4870], "Olmos Park": [29.4750, -98.4920],
    },
    "san-diego": {
      "Gaslamp Quarter": [32.7107, -117.1603], "North Park": [32.7407, -117.1292],
      "Hillcrest": [32.7488, -117.1631], "Pacific Beach": [32.7937, -117.2536],
      "Ocean Beach": [32.7489, -117.2494], "Little Italy": [32.7228, -117.1687],
      "East Village": [32.7143, -117.1538], "Normal Heights": [32.7626, -117.0980],
      "University Heights": [32.7622, -117.1300], "Mission Hills": [32.7519, -117.1823],
      "South Park": [32.7145, -117.1310], "La Jolla": [32.8328, -117.2713],
    },
    dallas: {
      "Deep Ellum": [32.7841, -96.7843], "Uptown": [32.8024, -96.8011],
      "Bishop Arts": [32.7460, -96.8275], "Lower Greenville": [32.8182, -96.7702],
      "Knox-Henderson": [32.8122, -96.7907], "Design District": [32.7909, -96.8195],
      "Oak Lawn": [32.8107, -96.8109], "Downtown Dallas": [32.7767, -96.7970],
      "Lakewood": [32.8178, -96.7376], "Trinity Groves": [32.7760, -96.8367],
      "Victory Park": [32.7874, -96.8094], "Cedar Springs": [32.8108, -96.8098],
    },
    "san-jose": {
      "Downtown San Jose": [37.3382, -121.8863], "Japantown": [37.3490, -121.8940],
      "Willow Glen": [37.3080, -121.9000], "Santana Row": [37.3210, -121.9470],
      "SoFA District": [37.3330, -121.8870], "The Alameda": [37.3450, -121.9050],
      "San Pedro Square": [37.3360, -121.8940], "Midtown": [37.3270, -121.8870],
      "Naglee Park": [37.3350, -121.8740], "Rose Garden": [37.3520, -121.9240],
      "Campbell": [37.2872, -121.9500], "Sunnyvale": [37.3688, -122.0363],
    },
  };

  /**
   * Get the flat neighborhood coords map for a given city slug.
   * Falls back to "seattle" if the slug is unknown.
   */
  function getNeighborhoodCoords(citySlug) {
    return NEIGHBORHOOD_COORDS[citySlug] || NEIGHBORHOOD_COORDS["seattle"] || {};
  }

  function getCoordsForVenue(venue, citySlug) {
    var lat = parseFloat(venue.Latitude);
    var lng = parseFloat(venue.Longitude);
    if (!isNaN(lat) && !isNaN(lng)) return [lat, lng];
    var coords = getNeighborhoodCoords(citySlug);
    var area = normalizeValue(venue.Area);
    for (var name in coords) {
      if (area.toLowerCase().indexOf(name.toLowerCase()) !== -1 || name.toLowerCase().indexOf(area.toLowerCase()) !== -1) {
        var c = coords[name];
        var jitter = function () { return (Math.random() - 0.5) * 0.004; };
        return [c[0] + jitter(), c[1] + jitter()];
      }
    }
    return null;
  }

  function venueToVenueDistanceMiles(venueA, venueB, citySlug) {
    var coordsA = getCoordsForVenue(venueA, citySlug);
    var coordsB = getCoordsForVenue(venueB, citySlug);
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

  function isWalkable(venueA, venueB, citySlug) {
    var miles = venueToVenueDistanceMiles(venueA, venueB, citySlug);
    return miles != null && miles <= WALKABLE_MILES;
  }

  exports.NEIGHBORHOOD_COORDS = NEIGHBORHOOD_COORDS;
  exports.getNeighborhoodCoords = getNeighborhoodCoords;
  exports.getCoordsForVenue = getCoordsForVenue;
  exports.venueToVenueDistanceMiles = venueToVenueDistanceMiles;
  exports.isWalkable = isWalkable;
  exports.WALKABLE_MILES = WALKABLE_MILES;
})(typeof module !== "undefined" ? module.exports : (window.LNVGeo = window.LNVGeo || {}));
