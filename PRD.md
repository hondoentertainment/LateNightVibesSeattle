# Late Night Vibes Seattle — Product Requirements Document

**Version:** 2.0
**Last Updated:** February 12, 2026
**Status:** Live — [late-night-vibes-seattle.vercel.app](https://late-night-vibes-seattle.vercel.app)
**Repo:** [github.com/hondoentertainment/LateNightVibesSeattle](https://github.com/hondoentertainment/LateNightVibesSeattle)

---

## 1. Overview

Late Night Vibes Seattle is a nightlife discovery, recommendation, and planning platform for the Seattle metro area. It surfaces 500+ venues that are typically open after 9 PM, organized by neighborhood, category, vibe, and distance from a central anchor point (Little Red Hen Bar).

The product operates as a progressive web app (PWA) with no backend, powered entirely by a CSV dataset and client-side JavaScript. It includes five pages: venue browse (grid + map), night plan builder, recommendation engine, neighborhood comparison, and admin dashboard.

---

## 2. Problem Statement

Seattle's nightlife is fragmented across dozens of neighborhoods. Existing tools (Google Maps, Yelp) are general-purpose and don't optimize for the late-night use case — they don't filter by vibe, don't consider energy progression, and don't recommend venue-to-venue routes. There is no dedicated nightlife concierge for Seattle's after-9 PM scene.

---

## 3. Target Users

- Seattle residents planning a night out (solo, date, group)
- Visitors looking for curated nightlife options
- Nightlife-curious people who want to explore beyond their usual neighborhood
- Groups coordinating a multi-stop crawl who need shareable itineraries

---

## 4. Core Features

### 4.1 Venue Browse (index.html)
- **Card grid** of all venues, Letterboxd-inspired design
- **Map view** — Leaflet-powered dark-theme map with vibe-colored markers, card-map hover sync, and neighborhood coordinate mapping
- **Grid/Map toggle** — switch between card grid and interactive map
- **Search** by name, neighborhood, category, or vibe tag with **autocomplete** (venues, areas, vibes with keyboard navigation)
- **Filter** by Area, Category, Open Now, and Visited status (Been There / New)
- **Sort** by Name, Area, Category, Distance, Closing Time
- **Vibe chip filters** — toggle one or more vibes to narrow results
- **Color-coded poster blocks** — gradient mapped to the venue's primary vibe tag
- **Attribute border accents** — card border color shifts based on key tags (upscale, divey, dancey, live-music, sports, karaoke, late-eats, rooftop, views, adult)
- **Google Maps links** — every venue name, address, and Directions link opens a driving route from Little Red Hen Bar
- **Favorites** — save/unsave venues (♥/♡) persisted to localStorage; dedicated saved-only view via `?view=saved`
- **"Been There" tracking** — mark venues as visited with thumbs up/down ratings, visit timestamps, and crawl stats
- **Open Now status** — real-time open/closed pills on cards with time-aware filtering toggle
- **Viability badges** — context-aware pills (Cover likely, Kitchen open, Likely busy, Line risk) based on time and category
- **Trust badge** — dataset verification indicator (Verified Feb 2026)
- **Venue detail drawer** — bottom-sheet modal with full venue info, directions, Google/Yelp links, save, share, visit tracking, and venue photos
- **Share** — Web Share API with clipboard fallback for individual venues
- **Skeleton loading** — animated placeholder cards during data fetch
- **Pagination** — Load More button (40 per page) with progressive rendering
- **Filter state persistence** — sessionStorage saves filters across page reloads
- **Vibe legend** — toggleable color-coded vibe reference
- **Keyboard shortcuts** — `/` to focus search, `Escape` to close drawers
- **Pull-to-refresh** — mobile gesture to update open/closed status badges
- **Swipe-to-dismiss** — touch gesture to close detail drawer
- **Intent-first onboarding** — 3-step flow (Who / Energy / Neighborhood) that pre-applies filters for new users
- **Staggered card animations** — entrance animation with progressive delay
- **Mobile-first layout** — bottom sheet filter drawer, sticky search, bottom nav, 2-column card grid on small screens

### 4.2 Recommendations (recommend.html)
- **Venue-to-venue similarity engine** powered by:
  - Shared vibe tags (Jaccard similarity, weighted 50%)
  - Same category match (20%)
  - Same neighborhood match (20%)
  - Distance proximity to anchor (10%)
- **Controls**: select a starting venue, set max distance (miles), set result count
- **Output**: ranked recommendation cards with reasoning (shared vibes, category match, neighborhood)
- **Context-aware modes**: date, friends, solo, after-concert, post-game
- **Visited-aware scoring**: boosts unvisited venues in results
- **Mobile**: controls inline at top; bottom nav for page switching

### 4.3 Night Plan Builder (planner.html)
- **Multi-stop itinerary builder** — 2–5 venue route planning with vibe escalation
- **5 preset vibe arcs**: Chill-to-Wild, Date Night, Party, Explore, Low-Key
- **Lock/unlock stops** — pin specific venues while regenerating others
- **Swap stops** — reorder venues within the itinerary
- **Reroute from here** — recovery UX to rebuild the plan from a midpoint
- **Route realism** — travel time estimates between venues
- **Share plan** — URL-encoded itinerary links for group coordination
- **Group voting** — shared plan voting UI for collaborative decision-making

### 4.4 Neighborhood Comparison (neighborhoods.html)
- **Side-by-side neighborhood stats** — venue counts, category breakdowns, vibe distribution
- **Compare 2+ neighborhoods** to decide where to go
- **Visual data** for informed neighborhood selection

### 4.5 Admin Dashboard (admin.html)
- **Dataset stats**: total venues, areas, categories, unique vibes
- **Breakdowns**: venue count by area, category, and vibe tag
- **CSV import**: upload a new dataset to replace the current one
- **Reset**: reload default dataset

---

## 5. Dataset Schema

| Field | Description |
|---|---|
| Area | Neighborhood bucket (Capitol Hill, Ballard, etc.) |
| Name | Venue name |
| Category | Venue type (bar, cocktail bar, nightclub, restaurant, etc.) |
| Typical Closing Time | Approximate closing time (e.g., 2:00 AM) |
| Address | Street address (may be blank) |
| Phone | Phone number (may be blank) |
| Website | Venue website (may be blank) |
| Driving Distance | Distance from Little Red Hen Bar (e.g., 3.2 mi) |
| Google Maps Driving Link | Direct link to Google Maps driving route from anchor |
| Vibe Tags | Comma-separated tags (dancey, chill, upscale, divey, etc.) |
| Latitude | Venue latitude (optional, for map positioning) |
| Longitude | Venue longitude (optional, for map positioning) |

### 5.1 Vibe Tags (25 unique)
adult, casual, chill, dancey, date-friendly, divey, drinks, food-focused, games, general, group-friendly, group-fun, high-energy, interactive, late-eats, late-night, live-music, loud, playful, rowdy, social, sports, sweet, upscale, views

### 5.2 Areas (38 neighborhoods)
Capitol Hill, Ballard, Fremont, Downtown/Belltown, Queen Anne, Chinatown-ID, Eastside, West Seattle, Georgetown, SoDo, Greenwood, Shoreline, Lake City, Central District, First Hill, Beacon Hill, Rainier Valley, University District, Wallingford, Madison Valley, Madrona, South Lake Union, Burien, Renton, Tukwila, Northgate, Lake Forest Park, Magnolia, Interbay, White Center, Kent, Auburn, Everett, Skyway, Columbia City, Crown Hill, Green Lake, Strip Clubs

---

## 6. Architecture

```
Progressive Web App (HTML/CSS/JS)
├── index.html              — Venue browse (grid + map) + filters
├── planner.html            — Night plan builder
├── recommend.html          — Recommendation engine
├── neighborhoods.html      — Neighborhood comparison
├── admin.html              — Admin dashboard
├── styles.css              — Shared styles (mobile-first)
├── planner.css             — Planner page styles
├── recommend.css           — Recommendation page styles
├── neighborhoods.css       — Neighborhood comparison styles
├── admin.css               — Admin page styles
├── app.js                  — Browse logic, filters, map, rendering
├── planner.js              — Night plan builder logic
├── recommend.js            — Recommendation engine + rendering
├── neighborhoods.js        — Neighborhood comparison logic
├── admin.js                — Admin dashboard logic
├── venue-photos.js         — Google Places Photos integration (optional)
├── config.example.js       — Configuration template (API keys)
├── lib/
│   ├── core.js             — Shared utilities (CSV parsing, time helpers, recommendation scoring)
│   ├── crawl-history.js    — "Been There" visit tracking + ratings
│   ├── features.js         — Feature flags (viability badges, trust badges, travel estimates)
│   └── share-plan.js       — Plan sharing URL encoding/decoding
├── tests/
│   ├── utils.test.js       — Core utility tests
│   ├── csv-parser.test.js  — CSV parsing tests
│   ├── recommendation.test.js — Recommendation engine tests
│   ├── planner.test.js     — Night plan builder tests
│   ├── crawl-history.test.js  — Visit history tests
│   ├── features.test.js    — Feature flag tests
│   ├── share-plan.test.js  — Plan sharing tests
│   └── venue-data.test.js  — Venue data integrity tests
├── venue_list_500plus.csv  — Primary dataset (CSV)
├── seattle_venue_set_500plus.json  — Dataset (JSON mirror)
├── seattle_after_9pm_from_little_red_hen_500plus_with_vibes.xlsx  — Source Excel
├── manifest.json           — PWA manifest
├── lnv-logo.png            — Header logo
├── favicon.png             — Browser tab / bookmark icon
├── package.json            — Dev dependencies + scripts
├── vitest.config.js        — Test runner configuration
└── eslint.config.js        — Linting configuration
```

**Hosting:** Vercel (static deployment, auto-aliased)
**Source Control:** GitHub — hondoentertainment/LateNightVibesSeattle
**Backend:** None (fully client-side)
**Runtime Dependencies:** None (vanilla HTML/CSS/JS)
**Dev Dependencies:** Vitest (testing), ESLint (linting)
**External Libraries (CDN):** Leaflet (map rendering)

---

## 7. Design System

### 7.1 Visual Identity
- **Logo:** Neon green-to-cyan "LNV" mark with glow effect
- **Palette:** Dark backgrounds (#0b0d14, #101520), neon accents (#2bff86 green, #1ad1ff cyan, #ff7ad6 pink)
- **Style:** Letterboxd-inspired card grid, cinematic dark theme
- **Vibe color system:** 25+ mapped vibe-to-color assignments for posters, map markers, and legend

### 7.2 Mobile UX
- Bottom navigation bar (Browse / For You / Plan / Neighborhoods / Admin)
- Slide-up bottom sheet for filters with drag handle
- Swipe-to-dismiss detail drawer (top 60px drag zone)
- Pull-to-refresh gesture to update status badges
- Sticky search bar below header with autocomplete dropdown
- 48px minimum touch targets on all interactive elements
- Safe area inset support for notched devices
- 2-column card grid at mobile widths
- Staggered entrance animations on card render
- Skeleton loading states during data fetch

### 7.3 Desktop UX
- Sidebar with filters and vibe chips
- Header nav pills for page switching
- 4+ column card grid at wide widths
- Keyboard shortcuts (`/` search, `Escape` close)
- Card-map hover synchronization in split view

---

## 8. Recommendation Algorithm

```
Score = (vibeScore * 0.5) + (categoryScore * 0.2) + (areaScore * 0.2) + (distanceScore * 0.1)

vibeScore     = |intersection(baseVibes, candidateVibes)| / |union(baseVibes, candidateVibes)|
categoryScore = 1 if same category, else 0
areaScore     = 1 if same neighborhood, else 0
distanceScore = 1 - min(|baseDist - candidateDist| / maxDist, 1)
```

Results are sorted by score descending, capped at user-specified count (default 8, max 20). Unvisited venues receive a scoring boost when crawl history is available. Context-aware modes (date, friends, solo, after-concert, post-game) adjust vibe weighting.

---

## 9. Night Plan Algorithm

- **Vibe arcs** define a 2–5 stop energy curve (e.g., Chill-to-Wild escalates from `chill` → `social` → `dancey` → `high-energy`)
- Each stop targets vibes appropriate to its position in the arc
- **Travel realism** factors estimated driving/transit time between stops
- **Locked stops** are preserved during regeneration; unlocked stops are re-optimized
- **Reroute from here** rebuilds remaining stops from a given midpoint
- Plans are shareable via URL-encoded links for group voting

---

## 10. Behavioral Rules

- Do NOT hallucinate venues outside the dataset
- Do NOT assume hours earlier than 9 PM
- Treat vibe tags as probabilistic, not absolute
- Prefer variety and balance over redundancy
- Surface uncertainty explicitly (viability badges use "likely" language)
- Optimize for real human nights, not theoretical perfection
- Time-aware features (Open Now, viability badges) use local device time

---

## 11. Roadmap

### Shipped (v1.0)
- [x] Venue dataset import (XLSX → CSV → JSON)
- [x] Letterboxd-style card grid with vibe color coding
- [x] Search, filter, sort by area/category/vibe/distance/closing
- [x] Recommendation engine (vibe + category + area + distance scoring)
- [x] Admin dashboard with dataset stats and breakdowns
- [x] Mobile-first responsive design with bottom nav and filter drawer
- [x] Logo and favicon
- [x] Deployed to Vercel + GitHub

### Shipped (v1.1 — February 2026)
- [x] Google Places Photos integration (venue images on cards)
- [x] "Open now" time-aware filtering with status pills
- [x] Venue detail drawer/modal with full info, links, and actions
- [x] Saved lists / favorites (localStorage)
- [x] Interactive map view (Leaflet) with grid-map sync
- [x] "Been There" crawl history with visit tracking and ratings
- [x] Night plan builder (2–5 stop itineraries with vibe arcs)
- [x] Neighborhood comparison view
- [x] Search autocomplete (venues, areas, vibes)
- [x] Intent-first onboarding flow (3 steps)
- [x] Venue sharing (Web Share API + clipboard fallback)
- [x] Plan sharing with URL-encoded links and group voting
- [x] Viability badges (Cover likely, Kitchen open, Likely busy, Line risk)
- [x] Trust badge (dataset verification)
- [x] Skeleton loading states
- [x] Load More pagination (40 per page)
- [x] Filter state persistence (sessionStorage)
- [x] Keyboard shortcuts (/ to search, Escape to close)
- [x] Pull-to-refresh (mobile)
- [x] Swipe-to-dismiss detail drawer
- [x] Vibe legend with color coding
- [x] Neighborhood momentum hint (peak hours)
- [x] PWA manifest
- [x] Shared library modules (lib/core, crawl-history, features, share-plan)
- [x] Test suite (Vitest — 8 test files covering core logic)
- [x] ESLint configuration

### Planned (v1.2+)
- [ ] Custom domain
- [ ] Venue-to-venue driving distance (instead of anchor-only)
- [ ] User accounts / cloud sync for favorites and history
- [ ] Social features (friend activity, shared favorites)
- [ ] Event/special night overlays (live music schedules, DJ sets)
- [ ] Review snippets from external sources
- [ ] Offline support via service worker caching

---

## 12. Testing

### Test Infrastructure
- **Runner:** Vitest v3.0+
- **Configuration:** `vitest.config.js` (ES modules)
- **Scripts:** `npm test` (run once), `npm run test:watch` (watch mode)

### Test Coverage
| Test File | Scope |
|---|---|
| `utils.test.js` | normalizeValue, parseTimeToMinutes, parseHHMM, minutesToLabel, parseDistanceMiles, getVibeSet, collectVibes |
| `csv-parser.test.js` | CSV parsing edge cases |
| `recommendation.test.js` | Recommendation scoring and ranking |
| `planner.test.js` | Night plan generation and vibe arcs |
| `crawl-history.test.js` | Visit tracking, ratings, stats |
| `features.test.js` | Feature flags and viability badge logic |
| `share-plan.test.js` | Plan URL encoding/decoding |
| `venue-data.test.js` | Dataset integrity validation |

---

## 13. Success Metrics

- Venue coverage: 500+ venues across 38 neighborhoods
- Filter responsiveness: instant client-side filtering
- Recommendation relevance: top 3 results share at least 2 vibe tags with source venue
- Mobile usability: all interactive elements >= 48px touch target
- Load time: < 2s on 4G connection (static site, no API calls)
- Test coverage: core utilities, recommendation engine, planner, and data integrity validated
- Plan sharing: URL-encoded plans decodable with zero data loss
