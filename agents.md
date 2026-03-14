# LateNightVibesSeattle — Agent Guide

**Project:** Late Night Vibes — Nightlife discovery PWA
**Live:** https://late-night-vibes-seattle.vercel.app
**Repo:** github.com/hondoentertainment/LateNightVibesSeattle

---

## Architecture at a Glance

Static HTML/CSS/JS PWA. No framework, no bundler, no runtime dependencies.
Deployed on Vercel. Tests via Vitest (unit) + Playwright (e2e).

```
/                      ← 12 HTML pages (browse, recommend, planner, neighborhoods, etc.)
/lib/                  ← 16 shared JS modules (pure logic, testable, no DOM in core)
/tests/                ← 14 Vitest unit test files
/data/                 ← Multi-city CSV venue datasets
/splash/               ← iOS splash screen images
sw.js                  ← Service worker (cache-first, network-first for CSVs)
manifest.json          ← PWA manifest
vercel.json            ← Deployment config with security headers + clean URLs
```

---

## Key Commands

| Task | Command |
|---|---|
| Run unit tests | `npm test` |
| Run tests in watch mode | `npm run test:watch` |
| Run e2e tests | `npm run test:e2e` |
| Run all tests | `npm run test:all` |
| Lint | `npm run lint` |
| Lint + fix | `npm run lint:fix` |
| Validate venue data | `npm run validate` |
| Local dev server | `npx serve .` |

---

## File Map

### HTML Pages (12)

| Page | File | Purpose |
|---|---|---|
| Browse | `index.html` | Main venue grid/map with filters, search, saved view |
| Recommendations | `recommend.html` | Jaccard-based similar venue suggestions |
| Night Planner | `planner.html` | Multi-stop itinerary builder with vibe arcs |
| Neighborhoods | `neighborhoods.html` | Side-by-side neighborhood comparison |
| Mood Match | `mood.html` | Natural language venue search |
| Squad Sync | `squad.html` | Group voting on venues |
| Night Replay | `replay.html` | Post-night summaries and shareable cards |
| Safe Night | `safety.html` | Emergency contacts, fake call, buddy system |
| Submit | `submit.html` | Community venue submission form |
| Cities | `cities.html` | Multi-city hub (8 US cities) |
| Admin | `admin.html` | Dataset management dashboard |
| 404 | `404.html` | Error page |

### Shared Libraries (`/lib/`)

| Module | Key Exports | Purpose |
|---|---|---|
| `core.js` | `parseCSV`, `loadDataFromCSV`, `computeRecommendations`, `haversineMiles`, `getVibeSet`, `showToast` | Pure logic layer — CSV parsing, recommendations engine, utilities |
| `shared-nav.js` | `LNVNav.init()` | Top nav + mobile bottom nav across all pages |
| `cities.js` | `CITIES`, `LNVCities.getCurrentCity()`, `LNVCities.cityLink()` | Multi-city config and routing |
| `geo.js` | `NEIGHBORHOOD_COORDS`, `getVenueCoords`, `calculateDistance`, `getNearbyVenues` | Geographic utilities, haversine distance |
| `user-preferences.js` | `loadOnboardingPrefs`, `saveExcludedVibes`, `loadAnchorArea` | Session state in localStorage |
| `crawl-history.js` | `loadHistory`, `markVisited`, `toggleVisited`, `getStats` | "Been There" venue tracking |
| `events.js` | `getEventsForVenue`, `getTonightsHighlights` | Special nights & recurring events |
| `features.js` | `getViabilityBadges`, `estimateTravelMinutes`, `getPeakHintForArea` | Live badges, travel estimates |
| `vibe-check.js` | `submitVibeCheck`, `getVibeCheckForVenue`, `pruneExpired` | Crowd-sourced real-time energy meter (4h TTL) |
| `mood-match.js` | `parseQuery`, `findMoodMatches` | Semantic keyword → vibe tag mapping |
| `squad-sync.js` | `createSession`, `castVote`, `getResults` | Group coordination sessions |
| `safe-night.js` | `saveEmergencyContacts`, `triggerFakeCall`, `enableBuddyMode`, `getRideshareLinks` | Safety toolkit |
| `detail-drawer.js` | (internal) | Venue detail modal/drawer component |
| `share-plan.js` | `encodeSharePlan`, `decodeSharePlan` | Base64 plan sharing |
| `favorites-backup.js` | `exportFavoritesAsJSON`, `importFavoritesFromJSON` | Backup/restore crawl history |
| `mobile-haptics.js` | `LNV_HAPTICS.light()`, `.medium()`, `.confirm()` | Vibration API polyfill |

### Page Controllers (root `*.js`)

Each HTML page has a matching controller: `app.js` (browse), `recommend.js`, `planner.js`, `neighborhoods.js`, `admin.js`, `mood.js`, `squad.js`, `replay.js`, `safety.js`, `submit.js`, `vibe-check-ui.js`, `venue-photos.js`.

### CSS

- `styles.css` — Global design tokens, dark theme (`#0b0d14` bg, `#2bff86` accent), responsive grid, typography (Inter)
- Page-specific: `recommend.css`, `planner.css`, `neighborhoods.css`, `admin.css`, `submit.css`, `mood.css`, `squad.css`, `replay.css`, `safety.css`, `vibe-check.css`

### Data

- `venue_list.csv` / `venue_list_500plus.csv` — Seattle dataset (500+ venues)
- `/data/{city}.csv` — Multi-city datasets (seattle, new-york, los-angeles, chicago, houston, phoenix, philadelphia, san-antonio)
- CSV schema: `Name, Address, Area, Category, Typical Closing Time, Driving Distance, Google Maps Driving Link, Vibe Tags`

