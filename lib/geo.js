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
      "Downtown_Belltown": [47.6120, -122.3400], "Chinatown_ID": [47.5982, -122.3252],
      "Lake City": [47.7106, -122.2910], "Madison Valley": [47.6340, -122.2930],
      "Madrona": [47.6120, -122.2870], "Northgate": [47.7080, -122.3290],
      "Crown Hill": [47.6920, -122.3710], "Auburn": [47.3073, -122.2285],
      "Burien": [47.4704, -122.3468], "Everett": [47.9790, -122.2021],
      "Kent": [47.3809, -122.2348], "Lake Forest Park": [47.7562, -122.2810],
      "Renton": [47.4829, -122.2171], "Shoreline": [47.7556, -122.3420],
      "Skyway": [47.4960, -122.2400], "Strip Clubs": [47.5900, -122.3300],
      "Tukwila": [47.4740, -122.2610],
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
    jacksonville: {
      "Avondale": [30.3130, -81.7050], "Downtown": [30.3274, -81.6590],
      "Five Points": [30.3135, -81.6690], "Jacksonville Beach": [30.2947, -81.3930],
      "Neptune Beach": [30.3140, -81.4060], "Riverside": [30.3140, -81.6820],
      "San Marco": [30.3120, -81.6450], "Southside": [30.2820, -81.5870],
      "Springfield": [30.3410, -81.6440], "Town Center": [30.2420, -81.5410],
    },
    austin: {
      "Downtown": [30.2672, -97.7431], "East Austin": [30.2630, -97.7200],
      "North Loop": [30.3170, -97.7210], "Rainey Street": [30.2570, -97.7390],
      "Red River Cultural District": [30.2690, -97.7370], "Sixth Street": [30.2672, -97.7400],
      "South Congress": [30.2480, -97.7490], "South Lamar": [30.2450, -97.7660],
      "West Sixth": [30.2710, -97.7560],
    },
    "fort-worth": {
      "Camp Bowie": [32.7480, -97.3830], "Cultural District": [32.7490, -97.3650],
      "Downtown": [32.7555, -97.3308], "Fairmount": [32.7400, -97.3390],
      "Magnolia Avenue": [32.7370, -97.3370], "Near Southside": [32.7350, -97.3330],
      "South Main": [32.7320, -97.3310], "Stockyards": [32.7882, -97.3473],
      "Sundance Square": [32.7570, -97.3300], "West 7th": [32.7600, -97.3480],
    },
    columbus: {
      "Arena District": [39.9690, -83.0130], "Brewery District": [39.9530, -83.0030],
      "Clintonville": [40.0330, -83.0190], "Downtown": [39.9612, -82.9988],
      "Franklinton": [39.9590, -83.0210], "German Village": [39.9440, -82.9910],
      "Grandview Heights": [39.9780, -83.0420], "Italian Village": [39.9770, -82.9970],
      "Old Town East": [39.9630, -82.9790], "Short North": [39.9770, -83.0030],
    },
    charlotte: {
      "Camp North End": [35.2520, -80.8520], "Dilworth": [35.2090, -80.8470],
      "Elizabeth": [35.2170, -80.8270], "Fourth Ward": [35.2310, -80.8480],
      "Montford": [35.2190, -80.8520], "NoDa": [35.2490, -80.8190],
      "Plaza Midwood": [35.2270, -80.8120], "South End": [35.2110, -80.8560],
      "Uptown": [35.2271, -80.8431],
    },
    indianapolis: {
      "Broad Ripple": [39.8690, -86.1420], "Downtown": [39.7684, -86.1581],
      "Fletcher Place": [39.7540, -86.1480], "Fountain Square": [39.7490, -86.1410],
      "Irvington": [39.7680, -86.0770], "Lockerbie Square": [39.7740, -86.1510],
      "Mass Ave": [39.7750, -86.1450], "SoBro": [39.8070, -86.1390],
      "Wholesale District": [39.7610, -86.1640],
    },
    "san-francisco": {
      "Castro": [37.7609, -122.4350], "Chinatown": [37.7941, -122.4078],
      "Dogpatch": [37.7580, -122.3870], "Financial District": [37.7946, -122.3999],
      "Hayes Valley": [37.7760, -122.4260], "Lower Haight": [37.7720, -122.4310],
      "Marina": [37.8015, -122.4368], "Mission": [37.7599, -122.4148],
      "North Beach": [37.8060, -122.4103], "Polk Gulch": [37.7890, -122.4200],
      "SoMa": [37.7785, -122.3950], "Tenderloin": [37.7847, -122.4141],
    },
    denver: {
      "Baker": [39.7090, -104.9900], "Capitol Hill": [39.7310, -104.9790],
      "Colfax": [39.7400, -104.9730], "Denver": [39.7392, -104.9903],
      "Five Points": [39.7550, -104.9800], "Highlands": [39.7630, -105.0060],
      "LoDo": [39.7530, -105.0000], "RiNo": [39.7650, -104.9810],
      "South Broadway": [39.7140, -104.9870], "Tennyson Street": [39.7730, -105.0460],
      "Uptown": [39.7460, -104.9720],
    },
    nashville: {
      "12 South": [36.1270, -86.7910], "Broadway": [36.1587, -86.7760],
      "East Nashville": [36.1780, -86.7520], "Germantown": [36.1810, -86.7870],
      "Hillsboro Village": [36.1320, -86.7990], "Marathon Village": [36.1700, -86.8020],
      "Midtown": [36.1510, -86.7980], "Printers Alley": [36.1630, -86.7780],
      "Sobro": [36.1540, -86.7740], "The Gulch": [36.1520, -86.7910],
    },
    "oklahoma-city": {
      "Automobile Alley": [35.4770, -97.5170], "Bricktown": [35.4640, -97.5080],
      "Classen Curve": [35.4900, -97.5380], "Deep Deuce": [35.4740, -97.5100],
      "Downtown": [35.4676, -97.5164], "Film Row": [35.4680, -97.5290],
      "Midtown": [35.4820, -97.5250], "Paseo Arts District": [35.4910, -97.5200],
      "Plaza District": [35.4950, -97.5310], "Western Avenue": [35.4880, -97.5450],
    },
    "el-paso": {
      "Central": [31.7700, -106.4440], "Cincinnati Avenue": [31.7650, -106.4490],
      "Downtown": [31.7619, -106.4850], "East Side": [31.7700, -106.3950],
      "Kern Place": [31.7780, -106.5080], "Montecillo": [31.7830, -106.5310],
      "Segundo Barrio": [31.7540, -106.4390], "Sunset Heights": [31.7730, -106.4680],
      "UTEP Area": [31.7700, -106.5050], "Westside": [31.7910, -106.5530],
    },
    "washington-dc": {
      "14th Street": [38.9150, -77.0320], "Adams Morgan": [38.9220, -77.0430],
      "Capitol Hill": [38.8870, -76.9990], "Columbia Heights": [38.9300, -77.0330],
      "Dupont Circle": [38.9096, -77.0434], "Georgetown": [38.9076, -77.0723],
      "H Street NE": [38.9000, -76.9900], "Logan Circle": [38.9090, -77.0290],
      "Navy Yard": [38.8760, -77.0030], "Penn Quarter": [38.8950, -77.0220],
      "Shaw": [38.9120, -77.0220], "U Street": [38.9170, -77.0350],
    },
    "las-vegas": {
      "Arts District": [36.1570, -115.1530], "Chinatown": [36.1260, -115.2080],
      "Downtown": [36.1699, -115.1398], "East Fremont": [36.1680, -115.1280],
      "Fremont East": [36.1700, -115.1350], "Paradise": [36.0970, -115.1370],
      "The Strip": [36.1147, -115.1728],
    },
    portland: {
      "Alberta Arts District": [45.5590, -122.6470], "Belmont": [45.5162, -122.6320],
      "Division": [45.5050, -122.6340], "Downtown": [45.5152, -122.6784],
      "Hawthorne": [45.5118, -122.6290], "Hollywood": [45.5350, -122.6190],
      "Inner Southeast": [45.5100, -122.6530], "Mississippi": [45.5530, -122.6760],
      "NW 23rd": [45.5320, -122.6990], "Pearl District": [45.5280, -122.6830],
      "Sellwood": [45.4740, -122.6530], "St. Johns": [45.5900, -122.7530],
    },
    memphis: {
      "Beale Street": [35.1394, -90.0530], "Broad Avenue": [35.1480, -89.9710],
      "Cooper-Young": [35.1170, -89.9880], "Crosstown": [35.1530, -89.9870],
      "Downtown": [35.1495, -90.0490], "Edge District": [35.1440, -90.0350],
      "Harbor Town": [35.1660, -90.0750], "Midtown": [35.1350, -89.9890],
      "Overton Square": [35.1370, -89.9910], "South Main": [35.1340, -90.0560],
    },
    louisville: {
      "Bardstown Road": [38.2360, -85.7220], "Butchertown": [38.2620, -85.7360],
      "Clifton": [38.2460, -85.7270], "Downtown": [38.2527, -85.7585],
      "Fourth Street Live": [38.2530, -85.7570], "Germantown": [38.2380, -85.7430],
      "Irish Hill": [38.2510, -85.7270], "NuLu": [38.2540, -85.7380],
      "Portland": [38.2650, -85.7810], "Shelby Park": [38.2380, -85.7320],
    },
    milwaukee: {
      "Bay View": [42.9970, -87.8960], "Brady Street": [43.0540, -87.8920],
      "Brewer's Hill": [43.0570, -87.9020], "Cathedral Square": [43.0410, -87.9070],
      "Downtown": [43.0389, -87.9065], "East Side": [43.0520, -87.8870],
      "Riverwest": [43.0620, -87.8990], "Third Ward": [43.0320, -87.9050],
      "Walker's Point": [43.0260, -87.9130], "Water Street": [43.0430, -87.9100],
    },
    baltimore: {
      "Canton": [39.2820, -76.5780], "Federal Hill": [39.2790, -76.6110],
      "Fells Point": [39.2820, -76.5920], "Hampden": [39.3310, -76.6330],
      "Harbor East": [39.2850, -76.5980], "Inner Harbor": [39.2860, -76.6122],
      "Locust Point": [39.2700, -76.5920], "Mount Vernon": [39.2970, -76.6155],
      "Remington": [39.3200, -76.6180], "Station North": [39.3100, -76.6160],
    },
    albuquerque: {
      "Barelas": [35.0720, -106.6540], "Downtown": [35.0844, -106.6504],
      "EDo": [35.0760, -106.6370], "Huning Highland": [35.0790, -106.6380],
      "Nob Hill": [35.0810, -106.6150], "North Valley": [35.1150, -106.6620],
      "Old Town": [35.0963, -106.6694], "Sawmill District": [35.0960, -106.6570],
      "Uptown": [35.1020, -106.5840], "Wells Park": [35.0920, -106.6480],
    },
    tucson: {
      "Armory Park": [32.2130, -110.9700], "Barrio Viejo": [32.2140, -110.9790],
      "Congress Street": [32.2210, -110.9700], "Downtown": [32.2226, -110.9747],
      "Fourth Avenue": [32.2250, -110.9680], "Iron Horse": [32.2270, -110.9620],
      "Lost Barrio": [32.2120, -110.9580], "Main Gate Square": [32.2310, -110.9530],
      "Oracle Road": [32.2560, -110.9700], "Sam Hughes": [32.2310, -110.9430],
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
