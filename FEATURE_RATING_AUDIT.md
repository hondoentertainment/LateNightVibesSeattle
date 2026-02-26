# Feature Rating Audit

**App**: Late Night Vibes Seattle (static HTML/CSS/JS)  
**Date**: February 26, 2025  
**Scope**: LateNightVibesSeattle-1

---

## Summary

- **Overall score**: 7.3 / 10
- **Highest**: Venue Detail Drawer (8.5/10), Filters (8/10)
- **Needs work**: Recommend/For You (6/10), Admin (5.5/10)

---

## Feature Ratings

### 1. Index / Browse Venues — 8/10

**Route/Scope**: `index.html`, main venue grid

**Rationale**: Core browse flow is solid. Grid, load-more pagination, skeleton loading, empty states, and result summary all work well. Mobile UX has quick-filter chips, time banner, pull-to-refresh, and haptics. Filter persistence and "Near me" sort with geolocation are present. Minor gaps: grid cards don’t link from recommend/planner, and map view lacks accessibility labeling on markers.

**Recommendations** (polish to reach 10):

1. Add `aria-label` to Leaflet map markers (e.g., "Venue name, Area") for screen reader users
2. Surface a brief loading skeleton or inline status when switching to map view during Leaflet load
3. Improve empty-state CTA hierarchy when many filters are active (e.g., "Try Recommendations" vs "Clear filters" ordering)

---

### 2. Recommend (For You) — 6/10

**Route/Scope**: `recommend.html`

**Rationale**: Recommendation engine (vibe similarity, distance, context modes, crawl history) works and scores are surfaced. Score breakdown bars and "Surprise me" are implemented. Gaps: no venue detail drawer (cards only have Directions links), no Saved link in top nav, no loading skeleton on first load (skeletons exist but UX could be clearer), and cards aren’t tappable to open full venue details. "Exclude vibe" is present but "undo exclude" isn’t discoverable.

**Recommendations**:

1. **Add click-to-detail on recommendation cards** — Make each card open a detail panel or navigate to `index.html?venue=Name` so users can Save, Share, Mark visited, or Add to Plan
2. Add a "Saved" link in the desktop top nav on `recommend.html` (mirror index)
3. Add an "Exclude vibes" management area — list excluded vibes with clear/unexclude controls
4. Add `aria-live` for "No nearby matches" and "Pick a starting venue" empty states

---

### 3. Planner (Night Plan) — 7.5/10

**Route/Scope**: `planner.html`

**Rationale**: Vibe arcs, time validation, lock/unlock stops, shuffle with undo, share plan, reroute-from-here, and swap stops are implemented. Shared-plan URL loading and group vote UI work. Travel estimates (walk vs drive) use `LNVGeo`. Gaps: no direct link from stop cards to venue detail drawer (stops open external map links only); group vote state is local and not persisted; "Build my night" has no explicit loading state; and `groupSize` is collected but not clearly used in the algorithm.

**Recommendations**:

1. **Make stop cards open venue detail drawer** — Either embed a minimal drawer on planner or link to `index.html?venue=Name` so users can Save, Add to Plan, etc.
2. Persist group vote state in `localStorage` or URL so votes survive refresh
3. Show a loading state (skeleton or spinner) on "Build my night" while `generateItinerary` runs
4. Wire `groupSize` into filtering (e.g., deprioritize tiny venues for 9+ groups)

---

### 4. Neighborhoods (Compare) — 7/10

**Route/Scope**: `neighborhoods.html`

**Rationale**: Side-by-side comparison of 2–3 areas with venue counts, top vibes, categories, closing times, and "Best for" verdict works. Browse/Planner CTAs with `lnv_jumpArea` and `?area=` work. Default selection (Capitol Hill vs Ballard) is helpful. Gaps: no loading skeleton, no empty-state error handling for failed load (error state exists but could be clearer), no way to open venue detail from a neighborhood card, and no "Saved" link in top nav.

**Recommendations**:

1. Add a loading skeleton while venue data loads (matching planner/rec pattern)
2. Add "Saved" to the desktop top nav on neighborhoods page
3. Consider a "View sample venues" link that opens browse with area filter applied
4. Add `aria-live` for comparison results when selections change

---

### 5. Admin — 5.5/10

**Route/Scope**: `admin.html`

**Rationale**: Dataset stats, area/category/vibe breakdowns, and CSV import with drag-and-drop work. Import feedback and error states exist. Gaps: no auth or role check (anyone can access); import only updates in-memory / doesn’t persist to a backend; "Reload data" fetches CSV again but doesn’t replace a persisted dataset; no validation of CSV schema before import; and admin has minimal meta (no `viewport-fit=cover`, fewer PWA assets than other pages).

