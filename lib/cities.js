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
      description: "Discover Seattle's best late-night bars, clubs, and venues. From Capitol Hill dives to Ballard breweries.",
      ogDescription: "Discover Seattle's best late-night bars, clubs, and venues. From Capitol Hill dives to Ballard breweries — plan your perfect night out.",
      neighborhoods: [
        "Capitol Hill", "Ballard", "Fremont", "University District",
        "Belltown", "Pioneer Square", "South Lake Union", "Georgetown",
        "Wallingford", "Green Lake", "Columbia City", "West Seattle",
        "Downtown_Belltown", "Chinatown_ID", "Queen Anne", "Beacon Hill",
        "Central District", "First Hill", "Greenwood", "Lake City",
        "Madison Valley", "Madrona", "Magnolia", "Northgate", "Rainier Valley",
        "SoDo", "Crown Hill", "Interbay", "White Center", "Auburn",
        "Burien", "Eastside", "Everett", "Kent", "Lake Forest Park",
        "Renton", "Shoreline", "Skyway", "Strip Clubs", "Tukwila",
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
      description: "Explore NYC's hottest late-night spots. From East Village cocktail bars to Williamsburg nightclubs.",
      ogDescription: "Explore NYC's hottest late-night spots. From East Village cocktail bars to Williamsburg nightclubs — your guide to the city that never sleeps.",
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
      description: "Find LA's top late-night bars, rooftop lounges, and clubs. From Hollywood nightlife to Silver Lake hangouts.",
      ogDescription: "Find LA's top late-night bars, rooftop lounges, and clubs. From Hollywood nightlife to Silver Lake hangouts — explore after dark.",
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
      description: "Discover Chicago's vibrant late-night scene. Jazz clubs, rooftop bars, and neighborhood dives from Wicker Park to Logan Square.",
      ogDescription: "Discover Chicago's vibrant late-night scene. Jazz clubs, rooftop bars, and neighborhood dives — explore the Windy City after hours.",
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
      description: "Explore Houston's diverse late-night scene. Montrose cocktail bars, Midtown clubs, and Heights breweries.",
      ogDescription: "Explore Houston's diverse late-night scene. Montrose cocktail bars, Midtown clubs, and Heights breweries — Space City after dark.",
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
      description: "Browse Phoenix's best late-night venues. Downtown cocktail bars, Scottsdale lounges, and Tempe college spots.",
      ogDescription: "Browse Phoenix's best late-night venues. Downtown cocktail bars, Scottsdale lounges, and Tempe college spots — desert nights done right.",
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
      description: "Find Philadelphia's top late-night bars and venues. Fishtown dives, Old City pubs, and Rittenhouse cocktail lounges.",
      ogDescription: "Find Philadelphia's top late-night bars and venues. Fishtown dives, Old City pubs, and Rittenhouse cocktail lounges — Philly after hours.",
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
      description: "Discover San Antonio's late-night scene. Riverwalk bars, St. Mary's Strip dives, and Pearl District cocktail spots.",
      ogDescription: "Discover San Antonio's late-night scene. Riverwalk bars, St. Mary's Strip dives, and Pearl District cocktail spots — Alamo City after dark.",
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
      description: "Explore San Diego's best late-night venues. Gaslamp Quarter clubs, North Park breweries, and Pacific Beach bars.",
      ogDescription: "Explore San Diego's best late-night venues. Gaslamp Quarter clubs, North Park breweries, and Pacific Beach bars — SoCal nights.",
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
      description: "Browse Dallas's hottest late-night spots. Deep Ellum live music, Uptown lounges, and Bishop Arts cocktail bars.",
      ogDescription: "Browse Dallas's hottest late-night spots. Deep Ellum live music, Uptown lounges, and Bishop Arts cocktail bars — Big D after dark.",
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
      description: "Find San Jose's best late-night venues. Downtown bars, Santana Row lounges, and SoFA District nightlife.",
      ogDescription: "Find San Jose's best late-night venues. Downtown bars, Santana Row lounges, and SoFA District nightlife — Silicon Valley after hours.",
      neighborhoods: [
        "Downtown San Jose", "Japantown", "Willow Glen", "Santana Row",
        "SoFA District", "The Alameda", "San Pedro Square", "Midtown",
        "Naglee Park", "Rose Garden", "Campbell", "Sunnyvale",
      ],
    },
    jacksonville: {
      slug: "jacksonville",
      name: "Jacksonville",
      state: "FL",
      label: "Jacksonville, FL",
      population: 949611,
      lat: 30.3322,
      lng: -81.6557,
      csv: "data/jacksonville.csv",
      tagline: "River City nights run deep",
      description: "Discover Jacksonville's best late-night bars, breweries, and venues. From Five Points hangouts to Jacksonville Beach nightlife.",
      ogDescription: "Discover Jacksonville's best late-night bars, breweries, and venues. From Five Points hangouts to Jacksonville Beach nightlife — explore River City after dark.",
      neighborhoods: [
        "Avondale", "Downtown", "Five Points", "Jacksonville Beach",
        "Neptune Beach", "Riverside", "San Marco", "Southside",
        "Springfield", "Town Center",
      ],
    },
    austin: {
      slug: "austin",
      name: "Austin",
      state: "TX",
      label: "Austin, TX",
      population: 961855,
      lat: 30.2672,
      lng: -97.7431,
      csv: "data/austin.csv",
      tagline: "Keep Austin weird after midnight",
      description: "Explore Austin's legendary late-night scene. Sixth Street bars, Rainey Street patios, and East Austin dives.",
      ogDescription: "Explore Austin's legendary late-night scene. Sixth Street bars, Rainey Street patios, and East Austin dives — live music capital after dark.",
      neighborhoods: [
        "Downtown", "East Austin", "North Loop", "Rainey Street",
        "Red River Cultural District", "Sixth Street", "South Congress",
        "South Lamar", "West Sixth",
      ],
    },
    "fort-worth": {
      slug: "fort-worth",
      name: "Fort Worth",
      state: "TX",
      label: "Fort Worth, TX",
      population: 918915,
      lat: 32.7555,
      lng: -97.3308,
      csv: "data/fort-worth.csv",
      tagline: "Where the West comes alive at night",
      description: "Find Fort Worth's best late-night spots. Stockyards honky-tonks, Magnolia Avenue bars, and West 7th nightlife.",
      ogDescription: "Find Fort Worth's best late-night spots. Stockyards honky-tonks, Magnolia Avenue bars, and West 7th nightlife — Cowtown after hours.",
      neighborhoods: [
        "Camp Bowie", "Cultural District", "Downtown", "Fairmount",
        "Magnolia Avenue", "Near Southside", "South Main", "Stockyards",
        "Sundance Square", "West 7th",
      ],
    },
    columbus: {
      slug: "columbus",
      name: "Columbus",
      state: "OH",
      label: "Columbus, OH",
      population: 905748,
      lat: 39.9612,
      lng: -82.9988,
      csv: "data/columbus.csv",
      tagline: "Arch City after-hours adventures",
      description: "Discover Columbus's vibrant late-night scene. Short North galleries, German Village pubs, and Arena District nightlife.",
      ogDescription: "Discover Columbus's vibrant late-night scene. Short North galleries, German Village pubs, and Arena District nightlife — explore Ohio's capital after dark.",
      neighborhoods: [
        "Arena District", "Brewery District", "Clintonville", "Downtown",
        "Franklinton", "German Village", "Grandview Heights", "Italian Village",
        "Old Town East", "Short North",
      ],
    },
    charlotte: {
      slug: "charlotte",
      name: "Charlotte",
      state: "NC",
      label: "Charlotte, NC",
      population: 874579,
      lat: 35.2271,
      lng: -80.8431,
      csv: "data/charlotte.csv",
      tagline: "Queen City nightlife reigns",
      description: "Browse Charlotte's best late-night venues. NoDa breweries, South End bars, and Uptown cocktail lounges.",
      ogDescription: "Browse Charlotte's best late-night venues. NoDa breweries, South End bars, and Uptown cocktail lounges — Queen City after dark.",
      neighborhoods: [
        "Camp North End", "Dilworth", "Elizabeth", "Fourth Ward",
        "Montford", "NoDa", "Plaza Midwood", "South End", "Uptown",
      ],
    },
    indianapolis: {
      slug: "indianapolis",
      name: "Indianapolis",
      state: "IN",
      label: "Indianapolis, IN",
      population: 887642,
      lat: 39.7684,
      lng: -86.1581,
      csv: "data/indianapolis.csv",
      tagline: "Circle City spins all night",
      description: "Explore Indianapolis's late-night scene. Mass Ave cocktail bars, Broad Ripple pubs, and Fountain Square dives.",
      ogDescription: "Explore Indianapolis's late-night scene. Mass Ave cocktail bars, Broad Ripple pubs, and Fountain Square dives — Circle City after hours.",
      neighborhoods: [
        "Broad Ripple", "Downtown", "Fletcher Place", "Fountain Square",
        "Irvington", "Lockerbie Square", "Mass Ave", "SoBro",
        "Wholesale District",
      ],
    },
    "san-francisco": {
      slug: "san-francisco",
      name: "San Francisco",
      state: "CA",
      label: "San Francisco, CA",
      population: 873965,
      lat: 37.7749,
      lng: -122.4194,
      csv: "data/san-francisco.csv",
      tagline: "Fog-kissed nights by the bay",
      description: "Find San Francisco's top late-night spots. Mission District taquerias, North Beach bars, and SoMa nightclubs.",
      ogDescription: "Find San Francisco's top late-night spots. Mission District taquerias, North Beach bars, and SoMa nightclubs — City by the Bay after dark.",
      neighborhoods: [
        "Castro", "Chinatown", "Dogpatch", "Financial District",
        "Hayes Valley", "Lower Haight", "Marina", "Mission",
        "North Beach", "Polk Gulch", "SoMa", "Tenderloin",
      ],
    },
    denver: {
      slug: "denver",
      name: "Denver",
      state: "CO",
      label: "Denver, CO",
      population: 715522,
      lat: 39.7392,
      lng: -104.9903,
      csv: "data/denver.csv",
      tagline: "Mile High nightlife",
      description: "Discover Denver's best late-night venues. RiNo breweries, LoDo bars, and Capitol Hill cocktail lounges.",
      ogDescription: "Discover Denver's best late-night venues. RiNo breweries, LoDo bars, and Capitol Hill cocktail lounges — Mile High City after dark.",
      neighborhoods: [
        "Baker", "Capitol Hill", "Colfax", "Denver", "Five Points",
        "Highlands", "LoDo", "RiNo", "South Broadway",
        "Tennyson Street", "Uptown",
      ],
    },
    nashville: {
      slug: "nashville",
      name: "Nashville",
      state: "TN",
      label: "Nashville, TN",
      population: 689447,
      lat: 36.1627,
      lng: -86.7816,
      csv: "data/nashville.csv",
      tagline: "Music City never stops playing",
      description: "Explore Nashville's legendary late-night scene. Broadway honky-tonks, East Nashville dives, and Gulch cocktail bars.",
      ogDescription: "Explore Nashville's legendary late-night scene. Broadway honky-tonks, East Nashville dives, and Gulch cocktail bars — Music City after dark.",
      neighborhoods: [
        "12 South", "Broadway", "East Nashville", "Germantown",
        "Hillsboro Village", "Marathon Village", "Midtown",
        "Printers Alley", "Sobro", "The Gulch",
      ],
    },
    "oklahoma-city": {
      slug: "oklahoma-city",
      name: "Oklahoma City",
      state: "OK",
      label: "Oklahoma City, OK",
      population: 681054,
      lat: 35.4676,
      lng: -97.5164,
      csv: "data/oklahoma-city.csv",
      tagline: "OKC nights thunder on",
      description: "Browse Oklahoma City's best late-night spots. Bricktown entertainment, Paseo Arts District bars, and Midtown lounges.",
      ogDescription: "Browse Oklahoma City's best late-night spots. Bricktown entertainment, Paseo Arts District bars, and Midtown lounges — OKC after hours.",
      neighborhoods: [
        "Automobile Alley", "Bricktown", "Classen Curve", "Deep Deuce",
        "Downtown", "Film Row", "Midtown", "Paseo Arts District",
        "Plaza District", "Western Avenue",
      ],
    },
    "el-paso": {
      slug: "el-paso",
      name: "El Paso",
      state: "TX",
      label: "El Paso, TX",
      population: 678815,
      lat: 31.7619,
      lng: -106.4850,
      csv: "data/el-paso.csv",
      tagline: "Sun City glows after sundown",
      description: "Discover El Paso's late-night scene. Cincinnati Avenue bars, Downtown cantinas, and Sunset Heights hangouts.",
      ogDescription: "Discover El Paso's late-night scene. Cincinnati Avenue bars, Downtown cantinas, and Sunset Heights hangouts — Sun City after dark.",
      neighborhoods: [
        "Central", "Cincinnati Avenue", "Downtown", "East Side",
        "Kern Place", "Montecillo", "Segundo Barrio", "Sunset Heights",
        "UTEP Area", "Westside",
      ],
    },
    "washington-dc": {
      slug: "washington-dc",
      name: "Washington",
      state: "DC",
      label: "Washington, DC",
      population: 689545,
      lat: 38.9072,
      lng: -77.0369,
      csv: "data/washington-dc.csv",
      tagline: "The capital of late-night culture",
      description: "Find Washington DC's best late-night venues. U Street jazz clubs, Adams Morgan bars, and Georgetown nightlife.",
      ogDescription: "Find Washington DC's best late-night venues. U Street jazz clubs, Adams Morgan bars, and Georgetown nightlife — the capital after hours.",
      neighborhoods: [
        "14th Street", "Adams Morgan", "Capitol Hill", "Columbia Heights",
        "Dupont Circle", "Georgetown", "H Street NE", "Logan Circle",
        "Navy Yard", "Penn Quarter", "Shaw", "U Street",
      ],
    },
    "las-vegas": {
      slug: "las-vegas",
      name: "Las Vegas",
      state: "NV",
      label: "Las Vegas, NV",
      population: 641903,
      lat: 36.1699,
      lng: -115.1398,
      csv: "data/las-vegas.csv",
      tagline: "The city that invented nightlife",
      description: "Explore Las Vegas's legendary late-night scene. Strip megaclubs, Fremont East cocktail bars, and Arts District lounges.",
      ogDescription: "Explore Las Vegas's legendary late-night scene. Strip megaclubs, Fremont East cocktail bars, and Arts District lounges — Vegas never sleeps.",
      neighborhoods: [
        "Arts District", "Chinatown", "Downtown", "East Fremont",
        "Fremont East", "Paradise", "The Strip",
      ],
    },
    portland: {
      slug: "portland",
      name: "Portland",
      state: "OR",
      label: "Portland, OR",
      population: 652503,
      lat: 45.5152,
      lng: -122.6784,
      csv: "data/portland.csv",
      tagline: "Keep Portland weird after dark",
      description: "Discover Portland's eclectic late-night scene. Alberta Arts District dives, Pearl District cocktail bars, and Hawthorne hangouts.",
      ogDescription: "Discover Portland's eclectic late-night scene. Alberta Arts District dives, Pearl District cocktail bars, and Hawthorne hangouts — Rose City after hours.",
      neighborhoods: [
        "Alberta Arts District", "Belmont", "Division", "Downtown",
        "Hawthorne", "Hollywood", "Inner Southeast", "Mississippi",
        "NW 23rd", "Pearl District", "Sellwood", "St. Johns",
      ],
    },
    memphis: {
      slug: "memphis",
      name: "Memphis",
      state: "TN",
      label: "Memphis, TN",
      population: 633104,
      lat: 35.1495,
      lng: -90.0490,
      csv: "data/memphis.csv",
      tagline: "Blues, BBQ, and late-night soul",
      description: "Explore Memphis's iconic late-night scene. Beale Street blues clubs, Cooper-Young bars, and South Main hangouts.",
      ogDescription: "Explore Memphis's iconic late-night scene. Beale Street blues clubs, Cooper-Young bars, and South Main hangouts — Bluff City after dark.",
      neighborhoods: [
        "Beale Street", "Broad Avenue", "Cooper-Young", "Crosstown",
        "Downtown", "Edge District", "Harbor Town", "Midtown",
        "Overton Square", "South Main",
      ],
    },
    louisville: {
      slug: "louisville",
      name: "Louisville",
      state: "KY",
      label: "Louisville, KY",
      population: 633045,
      lat: 38.2527,
      lng: -85.7585,
      csv: "data/louisville.csv",
      tagline: "Bourbon and nightlife run strong",
      description: "Find Louisville's best late-night venues. Bardstown Road bars, NuLu cocktail lounges, and Butchertown breweries.",
      ogDescription: "Find Louisville's best late-night venues. Bardstown Road bars, NuLu cocktail lounges, and Butchertown breweries — Derby City after dark.",
      neighborhoods: [
        "Bardstown Road", "Butchertown", "Clifton", "Downtown",
        "Fourth Street Live", "Germantown", "Irish Hill", "NuLu",
        "Portland", "Shelby Park",
      ],
    },
    milwaukee: {
      slug: "milwaukee",
      name: "Milwaukee",
      state: "WI",
      label: "Milwaukee, WI",
      population: 577222,
      lat: 43.0389,
      lng: -87.9065,
      csv: "data/milwaukee.csv",
      tagline: "Brew City pours all night",
      description: "Browse Milwaukee's best late-night spots. Brady Street bars, Third Ward cocktail lounges, and Bay View dives.",
      ogDescription: "Browse Milwaukee's best late-night spots. Brady Street bars, Third Ward cocktail lounges, and Bay View dives — Brew City after hours.",
      neighborhoods: [
        "Bay View", "Brady Street", "Brewer's Hill", "Cathedral Square",
        "Downtown", "East Side", "Riverwest", "Third Ward",
        "Walker's Point", "Water Street",
      ],
    },
    baltimore: {
      slug: "baltimore",
      name: "Baltimore",
      state: "MD",
      label: "Baltimore, MD",
      population: 585708,
      lat: 39.2904,
      lng: -76.6122,
      csv: "data/baltimore.csv",
      tagline: "Charm City glows after dark",
      description: "Discover Baltimore's vibrant late-night scene. Fells Point pubs, Federal Hill bars, and Hampden cocktail spots.",
      ogDescription: "Discover Baltimore's vibrant late-night scene. Fells Point pubs, Federal Hill bars, and Hampden cocktail spots — Charm City after hours.",
      neighborhoods: [
        "Canton", "Federal Hill", "Fells Point", "Hampden",
        "Harbor East", "Inner Harbor", "Locust Point", "Mount Vernon",
        "Remington", "Station North",
      ],
    },
    albuquerque: {
      slug: "albuquerque",
      name: "Albuquerque",
      state: "NM",
      label: "Albuquerque, NM",
      population: 564559,
      lat: 35.0844,
      lng: -106.6504,
      csv: "data/albuquerque.csv",
      tagline: "Desert nights with a New Mexican twist",
      description: "Find Albuquerque's best late-night venues. Nob Hill bars, Downtown lounges, and EDo neighborhood hangouts.",
      ogDescription: "Find Albuquerque's best late-night venues. Nob Hill bars, Downtown lounges, and EDo neighborhood hangouts — Duke City after dark.",
      neighborhoods: [
        "Barelas", "Downtown", "EDo", "Huning Highland", "Nob Hill",
        "North Valley", "Old Town", "Sawmill District", "Uptown",
        "Wells Park",
      ],
    },
    tucson: {
      slug: "tucson",
      name: "Tucson",
      state: "AZ",
      label: "Tucson, AZ",
      population: 542629,
      lat: 32.2226,
      lng: -110.9747,
      csv: "data/tucson.csv",
      tagline: "Old Pueblo nights run wild",
      description: "Explore Tucson's eclectic late-night scene. Fourth Avenue bars, Congress Street clubs, and Downtown cantinas.",
      ogDescription: "Explore Tucson's eclectic late-night scene. Fourth Avenue bars, Congress Street clubs, and Downtown cantinas — Old Pueblo after dark.",
      neighborhoods: [
        "Armory Park", "Barrio Viejo", "Congress Street", "Downtown",
        "Fourth Avenue", "Iron Horse", "Lost Barrio", "Main Gate Square",
        "Oracle Road", "Sam Hughes",
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

  /**
   * Return a city-scoped localStorage key: baseKey + "_" + currentCitySlug.
   * Example: getCityKey("lnv_crawl_history") → "lnv_crawl_history_seattle"
   */
  function getCityKey(baseKey) {
    return baseKey + "_" + getCurrentCitySlug();
  }

  /**
   * Migrate an un-scoped localStorage key to the default city's scoped key.
   * Called once per key on first access: if the old key exists and the
   * default-city-scoped key does not, copy the value over.
   */
  function migrateKeyIfNeeded(baseKey) {
    try {
      if (typeof localStorage === "undefined") return;
      var scopedKey = baseKey + "_" + DEFAULT_CITY;
      var oldValue = localStorage.getItem(baseKey);
      if (oldValue !== null && localStorage.getItem(scopedKey) === null) {
        localStorage.setItem(scopedKey, oldValue);
      }
    } catch (_) { /* silently ignore */ }
  }

  exports.CITIES = CITIES;
  exports.DEFAULT_CITY = DEFAULT_CITY;
  exports.getCurrentCitySlug = getCurrentCitySlug;
  exports.getCurrentCity = getCurrentCity;
  exports.setCity = setCity;
  exports.getAllCities = getAllCities;
  exports.getCityBySlug = getCityBySlug;
  exports.cityLink = cityLink;
  exports.getCityKey = getCityKey;
  exports.migrateKeyIfNeeded = migrateKeyIfNeeded;

})(typeof module !== "undefined" ? module.exports : (window.LNVCities = {}));