---

## Conventions & Principles

### Code Style
- **No frameworks.** Vanilla JS with ES modules (`<script type="module">`).
- **Pure logic in `/lib/`.** No DOM manipulation in core modules — keep them testable.
- **Page controllers** wire DOM to lib functions. They live at the root.
- **Naming:** camelCase for JS, kebab-case for CSS classes, `lnv_` prefix for localStorage keys.
- **ESLint** configured via `eslint.config.js`. Run `npm run lint` before committing.

### State Management
- All user state lives in **localStorage** with `lnv_` prefixed keys.
- No server, no database, no auth (except optional admin ID check).
- Session state modules: `user-preferences.js`, `crawl-history.js`, `events.js`, `vibe-check.js`, `squad-sync.js`, `safe-night.js`.

### Design System
- Dark theme: bg `#0b0d14`, surface `#151822`, accent `#2bff86`
- Font: Inter (Google Fonts), weights 400/500/600/700
- Mobile-first. Topbar 64px, bottom nav 72px + safe-area-inset.
- Accessibility: `focus-visible` outlines, `sr-only` class, ARIA labels on interactive elements.

### Testing
- **Unit tests** (`/tests/`): Vitest, 14 test files covering core logic, CSV parsing, geo, recommendations, planner, events, history, preferences, cities.
- **E2E tests**: Playwright with chromium + mobile-chrome projects.
- **Validation**: `npm run validate` checks venue data integrity.
- Always run `npm test` before pushing. Run `npm run test:all` for full coverage.

### Deployment
- **Vercel** with auto-deploy from GitHub.
- `vercel.json` defines clean URLs, rewrites, and security headers.
- `sw.js` caches all pages/assets (cache version `lnv-v5` — bump on breaking changes).
- **Update sw.js precache list** whenever adding new pages, CSS, or JS files.

---

## Common Task Patterns

### Adding a New Page
1. Create `newpage.html` with standard structure (see any existing page as template)
2. Create `newpage.js` (page controller) and `newpage.css` (if needed)
3. Add nav entry in `lib/shared-nav.js` (`NAV_LINKS` and optionally `BOTTOM_NAV_ITEMS`)
4. Add route in `vercel.json` rewrites
5. Add to `sw.js` precache list
6. Add tests in `/tests/`

### Adding a New Lib Module
1. Create `lib/newmodule.js` with pure exported functions
2. Import in page controllers as needed: `import { fn } from './lib/newmodule.js'`
3. Add to `sw.js` precache list
4. Write unit tests in `tests/newmodule.test.js`

### Modifying Venue Data
1. Edit CSV files directly (RFC-4180 format)
2. Run `npm run validate` to check data integrity
3. Core CSV parser is in `lib/core.js` (`parseCSV`, `loadDataFromCSV`)

### Working with the Recommendation Engine
- Algorithm: Jaccard similarity on vibe tags + distance penalty + category bonus
- Entry point: `lib/core.js` → `computeRecommendations(allVenues, baseVenue, maxDist, maxResults)`
- Returns: `[{ venue, score, reason, breakdown }]`

### Working with Multi-City
- City config lives in `lib/cities.js` → `CITIES` object
- Each city has: slug, name, state, lat/lng, csv path, neighborhoods list
- `LNVCities.getCurrentCity()` reads from localStorage or URL
- CSV data loaded per-city from `/data/{slug}.csv`

---

## Known Quality Gaps (from Feature Audit)

| Area | Score | Key Issue |
|---|---|---|
| Recommend page | 6/10 | No venue detail drawer, cards not tappable, undo-exclude not discoverable |
| Admin page | 5.5/10 | Limited functionality, needs better data validation UX |
| Map view | 8/10 | Missing ARIA labels on markers |
| Browse | 8/10 | Empty-state CTA hierarchy could improve |
| Detail Drawer | 8.5/10 | Highest rated — good reference for quality bar |

---

## localStorage Keys Reference

| Key | Module | Purpose |
|---|---|---|
| `lnv_onboarding_prefs` | user-preferences | Initial vibe preferences |
| `lnv_excluded_vibes` | user-preferences | Filtered-out vibes |
| `lnv_plan_seed` | user-preferences | Planner starting venue |
| `lnv_anchor_area` | user-preferences | Preferred neighborhood |
| `lnv_crawl_history` | crawl-history | Visited venues + ratings |
| `lnv_venue_events` | events | Special nights data |
| `lnv_vibe_checks` | vibe-check | Real-time energy reports (4h TTL) |
| `lnv_squad_sessions` | squad-sync | Group voting sessions |
| `lnv_emergency_contacts` | safe-night | Emergency contacts |
| `lnv_buddy_mode` | safe-night | Buddy system state |
| `lnv_buddy_checkins` | safe-night | Check-in timestamps |

---

## Service Worker Cache Strategy

- **CSV files**: Network-first with stale-while-revalidate fallback
- **All other assets**: Cache-first with network fallback
- **Cache version**: `lnv-v5` — bump when making breaking asset changes
- **Precache**: All HTML, CSS, JS, lib modules, manifest, images

---

## External Integrations

| Service | Usage | Config |
|---|---|---|
| Google Fonts | Inter typeface | Hardcoded in HTML `<link>` |
| Plausible.io | Privacy-focused analytics | Optional via `config.js` → `plausibleDomain` |
| Google Maps | Driving links in CSV data | Pre-generated links, no API key needed for links |
| Uber/Lyft | Deep links from Safe Night | Generated on-demand from lat/lng in `safe-night.js` |
| Vibration API | Mobile haptics | Native browser API with polyfill |