**Recommendations**:

1. Add a simple auth gate (e.g., query param or basic password) so admin isn’t publicly editable
2. Add CSV schema validation with clear error messages (expected columns, sample row)
3. Add confirmation before replacing data ("This will replace X venues")
4. Align admin meta and PWA links with other pages (viewport, apple-touch-icon)

---

### 6. Venue Detail Drawer — 8.5/10

**Route/Scope**: `index.html` — `#detailDrawer`

**Rationale**: Rich detail view with Save, Share, Mark visited, rating (thumbs up/down), Add to Plan, viability badges, trust badge, LocalBusiness JSON-LD for SEO, and swipe-to-dismiss. Focus trap, Escape close, and return-focus work. `?venue=Name` deep link and poster photos (when enabled) are present. Minor gaps: drawer is only on index, so recommend/planner/neighborhoods can’t open it; no "Recently viewed" or related venues in the drawer.

**Recommendations** (polish to reach 10):

1. Add "Similar venues" or "More in [Area]" section in the drawer with 2–3 recommendations
2. Ensure poster/background has `aria-hidden="true"` if it’s decorative
3. Add `aria-describedby` to the drawer when body content is present

---

### 7. Filters — 8/10

**Route/Scope**: `index.html` — sidebar (desktop), filter drawer (mobile)

**Rationale**: Area, category, sort (name, area, category, distance, near-me, closing), Open Now, Visited (Been There / Not Yet), and vibe chips work. Filter drawer has proper `role="dialog"`, focus trap, Escape. Active filter strip and "Clear all" on mobile work. Filter state persists to `sessionStorage`. "Find my night again" retriggers onboarding. Gaps: no explicit "reset to defaults" on desktop; filter badge on mobile could be more prominent when many filters are active.

**Recommendations** (polish to reach 10):

1. Add a "Reset filters" control in the desktop sidebar
2. Visually emphasize the filter badge when 4+ filters are active
3. Add `aria-describedby` to the filter drawer describing available filter types

---

### 8. Search — 7.5/10

**Route/Scope**: `index.html` — `#searchInput`, `#searchInputMobile`

**Rationale**: Full-text search over venues with 250ms debounce, autocomplete (venues, areas, vibes), keyboard nav (Arrow Up/Down, Enter), `/` shortcut to focus, and clear button work. Selecting venue from autocomplete opens detail; area/vibe apply filters. `aria-label` on search and `aria-live` on results exist. Gaps: autocomplete has `role="listbox"` but items lack `role="option"`; no "no results" message inside the dropdown; search isn’t available on recommend/planner/neighborhoods.

**Recommendations**:

1. Add `role="option"` to autocomplete items and `aria-activedescendant` when keyboard-navigating
2. Show "No matches" in the dropdown when `matches.length === 0` and `query.length >= 2`
3. Consider a global search bar in the header on recommend/planner/neighborhoods that routes to index with pre-filled query

---

### 9. Saved / Favorites — 7.5/10

**Route/Scope**: `index.html?view=saved`, heart buttons, export/import

**Rationale**: Save/unsave, `?view=saved` filter, export JSON backup, and import with merge work. Backup bar appears in saved view. Favorites persist in `localStorage`. Bottom nav highlights Saved when on saved view. Gaps: no sync across devices; import is file-only (no drag-and-drop); no empty-state illustration when saved list is empty; "Saved" link missing from top nav on recommend and neighborhoods.

**Recommendations**:

1. Add "Saved" to the desktop top nav on recommend.html and neighborhoods.html
2. Add drag-and-drop for the import backup file input
3. Improve empty-state for saved view (e.g., illustration and clearer CTA)
4. Add `aria-live` when favorites are added/removed for screen readers

---

### 10. Map View — 7/10

**Route/Scope**: `index.html` — view toggle, Leaflet map

**Rationale**: Grid/Map toggle, Leaflet with dark tiles, vibe-colored markers, user location when "Near me" is used, and card–marker sync (hover/click) work. Momentum hint for peak hours is present. Gaps: markers have no `aria-label` for screen readers; map isn’t keyboard-focusable; no loading state when switching to map before Leaflet loads; jitter on neighborhood fallback coords can cause marker overlap.

**Recommendations**:

1. Add accessible labels for markers (e.g., via Leaflet’s bindTooltip or custom `aria-label` on marker elements)
2. Ensure the map container is focusable and that Tab moves focus into the map with a visible focus ring
3. Show a skeleton or "Loading map…" state in `#mapContainer` until Leaflet is ready
4. Consider clustering or reducing jitter when many venues share the same neighborhood

