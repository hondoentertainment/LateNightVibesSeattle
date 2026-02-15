# Late Night Vibes Seattle — Product Requirements Document

**Version:** 3.0
**Last Updated:** February 15, 2026
**Status:** Live — [late-night-vibes-seattle.vercel.app](https://late-night-vibes-seattle.vercel.app)
**Repo:** [github.com/hondoentertainment/LateNightVibesSeattle](https://github.com/hondoentertainment/LateNightVibesSeattle)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Vision & Strategic Goals](#3-vision--strategic-goals)
4. [Target Users & Personas](#4-target-users--personas)
5. [Core Features (Shipped)](#5-core-features-shipped)
6. [Dataset Schema & Content Model](#6-dataset-schema--content-model)
7. [Technical Architecture](#7-technical-architecture)
8. [Design System](#8-design-system)
9. [Algorithms & Intelligence](#9-algorithms--intelligence)
10. [Behavioral Rules & Principles](#10-behavioral-rules--principles)
11. [Testing & Quality Assurance](#11-testing--quality-assurance)
12. [Infrastructure & Deployment](#12-infrastructure--deployment)
13. [Analytics & Success Metrics](#13-analytics--success-metrics)
14. [Competitive Landscape](#14-competitive-landscape)
15. [Identified Areas of Improvement](#15-identified-areas-of-improvement)
16. [Roadmap](#16-roadmap)
17. [Appendix](#17-appendix)

---

## 1. Executive Summary

Late Night Vibes Seattle (LNV) is a nightlife discovery, recommendation, and planning platform built exclusively for Seattle's after-9 PM scene. It surfaces 500+ venues organized by neighborhood, category, vibe, and distance, wrapped in a Letterboxd-inspired dark UI with a mobile-first progressive web app architecture.

**What makes LNV different:** Unlike general-purpose platforms (Google Maps, Yelp), LNV is purpose-built for nightlife. It understands vibe progression, energy escalation, multi-stop crawl planning, and the real-time context of a night out — things that no existing tool optimizes for.

**Current state:** Production-ready PWA with five distinct pages, a mature 500+ venue dataset, a test suite with 8 test files, and zero runtime dependencies. The product is live on Vercel with CI/CD via GitHub Actions.

---

## 2. Problem Statement

### Primary Problem
Seattle's nightlife spans 38+ neighborhoods but there is no dedicated tool for late-night discovery. Existing platforms suffer from:

| Problem | Google Maps | Yelp | LNV Solution |
|---|---|---|---|
| No vibe-based filtering | Searches by keyword only | Tag-based but not nightlife-tuned | 25 curated vibe tags with color coding |
| No energy progression | Lists results flat | Lists results flat | Vibe arcs (Chill→Wild, Date Night, etc.) |
| No multi-stop routing | Single destination | Single destination | 2–5 stop itinerary builder |
| No time-awareness for nightlife | Generic "Open now" | Generic hours | Viability badges (Cover likely, Kitchen open, Likely busy, Line risk) |
| No neighborhood intelligence | Map-only spatial view | Neighborhood pages exist | Side-by-side neighborhood comparison with vibe distribution |
| No crawl tracking | No history | Review history only | "Been There" with ratings, timestamps, stats |

### Secondary Problems
- **Decision paralysis:** Too many options, no guidance on where to start or how to progress
- **Group coordination:** No way to share and vote on a multi-venue plan
- **Exploration stagnation:** People default to the same 2-3 bars in their neighborhood

---

## 3. Vision & Strategic Goals

### Vision
Become the default nightlife concierge for Seattle — the app you open every Friday at 8 PM.

### Strategic Goals

| Goal | Metric | Target |
|---|---|---|
| **Coverage** | Venues in dataset | 500+ (achieved) |
| **Engagement** | Favorites saved per user | 10+ |
| **Planning** | Night plans generated per session | 1+ |
| **Exploration** | "Been There" venues tracked per user | 20+ |
| **Retention** | Return visits per month | 4+ (weekly cadence) |
| **Shareability** | Plans shared per plan generated | 30%+ |

### Product Principles
1. **Nightlife-native:** Every feature should make sense at 10 PM, standing outside a bar, phone in one hand
2. **Opinionated but flexible:** Smart defaults with full override capability
3. **No sign-up friction:** Zero-auth experience, localStorage-first
4. **Vibe is king:** Vibe tags are the primary taxonomy, not categories
5. **Real nights, not perfect nights:** Optimize for adaptability, not rigid itineraries

---

## 4. Target Users & Personas

### Primary Personas

**The Weekend Warrior** — *"Where are we going tonight?"*
- Seattle resident, 25-35, goes out 2-3x per month
- Needs: Quick discovery, vibe filtering, group-friendly sharing
- Pain: Decision paralysis, always ends up at the same places
- LNV value: Browse → filter by vibe → share a plan

**The Date Planner** — *"I need this to be perfect"*
- Plans date nights intentionally, 1-2x per month
- Needs: Curated progression (dinner → cocktails → views), quality assurance
- Pain: Yelp reviews are unreliable for "vibe"; doesn't want to end up somewhere rowdy
- LNV value: Date Night vibe arc → lock preferred stops → share with partner

**The Explorer** — *"I want to try something new"*
- Nightlife-curious, wants to break out of their neighborhood bubble
- Needs: Neighborhood comparison, "New" filter (unvisited venues), diverse recommendations
- Pain: Doesn't know what's in Georgetown or Fremont after dark
- LNV value: Neighborhood comparison → recommendation engine → "Been There" tracking

**The Crawl Coordinator** — *"Alright, here's the plan"*
- Organizes group outings, 1-2x per month
- Needs: Shareable multi-stop itineraries, group voting, route realism
- Pain: Group text chaos, no one agrees, logistics are a mess
- LNV value: Night plan → share link → group vote → go

### Secondary Personas

**The Visitor** — First time in Seattle, wants curated nightlife without research
**The Solo Explorer** — Going out alone, wants safe/welcoming/interesting venues
**The Post-Event Crowd** — After a concert, game, or show, needs a quick nearby option

---

## 5. Core Features (Shipped)

### 5.1 Venue Browse (index.html) — *The Home Base*

**Card Grid:**
- Letterboxd-inspired card layout with color-coded poster blocks
- Gradient mapped to primary vibe tag via 25+ vibe-to-color assignments
- Attribute border accents for key tags (upscale, divey, dancey, live-music, sports, karaoke, late-eats, rooftop, views, adult)
- Staggered entrance animations with progressive delay
- Skeleton loading placeholders during data fetch
- Load More pagination (40 per page)

**Interactive Map:**
- Leaflet-powered dark-theme map with vibe-colored markers
- Card-map hover synchronization (highlight card → marker pulses, click marker → card scrolls)
- Neighborhood coordinate mapping with fallback jitter for missing lat/lng
- Grid/Map toggle with seamless state persistence

**Search & Discovery:**
- Full-text search by name, neighborhood, category, or vibe tag
- Autocomplete dropdown with venues, areas, and vibes sections
- Keyboard navigation in autocomplete (up/down/enter/escape)
- Keyboard shortcut: `/` to focus search, `Escape` to close

**Filtering & Sorting:**
- Filter by Area, Category, Open Now, Visited status (Been There / New)
- Sort by Name, Area, Category, Distance, Closing Time
- Vibe chip filters — toggle one or more to narrow results
- Filter state persistence via sessionStorage across page reloads

**Venue Detail Drawer:**
- Bottom-sheet modal with full venue info (address, phone, website, hours, distance)
- Google Maps driving directions link (from Little Red Hen Bar)
- Google/Yelp links for external research
- Save/unsave (favorites), share, and visit tracking actions
- Venue photos (via Google Places API, optional)
- Swipe-to-dismiss (touch gesture, top 60px drag zone)

**Personalization:**
- Favorites (save/unsave, localStorage-persisted, dedicated `?view=saved` page)
- "Been There" crawl tracking with thumbs up/down ratings, visit timestamps, and aggregate stats
- Open Now status with real-time pills and time-aware filtering
- Viability badges: Cover likely, Kitchen open, Likely busy, Line risk (context-aware, time-based)
- Trust badge: "Verified Feb 2026" dataset verification indicator

**Mobile UX:**
- Pull-to-refresh gesture to update status badges
- Slide-up bottom sheet for filters with drag handle
- Sticky search bar below header
- 2-column card grid on small screens
- 48px minimum touch targets
- Safe area inset support for notched devices
- Haptic feedback via vibration API

**Onboarding:**
- Intent-first 3-step flow (Who are you going with? / What energy? / What neighborhood?)
- Pre-applies filters based on responses
- Persisted completion flag (shows once)

### 5.2 Recommendations (recommend.html) — *"Find Me Something Similar"*

- Venue-to-venue similarity engine (Jaccard vibe similarity 50%, category 20%, neighborhood 20%, distance 10%)
- Controls: starting venue selector, max distance (miles), result count
- Ranked recommendation cards with reasoning (shared vibes, category match, neighborhood)
- Context-aware modes: date, friends, solo, after-concert, post-game (adjust vibe weighting)
- Visited-aware scoring: boosts unvisited venues when crawl history exists
- Dual mobile/desktop control panels

### 5.3 Night Plan Builder (planner.html) — *"Build My Night"*

- Multi-stop itinerary builder (2–5 venue routes with vibe escalation)
- 5 preset vibe arcs: Chill-to-Wild, Date Night, Party, Explore, Low-Key
- Lock/unlock individual stops while regenerating others
- Swap stops to reorder venues within the itinerary
- Reroute from here — recovery UX to rebuild from a midpoint
- Route realism with travel time estimates between venues
- Share plan via URL-encoded itinerary links
- Group voting UI for collaborative decision-making

### 5.4 Neighborhood Comparison (neighborhoods.html) — *"Where Should We Go?"*

- Side-by-side neighborhood stats (venue counts, category breakdowns, vibe distribution)
- Compare 2–3 neighborhoods simultaneously
- Visual data for informed neighborhood selection

### 5.5 Admin Dashboard (admin.html) — *"Dataset Management"*

- Dataset stats: total venues, areas, categories, unique vibes
- Breakdowns: venue count by area, category, and vibe tag
- CSV import: upload new dataset to replace current data
- Reset: reload default dataset

---

## 6. Dataset Schema & Content Model

### 6.1 Venue Record Schema

| Field | Type | Required | Description |
|---|---|---|---|
| Area | String | Yes | Neighborhood bucket (Capitol Hill, Ballard, etc.) |
| Name | String | Yes | Venue display name |
| Category | String | Yes | Venue type (bar, cocktail bar, nightclub, restaurant, etc.) |
| Typical Closing Time | String | Yes | Approximate close (e.g., "2:00 AM") |
| Address | String | No | Street address |
| Phone | String | No | Phone number |
| Website | String | No | Venue website URL |
| Driving Distance | String | Yes | Distance from Little Red Hen Bar (e.g., "3.2 mi") |
| Google Maps Driving Link | URL | Yes | Direct driving route link from anchor |
| Vibe Tags | String | Yes | Comma-separated tags (e.g., "dancey, high-energy, loud") |
| Latitude | Float | No | Venue latitude (map positioning) |
| Longitude | Float | No | Venue longitude (map positioning) |

### 6.2 Vibe Tags (25 Unique)

adult, casual, chill, dancey, date-friendly, divey, drinks, food-focused, games, general, group-friendly, group-fun, high-energy, interactive, late-eats, late-night, live-music, loud, playful, rowdy, social, sports, sweet, upscale, views

### 6.3 Areas (38 Neighborhoods)

Capitol Hill, Ballard, Fremont, Downtown/Belltown, Queen Anne, Chinatown-ID, Eastside, West Seattle, Georgetown, SoDo, Greenwood, Shoreline, Lake City, Central District, First Hill, Beacon Hill, Rainier Valley, University District, Wallingford, Madison Valley, Madrona, South Lake Union, Burien, Renton, Tukwila, Northgate, Lake Forest Park, Magnolia, Interbay, White Center, Kent, Auburn, Everett, Skyway, Columbia City, Crown Hill, Green Lake, Strip Clubs

### 6.4 Data Sources

- Primary: `venue_list_500plus.csv` (client-side, loaded via fetch)
- Mirror: `seattle_venue_set_500plus.json` (JSON copy)
- Source: `seattle_after_9pm_from_little_red_hen_500plus_with_vibes.xlsx` (Excel origin)
- Photos: Google Places API (optional, cached 14 days in localStorage)

---

## 7. Technical Architecture

### 7.1 System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                       │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  index.html   │  │ planner.html │  │recommend.html│  │
│  │  + app.js     │  │ + planner.js │  │+recommend.js │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                  │                  │          │
│  ┌──────┴──────────────────┴──────────────────┴───────┐ │
│  │                  Shared Libraries                   │ │
│  │  lib/core.js │ lib/features.js │ lib/crawl-history │ │
│  │  lib/share-plan.js │ venue-photos.js │ config.js   │ │
│  └──────┬──────────────────┬──────────────────────────┘ │
│         │                  │                             │
│  ┌──────┴───────┐  ┌──────┴───────┐                    │
│  │ localStorage  │  │sessionStorage│                    │
│  │ - favorites   │  │ - filters    │                    │
│  │ - crawlHistory│  │              │                    │
│  │ - photoCache  │  │              │                    │
│  │ - onboarding  │  │              │                    │
│  └──────────────┘  └──────────────┘                    │
│                                                          │
│  ┌────────────────────┐  ┌────────────────────────────┐ │
│  │  Leaflet (CDN)     │  │  Google Places API (opt.)  │ │
│  └────────────────────┘  └────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
                         │
                    Static Hosting
               ┌─────────┴─────────┐
               │  Vercel (primary)  │
               │  GitHub Pages (CI) │
               └───────────────────┘
```

### 7.2 Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Markup | HTML5 | Semantic HTML, PWA meta tags |
| Styling | Vanilla CSS | Mobile-first, 2200+ lines, CSS custom properties |
| Logic | Vanilla JavaScript | ES2022, UMD library modules, zero dependencies |
| Maps | Leaflet 1.9.4 (CDN) | Dark tile layer, custom markers |
| Testing | Vitest 3.0+ | 8 test files, ES module configuration |
| Linting | ESLint 9.0+ | Browser globals, ES2022 target |
| Hosting | Vercel | Static deployment, auto-aliased |
| CI/CD | GitHub Actions | Auto-deploy to GitHub Pages on push to main |
| Photos | Google Places API | Optional, cached in localStorage |
| Analytics | Plausible | Optional, privacy-focused |

### 7.3 State Management

All state is client-side with no backend:

| Store | Mechanism | Data | TTL |
|---|---|---|---|
| Favorites | localStorage (`lnv_favorites`) | Array of venue names | Permanent |
| Crawl History | localStorage (`lnv_crawl_history`) | Map of venue → {visited, rating, timestamp} | Permanent |
| Photo Cache | localStorage (`lnv_photo_cache_v1`) | Map of venue → {url, ts} | 14 days, max 200 entries |
| Onboarding | localStorage (`lnv_onboarding_done`) | Boolean flag | Permanent |
| Filter State | sessionStorage (`lnv_filters`) | Area, category, sort, search, vibes, view, openNow | Session |
| Runtime State | In-memory JS object | Filtered venues, active vibes, render limit | Page lifecycle |

### 7.4 Code Organization

```
LateNightVibesSeattle-1/
├── index.html              # Browse page (grid + map)
├── planner.html            # Night plan builder
├── recommend.html          # Recommendation engine
├── neighborhoods.html      # Neighborhood comparison
├── admin.html              # Admin dashboard
├── styles.css              # Shared styles (mobile-first, 2200+ lines)
├── planner.css             # Planner page styles
├── recommend.css           # Recommendation page styles
├── neighborhoods.css       # Neighborhood comparison styles
├── admin.css               # Admin dashboard styles
├── app.js                  # Browse logic, filters, map, rendering (~1500 lines)
├── planner.js              # Night plan builder logic (~500 lines)
├── recommend.js            # Recommendation engine (~325 lines)
├── neighborhoods.js        # Neighborhood comparison logic
├── admin.js                # Admin dashboard logic
├── venue-photos.js         # Google Places Photos integration
├── config.js               # Runtime config (API keys, not in repo)
├── config.example.js       # Config template
├── lib/
│   ├── core.js             # Shared utilities (CSV, time, scoring)
│   ├── crawl-history.js    # Visit tracking + ratings
│   ├── features.js         # Feature flags, viability badges, travel estimates
│   └── share-plan.js       # Plan sharing URL encoding/decoding
├── tests/                  # 8 test suites (Vitest)
├── venue_list_500plus.csv  # Primary dataset
├── manifest.json           # PWA manifest
├── package.json            # Dev dependencies
├── vitest.config.js        # Test runner config
├── eslint.config.js        # Linting config
├── vercel.json             # Vercel deployment config
└── .github/workflows/
    └── deploy.yml          # GitHub Actions CI/CD
```

---

## 8. Design System

### 8.1 Visual Identity

- **Logo:** Neon green-to-cyan "LNV" mark with glow effect
- **Aesthetic:** Letterboxd-inspired card grid, cinematic dark theme
- **Tone:** Premium nightlife curator — not flashy or club-promoter-y, more like a knowledgeable local friend

### 8.2 Color Palette

| Token | Value | Usage |
|---|---|---|
| Background Primary | `#0b0d14` | Page background |
| Background Card | `#101520` | Card surfaces |
| Text Primary | `#e8e8e8` | Body text |
| Text Secondary | `#93a1c6` | Muted labels |
| Accent Green | `#2bff86` | Primary actions, success |
| Accent Cyan | `#1ad1ff` | Links, secondary actions |
| Accent Pink | `#ff7ad6` | Favorites, special highlights |
| Border Default | `#1d2436` | Card/section borders |
| Border Active | `#2a334d` | Hover/focus borders |

### 8.3 Vibe Color System

25+ unique colors mapped to vibe tags, used consistently across card posters, map markers, vibe chips, and the vibe legend. Examples: chill → blue, dancey → magenta, upscale → gold, divey → amber, high-energy → red-orange.

### 8.4 Typography

- **Font Stack:** "Inter", "Segoe UI", -apple-system, Arial, sans-serif
- **Scale:** System-default sizing with responsive adjustments

### 8.5 Mobile UX Patterns

| Pattern | Implementation |
|---|---|
| Bottom Navigation | 5-tab bar (Browse / For You / Plan / Compare / Admin) |
| Filter Drawer | Slide-up bottom sheet with drag handle |
| Detail Drawer | Full-height bottom sheet, swipe-to-dismiss |
| Search | Sticky bar below header with autocomplete dropdown |
| Touch Targets | 48px minimum on all interactive elements |
| Safe Areas | `env(safe-area-inset-*)` support for notched devices |
| Haptic Feedback | Vibration API (3ms light, 20ms medium, pattern for confirm) |
| Pull-to-Refresh | Custom gesture to update status badges |
| Card Grid | 2-column on mobile, 4+ on desktop |
| Loading States | Skeleton card placeholders with shimmer animation |
| Animations | Staggered card entrance with progressive delay |

### 8.6 Desktop UX Patterns

| Pattern | Implementation |
|---|---|
| Navigation | Header nav pills for page switching |
| Filters | Persistent sidebar with vibe chips |
| Cards | 4+ column responsive grid |
| Map | Split view with card-map hover sync |
| Keyboard | `/` search, `Escape` close, arrow key autocomplete |

---

## 9. Algorithms & Intelligence

### 9.1 Recommendation Engine

```
Score = (vibeScore × 0.5) + (categoryScore × 0.2) + (areaScore × 0.2) + (distanceScore × 0.1)

vibeScore     = |intersection(baseVibes, candidateVibes)| / |union(baseVibes, candidateVibes)|
categoryScore = 1 if same category, else 0
areaScore     = 1 if same neighborhood, else 0
distanceScore = 1 - min(|baseDist - candidateDist| / maxDist, 1)
```

- Results sorted by score descending, capped at user-specified count (default 8, max 20)
- Unvisited venues receive a scoring boost when crawl history is available
- Context modes (date, friends, solo, after-concert, post-game) adjust vibe weighting

### 9.2 Night Plan / Vibe Arc System

| Arc | Energy Curve | Target Vibes per Stop |
|---|---|---|
| Chill-to-Wild | Low → High | chill → social → dancey → high-energy |
| Date Night | Medium sustained | date-friendly → upscale → views → chill |
| Party | High throughout | dancey → high-energy → loud → rowdy |
| Explore | Varied | Diverse categories and neighborhoods |
| Low-Key | Low sustained | chill → casual → divey → late-eats |

- Each stop targets vibes appropriate to its position in the arc
- Locked stops are preserved during regeneration; unlocked stops are re-optimized
- Travel realism: 5 min same-area, 15 min cross-area (simplified), or distance-based formula: `5 + delta_miles × 4`

### 9.3 Viability Badge Logic

| Badge | Trigger |
|---|---|
| Cover likely | Category contains "nightclub" or "club" |
| Kitchen open | Has "late-eats" or "food-focused" tag AND current time is 9 PM–30 min before close |
| Likely busy | Nightclub or (dancey + high-energy) AND 10 PM–2 AM |
| Line risk | Nightclub AND after 11 PM |

### 9.4 Open Now Detection

- Parses "Typical Closing Time" field to minutes
- Assumes all venues open at 9 PM (dataset scope)
- Adjusts for after-midnight closing (wraps around 24h)
- Uses local device time

---

## 10. Behavioral Rules & Principles

1. **Never hallucinate venues** — All results come from the dataset; no synthetic venues
2. **Never assume hours before 9 PM** — Dataset scope is after-9 PM only
3. **Treat vibe tags as probabilistic** — Tags describe tendencies, not guarantees
4. **Prefer variety over redundancy** — Recommendations and plans should diversify
5. **Surface uncertainty explicitly** — Viability badges use "likely" language
6. **Optimize for real human nights** — Route realism, group dynamics, energy pacing
7. **Time-aware features use local device time** — Open Now, viability badges, Kitchen open
8. **Graceful degradation** — No API key? Color gradients instead of photos. No lat/lng? Neighborhood centroid with jitter.

---

## 11. Testing & Quality Assurance

### 11.1 Test Infrastructure

- **Runner:** Vitest v3.0+ (ES modules)
- **Config:** `vitest.config.js`
- **Commands:** `npm test` (run once), `npm run test:watch` (watch mode)
- **CI:** Tests run on GitHub Actions before deploy

### 11.2 Test Coverage Map

| Test File | Scope | Coverage Area |
|---|---|---|
| `utils.test.js` | normalizeValue, parseTimeToMinutes, parseHHMM, minutesToLabel, parseDistanceMiles, getVibeSet, collectVibes | Core utilities |
| `csv-parser.test.js` | CSV parsing edge cases (quotes, commas, empty rows) | Data loading |
| `recommendation.test.js` | Recommendation scoring and ranking | Intelligence |
| `planner.test.js` | Night plan generation and vibe arcs | Intelligence |
| `crawl-history.test.js` | Visit tracking, ratings, stats | Personalization |
| `features.test.js` | Feature flags, viability badge logic | Feature logic |
| `share-plan.test.js` | Plan URL encoding/decoding roundtrip | Sharing |
| `venue-data.test.js` | Dataset integrity (no empty names, valid areas, closing times) | Data quality |

### 11.3 Linting

- **Tool:** ESLint v9.0+
- **Target:** ES2022, browser environment
- **Scope:** All JS files in root and `lib/` directory
- **Commands:** `npm run lint`, `npm run lint:fix`

---

## 12. Infrastructure & Deployment

### 12.1 Hosting

| Platform | Role | Config |
|---|---|---|
| Vercel | Primary production host | `vercel.json` — static deploy, SPA rewrites |
| GitHub Pages | CI/CD fallback | `.github/workflows/deploy.yml` — auto-deploy on push to main |

### 12.2 CI/CD Pipeline

```
Push to main → GitHub Actions → Checkout → Setup Pages → Upload Artifact → Deploy
```

### 12.3 Environment Configuration

- **No required environment variables** — fully static
- **Optional:** `config.js` for Google Places API key and Plausible analytics domain
- **Template:** `config.example.js` provided for setup

### 12.4 PWA Configuration

- `manifest.json` with standalone display mode
- Dark theme colors (`#0b0d14` background, `#0a0c12` theme)
- Apple mobile web app meta tags for iOS
- No service worker yet (planned)

---

## 13. Analytics & Success Metrics

### 13.1 Current Metrics (Measurable Today)

| Metric | Target | How Measured |
|---|---|---|
| Venue coverage | 500+ venues, 38 neighborhoods | Dataset count |
| Filter responsiveness | Instant (<50ms) | Client-side, no network |
| Recommendation relevance | Top 3 share ≥2 vibe tags with source | Algorithm validation |
| Mobile usability | All targets ≥48px | CSS audit |
| Initial load time | <2s on 4G | Static site, no API blocking |
| Plan share fidelity | 100% roundtrip accuracy | Unit tests (share-plan.test.js) |
| Test pass rate | 100% | CI pipeline |

### 13.2 Planned Metrics (Require Analytics)

| Metric | Target | Requires |
|---|---|---|
| Weekly active users | 500+ | Plausible analytics |
| Plans generated per session | 1+ | Event tracking |
| Recommendations viewed per session | 3+ | Event tracking |
| Favorites per user | 10+ | localStorage audit or analytics |
| Share rate (plans shared / plans generated) | 30%+ | Event tracking |
| Bounce rate | <40% | Analytics |
| Pages per session | 2.5+ | Analytics |
| Return visit rate (monthly) | 40%+ | Analytics |

---

## 14. Competitive Landscape

| Competitor | Strengths | Weaknesses vs. LNV |
|---|---|---|
| **Google Maps** | Universal, real-time hours, reviews | No vibe filtering, no route planning, no nightlife focus |
| **Yelp** | Deep reviews, photos | Not nightlife-tuned, no multi-stop, no time-aware features |
| **Infatuation** | Editorial curation | Limited to major cities, no personalization, no planning |
| **Discotech** | Nightclub-focused, table booking | Club-only, no bars/restaurants, not Seattle-focused |
| **Fever** | Events/experiences | Event-centric, not venue-centric |
| **LNV** | Vibe-first, nightlife-native, route planning, free, no sign-up | Limited to Seattle, no user reviews, no real-time crowd data |

---

## 15. Identified Areas of Improvement

### CRITICAL — Architectural & Code Quality

| # | Area | Current State | Impact | Effort |
|---|---|---|---|---|
| C1 | **Code duplication across pages** | `parseCSV`, `normalizeValue`, `loadDataFromCSV`, `parseTimeToMinutes`, `getVibeSet`, and `parseDistanceMiles` are duplicated verbatim in `app.js`, `recommend.js`, `planner.js`, AND `lib/core.js` / `lib/features.js`. The shared library exists but pages still use local copies. | Maintenance risk, bug divergence, bloated payloads | Medium |
| C2 | **No service worker** | PWA manifest exists but no offline support. The app fails completely without network. | Poor offline experience, loses PWA "installable" quality | Medium |
| C3 | **No error boundary / error UI** | Failed `fetch()` calls (CSV load, Google Places API) silently fail or log to console. No user-facing error state. | Confusing blank screens on failure | Low |
| C4 | **SPA rewrites misconfigured** | `vercel.json` rewrites all routes to `index.html`, but the app is multi-page (planner.html, recommend.html, etc.). This causes 404s if Vercel serves index.html for /planner. | Broken deep links on Vercel | Low |

### HIGH — Feature Gaps

| # | Area | Current State | Impact | Effort |
|---|---|---|---|---|
| H1 | **Travel time estimates are oversimplified** | Same area = 5 min, different area = 15 min. No real routing. Distance-based formula exists in `features.js` but isn't used in the planner. | Plans feel unrealistic for cross-city routes | Medium |
| H2 | **No venue-to-venue driving distances** | All distances are from Little Red Hen Bar anchor only. No way to see "how far is Stop 2 from Stop 3?" | Plan routing is anchor-centric, not route-aware | High |
| H3 | **No real-time crowd / wait data** | Viability badges are heuristic-only (category + time). No live data integration. | Badges can be misleading for specific nights | High |
| H4 | **No event / special night data** | No DJ sets, live music schedules, trivia nights, happy hours. Users have to check venue websites. | Misses the #1 reason people pick a venue on a specific night | High |
| H5 | **Neighborhood comparison is basic** | Stats only (counts, category breakdown). No map overlay, no "best for" verdict, no time-of-night analysis. | Comparison doesn't drive decisions effectively | Medium |
| H6 | **No user reviews or ratings aggregation** | "Been There" tracks personal ratings but there's no community signal. | Recommendations lack social proof | High |

### MEDIUM — UX & Polish

| # | Area | Current State | Impact | Effort |
|---|---|---|---|---|
| M1 | **Photo coverage is inconsistent** | Google Places API is optional and rate-limited. Many venues show color gradient fallbacks. Photo cache limited to 200 entries. | Visual quality varies, less engaging browse | Medium |
| M2 | **No deep linking to venues** | Can't share a direct URL to a specific venue detail drawer. Only plan sharing is URL-encoded. | Can't link friends to a specific venue | Low |
| M3 | **Recommendation engine doesn't learn** | Recommendation scoring is static. Viewing, saving, or visiting venues doesn't improve future recommendations. | Recommendations feel generic over time | High |
| M4 | **Onboarding doesn't persist preferences** | 3-step intent flow applies filters once but doesn't save persona. Returning users start fresh. | Missed opportunity for personalization | Low |
| M5 | **No "What's open now" landing mode** | Users arriving late at night want instant "show me what's open nearby" — current UX requires toggling Open Now filter manually. | Friction for the most time-sensitive use case | Low |
| M6 | **Distance is anchor-relative only** | All distance is from Little Red Hen Bar. No geolocation-based "near me" sorting. | Users outside the anchor area see irrelevant distance data | Medium |

### LOW — Technical Debt

| # | Area | Current State | Impact | Effort |
|---|---|---|---|---|
| L1 | **No build step / no bundling** | All JS and CSS served as-is. No minification, no tree-shaking, no code splitting. | Larger-than-necessary payloads (~100KB+ JS, ~50KB CSS) | Medium |
| L2 | **localStorage without size management** | Crawl history, favorites, and photo cache all stored in localStorage with no aggregate size monitoring. | Potential quota exceeded errors after extended use | Low |
| L3 | **No accessibility audit** | No ARIA labels on dynamic content, no screen reader testing, no focus management on drawer open/close. | Excludes users with assistive technologies | Medium |
| L4 | **Plausible analytics not yet active** | Config exists but analytics not deployed. No visibility into user behavior. | Can't measure success metrics or prioritize features | Low |
| L5 | **JSON mirror is redundant** | Both CSV and JSON versions of the dataset exist. Only CSV is loaded. JSON is unused. | Confusing, potential data drift | Trivial |
| L6 | **Missing 512x512 icon** | PWA manifest references `favicon.png` for both 192x192 and 512x512 sizes. Likely only one resolution exists. | Install banner may show blurry icon | Trivial |

---

## 16. Roadmap

### Shipped — v1.0 (January 2026)

- [x] Venue dataset import (XLSX → CSV → JSON)
- [x] Letterboxd-style card grid with vibe color coding
- [x] Search, filter, sort by area / category / vibe / distance / closing
- [x] Recommendation engine (vibe + category + area + distance scoring)
- [x] Admin dashboard with dataset stats and breakdowns
- [x] Mobile-first responsive design with bottom nav and filter drawer
- [x] Logo and favicon
- [x] Deployed to Vercel + GitHub

### Shipped — v1.1 (February 2026)

- [x] Google Places Photos integration (venue images on cards)
- [x] "Open now" time-aware filtering with status pills
- [x] Venue detail drawer / modal with full info, links, and actions
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
- [x] Keyboard shortcuts (`/` to search, `Escape` to close)
- [x] Pull-to-refresh (mobile)
- [x] Swipe-to-dismiss detail drawer
- [x] Vibe legend with color coding
- [x] Neighborhood momentum hint (peak hours)
- [x] PWA manifest
- [x] Shared library modules (lib/core, crawl-history, features, share-plan)
- [x] Test suite (Vitest — 8 test files covering core logic)
- [x] ESLint configuration
- [x] Haptic feedback (vibration API)
- [x] CI/CD via GitHub Actions

---

### v1.2 — Code Health & Reliability (Next Up)

*Theme: Clean up the foundation before building higher*

| Item | Addresses | Priority |
|---|---|---|
| Deduplicate shared functions — make `recommend.js` and `planner.js` import from `lib/core.js` instead of inlining copies | C1 | Critical |
| Fix Vercel SPA rewrites — remove catch-all or add proper rewrites for each HTML page | C4 | Critical |
| Add user-facing error states for CSV load failure, network errors, and API failures | C3 | Critical |
| Add deep linking to venue detail drawer (`?venue=name`) | M2 | High |
| Add "What's open right now" quick-launch mode on homepage for late-night arrivals | M5 | High |
| Persist onboarding persona in localStorage and re-apply on return visits | M4 | Medium |
| Remove unused JSON dataset mirror or sync it via build script | L5 | Low |
| Add proper 512x512 PWA icon | L6 | Low |
| Activate Plausible analytics on production domain | L4 | Low |

---

### v1.3 — Offline & Performance

*Theme: Make it work at 1 AM with one bar of signal*

| Item | Addresses | Priority |
|---|---|---|
| Implement service worker for offline caching (dataset, HTML/CSS/JS shell, map tiles) | C2 | Critical |
| Add build step with bundling + minification (esbuild or Vite) | L1 | High |
| Implement localStorage quota monitoring and auto-cleanup of oldest cache entries | L2 | Medium |
| Lazy-load map view (Leaflet) only when user switches to map tab | Performance | Medium |
| Pre-cache venue photos in service worker for favorited venues | Performance | Low |

---

### v1.4 — Smarter Routing & Location

*Theme: Know where the user actually is*

| Item | Addresses | Priority |
|---|---|---|
| Add browser geolocation for "near me" distance sorting | M6 | High |
| Upgrade travel estimates using actual venue lat/lng distance (Haversine formula) | H1 | High |
| Show venue-to-venue distance in night plan (not just anchor-relative) | H2 | High |
| Add walking/transit time estimates alongside driving | H1 | Medium |
| Custom anchor point — let user set their starting location | M6 | Medium |

---

### v1.5 — Events & Live Data

*Theme: "What's happening tonight?" not just "What's open tonight?"*

| Item | Addresses | Priority |
|---|---|---|
| Event/special night overlays (live music schedules, DJ sets, trivia nights, karaoke nights, happy hours) | H4 | High |
| Integrate real-time business status via Google Places or similar API | H3 | High |
| "Tonight's picks" curated featured section based on day-of-week patterns | H4 | Medium |
| Venue hours refinement — ingest actual open/close per day-of-week | H3 | Medium |
| Push notifications for favorited venue events (requires service worker) | H4 | Low |

---

### v1.6 — Social & Community

*Theme: Nightlife is social — the app should be too*

| Item | Addresses | Priority |
|---|---|---|
| User accounts with cloud sync for favorites, crawl history, and plans | Social | High |
| Community ratings aggregation — surface "liked by X% of visitors" | H6 | High |
| Friend activity feed (opt-in) — see where friends have been | Social | Medium |
| Shared favorites lists ("Kyle's Top 10 Dives") | Social | Medium |
| Review snippets from external sources (Google, Yelp) | H6 | Medium |

---

### v1.7 — Intelligence & Personalization

*Theme: The more you use it, the smarter it gets*

| Item | Addresses | Priority |
|---|---|---|
| Adaptive recommendations based on visit history and ratings | M3 | High |
| "You might like" proactive suggestions on browse page | M3 | Medium |
| Neighborhood affinity scoring based on user behavior | M3 | Medium |
| Vibe preference profiling — auto-detect user's vibe profile from favorites and visits | M3 | Medium |
| "Night recap" — summarize a completed crawl with stats and shareable card | Engagement | Low |

---

### v2.0 — Platform Expansion

*Theme: Beyond Seattle*

| Item | Priority |
|---|---|
| Custom domain (latenightvibes.seattle or similar) | High |
| Multi-city architecture (Portland, Austin, Denver as next targets) | High |
| Venue submission / claim flow for venue owners | Medium |
| Partnership integrations (rideshare, table booking, cover charge purchasing) | Medium |
| Native app wrapper (Capacitor or React Native web view) | Low |
| Accessibility audit and WCAG 2.1 AA compliance | High |

---

### Roadmap Visualization

```
              NOW                                         FUTURE
               │                                            │
  v1.0 ────── v1.1 ────── v1.2 ────── v1.3 ────── v1.4 ── v1.5 ── v1.6 ── v1.7 ── v2.0
  Jan '26      Feb '26     Mar '26     Apr '26     May     Jun     Aug     Oct     2027
               │                                            │
  ┌────────────┘                                            │
  │ SHIPPED: Browse, Map, Recs,                             │
  │ Planner, Compare, Admin,                                │
  │ Favorites, Crawl History,                               │
  │ Viability Badges, Sharing,                              │
  │ Onboarding, PWA, Tests, CI/CD                           │
  └─────────────────────────────────────────────────────────┘
                │
  ┌─────────────┘
  │ NEXT: Code dedup, Error states,
  │ Deep links, Quick-launch mode,
  │ Vercel fix, Analytics activation
  └───────────────────────────────────
```

---

## 17. Appendix

### A. Vibe Color Map (Reference)

| Vibe | Color | Hex (Approximate) |
|---|---|---|
| chill | Steel Blue | `#4a90d9` |
| dancey | Hot Magenta | `#e040a0` |
| upscale | Gold | `#d4a843` |
| divey | Amber | `#c78830` |
| high-energy | Red-Orange | `#e85535` |
| live-music | Purple | `#9b59b6` |
| date-friendly | Rose | `#e8788a` |
| sports | Green | `#3ddc84` |
| views | Teal | `#28c9b7` |
| casual | Slate | `#78909c` |
| loud | Orange-Red | `#d94e33` |
| rowdy | Deep Orange | `#f4511e` |
| group-friendly | Lime | `#8bc34a` |
| late-eats | Warm Yellow | `#fdd835` |
| interactive | Cyan | `#26c6da` |

### B. Key localStorage Keys

| Key | Format | Owner |
|---|---|---|
| `lnv_favorites` | `string[]` (JSON) | app.js |
| `lnv_crawl_history` | `Record<string, {visited, rating, ts}>` (JSON) | lib/crawl-history.js |
| `lnv_photo_cache_v1` | `Record<string, {url, ts}>` (JSON) | venue-photos.js |
| `lnv_onboarding_done` | `"1"` | app.js |
| `lnv_filters` | `{area, category, sort, search, vibes, view, openNow, visitedFilter}` (JSON) | app.js (sessionStorage) |

### C. Keyboard Shortcuts

| Key | Action | Context |
|---|---|---|
| `/` | Focus search input | Browse page |
| `Escape` | Close active drawer/overlay | Global |
| `↑` / `↓` | Navigate autocomplete results | Search focused |
| `Enter` | Select autocomplete result | Search focused |

### D. API Endpoints Used

| API | Endpoint | Purpose |
|---|---|---|
| Google Places (New) | `https://places.googleapis.com/v1/places:searchText` | Venue photo lookup |
| Google Maps | `https://www.google.com/maps/dir/...` | Driving directions links |
| Plausible | `https://plausible.io/js/script.js` | Privacy-focused analytics |
| Leaflet Tiles | `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png` | Map tile layer |

---

*End of document. This PRD is the single source of truth for Late Night Vibes Seattle product scope, architecture, and direction.*
