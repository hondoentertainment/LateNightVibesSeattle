/**
 * Venue Photos Module
 * 
 * Set your Google Places API key below to enable venue photos on cards.
 * Without a key, cards use the existing color gradient posters.
 * 
 * To get a key:
 *  1. Go to https://console.cloud.google.com/
 *  2. Enable "Places API" and "Places API (New)"
 *  3. Create an API key and restrict it to your domain
 *  4. Paste it below
 */
const GOOGLE_PLACES_API_KEY = ""; // Paste your key here

const photoCache = {};

/**
 * Search for a venue photo using Google Places Text Search.
 * Returns a photo URL or null.
 */
async function fetchVenuePhoto(venueName, area) {
  if (!GOOGLE_PLACES_API_KEY) return null;

  const cacheKey = `${venueName}|${area}`;
  if (photoCache[cacheKey] !== undefined) return photoCache[cacheKey];

  try {
    const query = encodeURIComponent(`${venueName} ${area} Seattle`);
    const searchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&fields=photos&key=${GOOGLE_PLACES_API_KEY}`;
    
    const resp = await fetch(searchUrl);
    if (!resp.ok) { photoCache[cacheKey] = null; return null; }
    
    const data = await resp.json();
    const candidates = data.candidates || [];
    
    if (candidates.length && candidates[0].photos && candidates[0].photos.length) {
      const photoRef = candidates[0].photos[0].photo_reference;
      const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoRef}&key=${GOOGLE_PLACES_API_KEY}`;
      photoCache[cacheKey] = photoUrl;
      return photoUrl;
    }
    
    photoCache[cacheKey] = null;
    return null;
  } catch (err) {
    photoCache[cacheKey] = null;
    return null;
  }
}

/**
 * Apply a photo to a card's poster element if available.
 * Call this after rendering each card.
 */
async function applyVenuePhoto(posterEl, venueName, area) {
  if (!GOOGLE_PLACES_API_KEY) return;

  const url = await fetchVenuePhoto(venueName, area);
  if (url) {
    posterEl.style.backgroundImage = `url(${url})`;
    posterEl.style.backgroundSize = "cover";
    posterEl.style.backgroundPosition = "center";
  }
}

// Expose globally
window.venuePhotos = {
  isEnabled: () => !!GOOGLE_PLACES_API_KEY,
  applyVenuePhoto,
  fetchVenuePhoto,
};