---

### 11. Onboarding — 7.5/10

**Route/Scope**: `index.html` — `#onboardingOverlay`

**Rationale**: 3-step intent flow (who, energy, area) with progress dots, Skip option, and persistence works. Results apply area + vibe filters. "Find my night again" in filter drawer retriggers. `role="dialog"`, `aria-labelledby`, and step `aria-label`s exist. Gaps: no focus trap inside the overlay; progress dots could use `aria-current="step"`; onboarding doesn’t run on recommend/planner first visit; no way to edit preferences after completion without retriggering.

**Recommendations**:

1. Add focus trap inside the onboarding overlay (Tab cycles within the card)
2. Add `aria-current="step"` to the active progress dot
3. Add a "Preferences" or "Edit my night profile" link in the filter drawer for quick edits without full retrigger

---

### 12. Quick Filters (Mobile) — 8/10

**Route/Scope**: `index.html` — `#quickFilters`

**Rationale**: One-tap chips (Open Now, Chill, Dancey, Live Music, Late Eats, Date Night, Dive Bar) with visual state sync work. Chips have clear labels and color dots. Gaps: no keyboard access when chips are off-screen or in scroll; "Dancey" vs "dancey" casing could be normalized in chip labels.

**Recommendations** (polish to reach 10):

1. Ensure quick-filter chips are in the tab order and have visible focus styles
2. Add `aria-pressed="true/false"` to toggle-style chips (Open Now, vibe chips)

---

### 13. PWA / Offline — 7.5/10

**Route/Scope**: `sw.js`, `manifest.json`, install prompt

**Rationale**: Service worker precaches HTML, CSS, JS, libs, CSV, manifest, and splash screens. Fetch fallback serves cache when offline. Install prompt with dismiss logic and visit-based delay works. Manifest has name, icons, theme_color, display standalone. Gaps: admin.html not in precache; no cache versioning strategy documented; offline toast is generic; no offline-specific empty state for failed fetches.

**Recommendations**:

1. Add `admin.html` to precache if it should work offline
2. Add an offline-specific empty state when fetch fails and `!navigator.onLine`
3. Consider a "You're offline — showing cached data" banner when serving from cache

---

### 14. Tonight Highlights & Time Banner — 7/10

**Route/Scope**: `index.html` — `#tonightHighlights`, `#timeBanner`

**Rationale**: "What's on tonight" uses `LNVEvents.getTonightsHighlights`. Time banner (mobile) shows contextual CTAs (open count, plan, recs) by hour. Clicks apply Open Now or navigate to planner/recommend. Gaps: `LNVEvents` may be empty depending on data; time banner lacks `aria-live` for dynamic updates; tonight highlights have minimal structure for screen readers.

**Recommendations**:

1. Add `aria-live="polite"` to the time banner so updates are announced
2. Ensure tonight highlights items have proper heading/link structure for screen readers
3. Add a fallback message when no highlights are found ("No special events tonight — browse all venues")

---

### 15. Crawl History (Been There) — 7.5/10

**Route/Scope**: Used in index, detail drawer, recommend, planner

**Rationale**: Mark visited, thumbs up/down, visited date display, and Visited/New filter work. Stats (e.g., "X visited · Y liked") appear when relevant. Data persists in `localStorage`. Gaps: no bulk export of crawl history; no way to clear ratings; crawl stats UI is minimal.

**Recommendations** (polish to reach 10):

1. Add "Clear visit history" or "Remove rating" in a settings/preferences area
2. Add export of visited venues (CSV or JSON) for backup
3. Surface crawl stats more prominently when they’re meaningful (e.g., in onboarding or recommend)

---

## Top Cross-Cutting Recommendations

1. **Unify venue detail access across pages** — Add a way to open full venue details (Save, Share, Add to Plan, Mark visited) from Recommend cards, Planner stops, and Neighborhood comparison. Either reuse the index drawer via navigation or add a minimal shared drawer component.

2. **Consistent top nav** — Add "Saved" to the desktop top nav on recommend.html and neighborhoods.html so users can reach favorites from every main page.

3. **Loading and empty states** — Add skeletons or explicit loading states for: Recommend first load, Planner "Build my night", Map view switch, and Neighborhoods load. Improve empty-state copy and CTAs across all pages.

4. **Accessibility hardening** — Add `role="option"` and `aria-activedescendant` to search autocomplete; add `aria-label` to map markers; add focus traps to onboarding; ensure all toggle chips have `aria-pressed`; add `aria-live` where content updates dynamically.

5. **Admin safeguards** — Add a simple auth check, CSV schema validation with clear errors, and a confirm-before-replace flow for dataset import.
