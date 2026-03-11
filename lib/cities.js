/**
 * Late Night Vibes — Multi-city configuration.
 *
 * US cities with 1M+ population (city proper, 2020 Census).
 * Each city defines its slug, display name, neighborhoods, coordinates,
 * and CSV data file path.
 *
 * UMD export: window.LNVCities in browser, module.exports in Node.
 */
(function (exports) {
  "use strict";

  var CITIES = {
    seattle: {
      slug: "seattle",
      name: "Seattle",
      state: "WA",
      label: "Seattle, WA",
      population: 737015,
      lat: 47.6062,
      lng: -122.3321,
      csv: "data/seattle.csv",
      tagline: "Emerald City after dark",
      neighborhoods: [
        "Capitol Hill", "Ballard", "Fremont", "University District",
        "Belltown", "Pioneer Square", "South Lake Union", "Georgetown",
        "Wallingford", "Green Lake", "Columbia City", "West Seattle",
      ],
    },
    "new-york": {
      slug: "new-york",
      name: "New York City",
      state: "NY",
      label: "New York City, NY",
      population: 8336817,
      lat: 40.7128,
      lng: -74.0060,
      csv: "data/new-york.csv",
      tagline: "The city that never sleeps",
      neighborhoods: [
        "Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island",
        "East Village", "West Village", "Williamsburg", "Harlem",
        "Lower East Side", "SoHo", "Chelsea", "Bushwick", "Astoria",
      ],
    },
    "los-angeles": {
      slug: "los-angeles",
      name: "Los Angeles",
      state: "CA",
      label: "Los Angeles, CA",
      population: 3898747,
      lat: 34.0522,
      lng: -118.2437,
      csv: "data/los-angeles.csv",
      tagline: "Late nights under neon palms",
      neighborhoods: [
        "Hollywood", "Silver Lake", "Echo Park", "Downtown LA",
        "West Hollywood", "Venice", "Santa Monica", "Koreatown",
        "Los Feliz", "Highland Park", "Arts District", "Culver City",
      ],
    },
    chicago: {
      slug: "chicago",
      name: "Chicago",
      state: "IL",
      label: "Chicago, IL",
      population: 2746388,
      lat: 41.8781,
      lng: -87.6298,
      csv: "data/chicago.csv",
      tagline: "Blues, jazz, and late-night bites",
      neighborhoods: [
        "Wicker Park", "Logan Square", "Lincoln Park", "Lakeview",
        "Pilsen", "River North", "Wrigleyville", "Andersonville",
        "Bucktown", "Hyde Park", "Old Town", "Uptown",
      ],
    },
    houston: {
      slug: "houston",
      name: "Houston",
      state: "TX",
      label: "Houston, TX",
      population: 2304580,
      lat: 29.7604,
      lng: -95.3698,
      csv: "data/houston.csv",
      tagline: "Space City nightlife",
      neighborhoods: [
        "Montrose", "Midtown", "Heights", "Downtown Houston",
        "EaDo", "Rice Village", "Washington Avenue", "Upper Kirby",
        "Memorial Park", "River Oaks", "Third Ward", "Medical Center",
      ],
    },
    phoenix: {
      slug: "phoenix",
      name: "Phoenix",
      state: "AZ",
      label: "Phoenix, AZ",
      population: 1608139,
      lat: 33.4484,
      lng: -112.0740,
      csv: "data/phoenix.csv",
      tagline: "Desert nights, electric vibes",
      neighborhoods: [
        "Downtown Phoenix", "Scottsdale", "Tempe", "Old Town Scottsdale",
        "Roosevelt Row", "Arcadia", "Mill Avenue", "Central Phoenix",
        "Chandler", "Mesa", "Gilbert", "Camelback East",
      ],
    },
    philadelphia: {
      slug: "philadelphia",
      name: "Philadelphia",
      state: "PA",
      label: "Philadelphia, PA",
      population: 1603797,
      lat: 39.9526,
      lng: -75.1652,
      csv: "data/philadelphia.csv",
      tagline: "City of Brotherly Love after hours",
      neighborhoods: [
        "Center City", "Fishtown", "Northern Liberties", "South Philly",
        "Old City", "University City", "Rittenhouse Square", "Manayunk",
        "East Passyunk", "Fairmount", "Kensington", "Spring Garden",
      ],
    },
    "san-antonio": {
      slug: "san-antonio",
      name: "San Antonio",
      state: "TX",
      label: "San Antonio, TX",
      population: 1547253,
      lat: 29.4241,
      lng: -98.4936,
      csv: "data/san-antonio.csv",
      tagline: "Riverwalk nights and Tex-Mex vibes",
      neighborhoods: [
        "Downtown", "Southtown", "Pearl District", "The Strip",
        "St. Mary's Strip", "Alamo Heights", "King William", "Stone Oak",
        "Monte Vista", "Tobin Hill", "Hemisfair", "Olmos Park",
      ],
    },
    "san-diego": {
      slug: "san-diego",
      name: "San Diego",
      state: "CA",
      label: "San Diego, CA",
      population: 1386932,
      lat: 32.7157,
      lng: -117.1611,
      csv: "data/san-diego.csv",
      tagline: "West Coast chill meets nightlife",
      neighborhoods: [
        "Gaslamp Quarter", "North Park", "Hillcrest", "Pacific Beach",
        "Ocean Beach", "Little Italy", "East Village", "Normal Heights",
        "University Heights", "Mission Hills", "South Park", "La Jolla",
      ],
    },
    dallas: {
      slug: "dallas",
      name: "Dallas",
      state: "TX",
      label: "Dallas, TX",
      population: 1304379,
      lat: 32.7767,
      lng: -96.7970,
      csv: "data/dallas.csv",
      tagline: "Big Texas nights out",
      neighborhoods: [
        "Deep Ellum", "Uptown", "Bishop Arts", "Lower Greenville",
        "Knox-Henderson", "Design District", "Oak Lawn", "Downtown Dallas",
        "Lakewood", "Trinity Groves", "Victory Park", "Cedar Springs",
      ],
    },
    "san-jose": {
      slug: "san-jose",
      name: "San Jose",
      state: "CA",
      label: "San Jose, CA",
      population: 1013240,
      lat: 37.3382,
      lng: -121.8863,
      csv: "data/san-jose.csv",
      tagline: "Silicon Valley after hours",
      neighborhoods: [
        "Downtown San Jose", "Japantown", "Willow Glen", "Santana Row",
        "SoFA District", "The Alameda", "San Pedro Square", "Midtown",
        "Naglee Park", "Rose Garden", "Campbell", "Sunnyvale",
      ],
    },
  };

  var DEFAULT_CITY = "seattle";
  var CITY_STORAGE_KEY = "lnv_city";

  /**
   * Get the current city slug from (in order):
   * 1. ?city= query param
   * 2. localStorage
   * 3. Default (seattle)
   */
  function getCurrentCitySlug() {
    if (typeof window === "undefined") return DEFAULT_CITY;
    var params = new URLSearchParams(window.location.search);
    var paramCity = params.get("city");
    if (paramCity && CITIES[paramCity]) {
      localStorage.setItem(CITY_STORAGE_KEY, paramCity);
      return paramCity;
    }
    var stored = localStorage.getItem(CITY_STORAGE_KEY);
    if (stored && CITIES[stored]) return stored;
    return DEFAULT_CITY;
  }

  function getCurrentCity() {
    return CITIES[getCurrentCitySlug()] || CITIES[DEFAULT_CITY];
  }

  function setCity(slug) {
    if (!CITIES[slug]) return false;
    localStorage.setItem(CITY_STORAGE_KEY, slug);
    return true;
  }

  function getAllCities() {
    return Object.values(CITIES).sort(function (a, b) {
      return b.population - a.population;
    });
  }

  function getCityBySlug(slug) {
    return CITIES[slug] || null;
  }

  /**
   * Inject city-aware query param into a URL (preserving other params).
   */
  function cityLink(href, citySlug) {
    var slug = citySlug || getCurrentCitySlug();
    if (slug === DEFAULT_CITY) return href;
    var sep = href.includes("?") ? "&" : "?";
    return href + sep + "city=" + slug;
  }

  exports.CITIES = CITIES;
  exports.DEFAULT_CITY = DEFAULT_CITY;
  exports.getCurrentCitySlug = getCurrentCitySlug;
  exports.getCurrentCity = getCurrentCity;
  exports.setCity = setCity;
  exports.getAllCities = getAllCities;
  exports.getCityBySlug = getCityBySlug;
  exports.cityLink = cityLink;

})(typeof module !== "undefined" ? module.exports : (window.LNVCities = {}));
