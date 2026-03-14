/**
 * Venue Photos Module
 *
 * Configure your API key in config.js (see config.example.js).
 * With a key: uses Google Places API for real venue photos.
 * Without a key: uses Picsum Photos for unique placeholder imagery (gradient-free).
 *
 * To get a key:
 *  1. Go to https://console.cloud.google.com/
 *  2. Enable "Places API" and "Places API (New)"
 *  3. Create an API key and restrict it to your domain
 *  4. Add it to config.js
 */
const GOOGLE_PLACES_API_KEY = (window.LNV_CONFIG && window.LNV_CONFIG.googlePlacesApiKey) || "";
const PHOTO_MAX_WIDTH = 400;
const PICSUM_BASE = "https://picsum.photos/seed/";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days
const MAX_CACHE_ENTRIES = 200;
const CACHE_KEY = "lnv_photo_cache_v1";

const photoCache = loadCache();

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch (_) {
    return {};
  }
}

function persistCache() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(photoCache));
  } catch (_) {}
}

function trimCacheIfNeeded() {
  const entries = Object.entries(photoCache);
  if (entries.length <= MAX_CACHE_ENTRIES) return;
  entries.sort((a, b) => (a[1].ts || 0) - (b[1].ts || 0));
  const toRemove = entries.slice(0, entries.length - MAX_CACHE_ENTRIES);
  toRemove.forEach(([key]) => { delete photoCache[key]; });
  persistCache();
}

function getCachedPhoto(cacheKey) {
  const entry = photoCache[cacheKey];
  if (!entry) return undefined;
  if (!entry.ts || Date.now() - entry.ts > CACHE_TTL_MS) {
    delete photoCache[cacheKey];
    persistCache();
    return undefined;
  }
  return entry.url;
}

function setCachedPhoto(cacheKey, url) {
  photoCache[cacheKey] = { url, ts: Date.now() };
  trimCacheIfNeeded();
  persistCache();
}

/**
 * Search for a venue photo using Google Places Text Search.
 * Returns a photo URL or null.
 */
async function fetchVenuePhoto(venueName, area) {
  if (!GOOGLE_PLACES_API_KEY) return null;

  const cacheKey = `${venueName}|${area}`;
  const cached = getCachedPhoto(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const cityName = (window.LNVCities && window.LNVCities.getCurrentCity()) ? window.LNVCities.getCurrentCity().name : "";
    const query = `${venueName} ${area} ${cityName}`;
    const resp = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": "places.photos",
      },
      body: JSON.stringify({
        textQuery: query,
        maxResultCount: 1,
      }),
    });

    if (!resp.ok) {
      setCachedPhoto(cacheKey, null);
      return null;
    }

    const data = await resp.json();
    const places = data.places || [];
    const photos = places.length ? (places[0].photos || []) : [];
    if (!photos.length || !photos[0].name) {
      setCachedPhoto(cacheKey, null);
      return null;
    }

    const photoName = photos[0].name;
    const photoUrl = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${PHOTO_MAX_WIDTH}&key=${GOOGLE_PLACES_API_KEY}`;
    setCachedPhoto(cacheKey, photoUrl);
    return photoUrl;
  } catch (err) {
    setCachedPhoto(cacheKey, null);
    return null;
  }
}

/**
 * Simple string hash for Picsum seed (deterministic per venue).
 */
function simpleHash(str) {
  let h = 0;
  const s = String(str || "");
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h = h & h;
  }
  return Math.abs(h).toString(36);
}

/**
 * Get fallback placeholder image URL (Picsum) when no Places API key.
 */
function getPicsumFallbackUrl(venueName, area) {
  const seed = simpleHash(`${venueName}|${area}`);
  return `${PICSUM_BASE}${seed}/400/300`;
}

/**
 * Apply a photo to a card's poster element.
 * Uses Google Places when API key is set; otherwise uses Picsum placeholders.
 */
async function applyVenuePhoto(posterEl, venueName, area) {
  if (!posterEl) return;

  if (GOOGLE_PLACES_API_KEY) {
    const url = await fetchVenuePhoto(venueName, area);
    if (url) {
      posterEl.style.backgroundImage = `url(${url})`;
      posterEl.style.backgroundSize = "cover";
      posterEl.style.backgroundPosition = "center";
      return;
    }
  }

  // Fallback: Picsum Photos for unique imagery per venue (no API key needed)
  const fallbackUrl = getPicsumFallbackUrl(venueName, area);
  posterEl.style.backgroundImage = `url(${fallbackUrl})`;
  posterEl.style.backgroundSize = "cover";
  posterEl.style.backgroundPosition = "center";
}

/**
 * Lazy-load venue photo when poster enters viewport.
 * Uses Intersection Observer to defer loading until near view.
 */
function applyVenuePhotoWhenVisible(posterEl, venueName, area) {
  if (!posterEl || !venueName) return;

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        io.unobserve(entry.target);
        const el = entry.target;
        const name = el.dataset.venueName;
        const areaVal = el.dataset.venueArea || "";
        applyVenuePhoto(el, name, areaVal);
      }
    },
    { rootMargin: "100px", threshold: 0.01 }
  );

  posterEl.dataset.venueName = venueName;
  posterEl.dataset.venueArea = area || "";
  io.observe(posterEl);
}

// Expose globally
window.venuePhotos = {
  isEnabled: () => true,
  applyVenuePhoto,
  applyVenuePhotoWhenVisible,
  fetchVenuePhoto,
};
