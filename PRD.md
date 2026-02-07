# Late Night Vibes Seattle — Product Requirements Document

**Version:** 1.0
**Last Updated:** February 6, 2026
**Status:** Live — [late-night-vibes-seattle.vercel.app](https://late-night-vibes-seattle.vercel.app)
**Repo:** [github.com/hondoentertainment/LateNightVibesSeattle](https://github.com/hondoentertainment/LateNightVibesSeattle)

---

## 1. Overview

Late Night Vibes Seattle is a nightlife discovery and recommendation platform for the Seattle metro area. It surfaces 326+ venues that are typically open after 9 PM, organized by neighborhood, category, vibe, and distance from a central anchor point (Little Red Hen Bar).

The product operates as a static web app with no backend, powered entirely by a CSV dataset and client-side JavaScript.

---

## 2. Problem Statement

Seattle's nightlife is fragmented across dozens of neighborhoods. Existing tools (Google Maps, Yelp) are general-purpose and don't optimize for the late-night use case — they don't filter by vibe, don't consider energy progression, and don't recommend venue-to-venue routes. There is no dedicated nightlife concierge for Seattle's after-9 PM scene.

---

## 3. Target Users

- Seattle residents planning a night out (solo, date, group)
- Visitors looking for curated nightlife options
- Nightlife-curious people who want to explore beyond their usual neighborhood

---

## 4. Core Features

### 4.1 Venue Browse (index.html)
- **Card grid** of all venues, Letterboxd-inspired design
- **Search** by name, neighborhood, category, or vibe tag
- **Filter** by Area, Category
- **Sort** by Name, Area, Category, Distance, Closing Time
- **Vibe chip filters** — toggle one or more vibes to narrow results
- **Color-coded poster blocks** — gradient mapped to the venue's primary vibe tag
- **Attribute border accents** — card border color shifts based on key tags (upscale, divey, dancey, live-music, sports, karaoke, late-eats, rooftop, views, adult)
- **Google Maps links** — every venue name, address, and Directions link opens a driving route from Little Red Hen Bar
- **Mobile-first layout** — bottom sheet filter drawer, sticky search, bottom nav, 2-column card grid on small screens

### 4.2 Recommendations (recommend.html)
- **Venue-to-venue similarity engine** powered by:
  - Shared vibe tags (Jaccard similarity, weighted 50%)
  - Same category match (20%)
  - Same neighborhood match (20%)
  - Distance proximity to anchor (10%)
- **Controls**: select a starting venue, set max distance (miles), set result count
- **Output**: ranked recommendation cards with reasoning (shared vibes, category match, neighborhood)
- **Mobile**: controls inline at top; bottom nav for page switching

### 4.3 Admin Dashboard (admin.html)
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

### 5.1 Vibe Tags (25 unique)
adult, casual, chill, dancey, date-friendly, divey, drinks, food-focused, games, general, group-friendly, group-fun, high-energy, interactive, late-eats, late-night, live-music, loud, playful, rowdy, social, sports, sweet, upscale, views

### 5.2 Areas (38 neighborhoods)
Capitol Hill, Ballard, Fremont, Downtown/Belltown, Queen Anne, Chinatown-ID, Eastside, West Seattle, Georgetown, SoDo, Greenwood, Shoreline, Lake City, Central District, First Hill, Beacon Hill, Rainier Valley, University District, Wallingford, Madison Valley, Madrona, South Lake Union, Burien, Renton, Tukwila, Northgate, Lake Forest Park, Magnolia, Interbay, White Center, Kent, Auburn, Everett, Skyway, Columbia City, Crown Hill, Green Lake, Strip Clubs

---

## 6. Architecture

```
Static Site (HTML/CSS/JS)
├── index.html         — Venue browse + filters
├── recommend.html     — Recommendation engine
├── admin.html         — Admin dashboard
├── styles.css         — Shared styles (mobile-first)
├── recommend.css      — Recommendation page styles
├── admin.css          — Admin page styles
├── app.js             — Browse logic, filters, rendering
├── recommend.js       — Recommendation engine + rendering
├── admin.js           — Admin dashboard logic
├── venue_list_500plus.csv  — Primary dataset (CSV)
├── seattle_venue_set_500plus.json  — Dataset (JSON mirror)
├── seattle_after_9pm_from_little_red_hen_500plus_with_vibes.xlsx  — Source Excel
├── lnv-logo.png       — Header logo
└── favicon.png        — Browser tab / bookmark icon
```

**Hosting:** Vercel (static deployment, auto-aliased)
**Source Control:** GitHub — hondoentertainment/LateNightVibesSeattle
**Backend:** None (fully client-side)
**Dependencies:** None (vanilla HTML/CSS/JS)

---

## 7. Design System

### 7.1 Visual Identity
- **Logo:** Neon green-to-cyan "LNV" mark with glow effect
- **Palette:** Dark backgrounds (#0b0d14, #101520), neon accents (#2bff86 green, #1ad1ff cyan, #ff7ad6 pink)
- **Style:** Letterboxd-inspired card grid, cinematic dark theme

### 7.2 Mobile UX
- Bottom navigation bar (Browse / For You / Admin)
- Slide-up bottom sheet for filters with drag handle
- Sticky search bar below header
- 48px minimum touch targets on all interactive elements
- Safe area inset support for notched devices
- 2-column card grid at mobile widths

### 7.3 Desktop UX
- Sidebar with filters and vibe chips
- Header nav pills for page switching
- 4+ column card grid at wide widths

---

## 8. Recommendation Algorithm

```
Score = (vibeScore * 0.5) + (categoryScore * 0.2) + (areaScore * 0.2) + (distanceScore * 0.1)

vibeScore     = |intersection(baseVibes, candidateVibes)| / |union(baseVibes, candidateVibes)|
categoryScore = 1 if same category, else 0
areaScore     = 1 if same neighborhood, else 0
distanceScore = 1 - min(|baseDist - candidateDist| / maxDist, 1)
```

Results are sorted by score descending, capped at user-specified count (default 8, max 20).

---

## 9. Behavioral Rules

- Do NOT hallucinate venues outside the dataset
- Do NOT assume hours earlier than 9 PM
- Treat vibe tags as probabilistic, not absolute
- Prefer variety and balance over redundancy
- Surface uncertainty explicitly
- Optimize for real human nights, not theoretical perfection

---

## 10. Roadmap

### Shipped (v1.0)
- [x] Venue dataset import (XLSX → CSV → JSON)
- [x] Letterboxd-style card grid with vibe color coding
- [x] Search, filter, sort by area/category/vibe/distance/closing
- [x] Recommendation engine (vibe + category + area + distance scoring)
- [x] Admin dashboard with dataset stats and breakdowns
- [x] Mobile-first responsive design with bottom nav and filter drawer
- [x] Logo and favicon
- [x] Deployed to Vercel + GitHub

### Planned (v1.1+)
- [ ] Google Places Photos integration (venue images on cards)
- [ ] Night plan builder (2–5 stop itineraries with vibe escalation)
- [ ] Neighborhood comparison view
- [ ] "Open now" time-aware filtering
- [ ] Venue detail drawer/modal with full info
- [ ] Saved lists / favorites (localStorage)
- [ ] Custom domain
- [ ] Venue-to-venue driving distance (instead of anchor-only)

---

## 11. Success Metrics

- Venue coverage: 326 venues across 38 neighborhoods (target: 500+)
- Filter responsiveness: instant client-side filtering
- Recommendation relevance: top 3 results share at least 2 vibe tags with source venue
- Mobile usability: all interactive elements ≥ 48px touch target
- Load time: < 2s on 4G connection (static site, no API calls)
