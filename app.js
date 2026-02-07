const DEFAULT_CSV = "venue_list_500plus.csv";

const PAGE_SIZE = 40;

const state = {
  all: [],
  filtered: [],
  vibes: new Set(),
  activeVibes: new Set(),
  favorites: new Set(),
  currentView: "grid", // "grid" or "map"
  showSavedOnly: false,
  openNowOnly: false,
  renderLimit: PAGE_SIZE,
};

/* ─── Favorites persistence ─── */
function loadFavorites() {
  try {
    const raw = localStorage.getItem("lnv_favorites");
    if (raw) {
      JSON.parse(raw).forEach((n) => state.favorites.add(n));
    }
  } catch (_) {}
}

function saveFavorites() {
  localStorage.setItem("lnv_favorites", JSON.stringify(Array.from(state.favorites)));
}

function toggleFavorite(name) {
  if (state.favorites.has(name)) state.favorites.delete(name);
  else state.favorites.add(name);
  saveFavorites();
}

loadFavorites();

/* ─── Saved-only view via URL ─── */
if (new URLSearchParams(window.location.search).get("view") === "saved") {
  state.showSavedOnly = true;
}

/* ─── Element refs ─── */
const $ = (id) => document.getElementById(id);

const elements = {
  csvFile: $("csvFile"),
  venueCount: $("venueCount"),
  filteredCount: $("filteredCount"),
  activeVibes: $("activeVibes"),
  statusText: $("statusText"),
  grid: $("venueGrid"),
  mapContainer: $("mapContainer"),
  resultSummary: $("resultSummary"),
  viewToggle: $("viewToggle"),
  vibeLegend: $("vibeLegend"),
  legendToggle: $("legendToggle"),
  // Desktop
  searchInput: $("searchInput"),
  areaSelect: $("areaSelectDesktop"),
  categorySelect: $("categorySelectDesktop"),
  sortSelect: $("sortSelectDesktop"),
  vibeList: $("vibeListDesktop"),
  autocompleteDesktop: $("autocompleteDesktop"),
  // Mobile drawer
  searchInputMobile: $("searchInputMobile"),
  areaSelectMobile: $("areaSelect"),
  categorySelectMobile: $("categorySelect"),
  sortSelectMobile: $("sortSelect"),
  vibeListMobile: $("vibeList"),
  autocompleteMobile: $("autocompleteMobile"),
  // Drawer
  filterToggle: $("filterToggle"),
  filterOverlay: $("filterOverlay"),
  filterDrawer: $("filterDrawer"),
  filterClose: $("filterClose"),
  // Open Now toggles
  openNowDesktop: $("openNowDesktop"),
  openNowMobile: $("openNowMobile"),
  // Load more
  loadMoreWrap: $("loadMoreWrap"),
  loadMoreBtn: $("loadMoreBtn"),
  loadMoreCount: $("loadMoreCount"),
  // Detail drawer
  detailOverlay: $("detailOverlay"),
  detailDrawer: $("detailDrawer"),
  detailClose: $("detailClose"),
  detailTitle: $("detailTitle"),
  detailBody: $("detailBody"),
};

/* ─── Drawer toggle (filters) ─── */
function openDrawer() {
  elements.filterOverlay.classList.add("open");
  elements.filterDrawer.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeDrawer() {
  elements.filterOverlay.classList.remove("open");
  elements.filterDrawer.classList.remove("open");
  document.body.style.overflow = "";
}

if (elements.filterToggle) elements.filterToggle.addEventListener("click", openDrawer);
if (elements.filterOverlay) elements.filterOverlay.addEventListener("click", closeDrawer);
if (elements.filterClose) elements.filterClose.addEventListener("click", closeDrawer);

/* ─── Detail drawer ─── */
function openDetail(venue) {
  const el = elements;
  el.detailOverlay.classList.add("open");
  el.detailDrawer.classList.add("open");
  document.body.style.overflow = "hidden";
  el.detailTitle.textContent = normalizeValue(venue.Name);

  const mapLink = normalizeValue(venue["Google Maps Driving Link"]);
  const address = normalizeValue(venue.Address);
  const phone = normalizeValue(venue.Phone);
  const website = normalizeValue(venue.Website);
  const closingTime = normalizeValue(venue["Typical Closing Time"]);
  const distance = normalizeValue(venue["Driving Distance"]);
  const area = normalizeValue(venue.Area);
  const category = normalizeValue(venue.Category);
  const tags = normalizeValue(venue["Vibe Tags"]).split(",").map((t) => normalizeValue(t)).filter(Boolean);
  const primaryTag = getPrimaryTag(tags.map((t) => t.toLowerCase()));
  const posterClass = `poster-general poster-${primaryTag.replace(/[^a-z0-9-]/g, "") || "general"}`;
  const isFav = state.favorites.has(normalizeValue(venue.Name));
  const statusPill = getOpenStatusPill(closingTime);

  let websiteLink = "";
  if (website) {
    try { websiteLink = `<a href="${website}" target="_blank" rel="noopener" style="color:#9fd6ff;text-decoration:none">${new URL(website).hostname}</a>`; }
    catch (_) { websiteLink = `<a href="${website}" target="_blank" rel="noopener" style="color:#9fd6ff;text-decoration:none">${website}</a>`; }
  }

  el.detailBody.innerHTML = `
    <div class="detail-poster ${posterClass}"></div>
    <div class="detail-name">${normalizeValue(venue.Name)}</div>
    <div class="detail-meta">${area} · ${category}</div>
    <div class="detail-row"><span class="label">Status</span>${statusPill}</div>
    ${closingTime ? `<div class="detail-row"><span class="label">Closes</span>${closingTime}</div>` : ""}
    ${distance ? `<div class="detail-row"><span class="label">Distance</span>${distance}</div>` : ""}
    ${address && address.toLowerCase() !== "click link" ? `<div class="detail-row"><span class="label">Address</span>${address}</div>` : ""}
    ${phone ? `<div class="detail-row"><span class="label">Phone</span><a href="tel:${phone}" style="color:#9fd6ff;text-decoration:none">${phone}</a></div>` : ""}
    ${website ? `<div class="detail-row"><span class="label">Website</span>${websiteLink}</div>` : ""}
    <div class="detail-vibes">${tags.map((t) => `<span class="pill">${t}</span>`).join("")}</div>
    <div class="detail-actions">
      ${mapLink ? `<a class="btn-primary" href="${mapLink}" target="_blank" rel="noopener">Directions</a>` : ""}
      <button class="btn-secondary ${isFav ? "favorited" : ""}" id="detailFavBtn" type="button">${isFav ? "♥ Saved" : "♡ Save"}</button>
      <button class="btn-share" id="detailShareBtn" type="button">Share</button>
    </div>
  `;

  const favBtn = $("detailFavBtn");
  if (favBtn) {
    favBtn.addEventListener("click", () => {
      toggleFavorite(normalizeValue(venue.Name));
      const nowFav = state.favorites.has(normalizeValue(venue.Name));
      favBtn.textContent = nowFav ? "♥ Saved" : "♡ Save";
      favBtn.classList.toggle("favorited", nowFav);
      renderGrid();
    });
  }

  const shareBtn = $("detailShareBtn");
  if (shareBtn) {
    shareBtn.addEventListener("click", () => {
      shareVenue(venue);
    });
  }
}

function closeDetail() {
  elements.detailOverlay.classList.remove("open");
  elements.detailDrawer.classList.remove("open");
  document.body.style.overflow = "";
}

if (elements.detailOverlay) elements.detailOverlay.addEventListener("click", closeDetail);
if (elements.detailClose) elements.detailClose.addEventListener("click", closeDetail);

/* ─── Share venue ─── */
function shareVenue(venue) {
  const name = normalizeValue(venue.Name);
  const area = normalizeValue(venue.Area);
  const category = normalizeValue(venue.Category);
  const vibes = normalizeValue(venue["Vibe Tags"]);
  const mapLink = normalizeValue(venue["Google Maps Driving Link"]);
  const text = `Check out ${name} — ${area}, ${category}. Vibes: ${vibes}.${mapLink ? ` Directions: ${mapLink}` : ""}`;

  if (navigator.share) {
    navigator.share({ title: name, text: text }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text).then(() => {
      showToast("Copied to clipboard!");
    }).catch(() => {});
  }
}

function showToast(msg) {
  const toast = document.createElement("div");
  toast.className = "share-toast";
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

/* ─── Sync paired selects ─── */
function syncSelect(source, target) {
  if (target) target.value = source.value;
}

/* ─── Utilities ─── */
function setStatus(text) {
  if (elements.statusText) elements.statusText.textContent = text;
}

function normalizeValue(value) {
  return (value || "").toString().trim();
}

function parseCSV(text) {
  const rows = [];
  let current = "";
  let inQuotes = false;
  const cells = [];
  function pushCell() { cells.push(current); current = ""; }
  function pushRow() { rows.push(cells.splice(0)); }
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === "\"") {
      const next = text[i + 1];
      if (inQuotes && next === "\"") { current += "\""; i++; }
      else inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      pushCell();
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      pushCell(); pushRow();
    } else {
      current += char;
    }
  }
  if (current.length > 0 || cells.length > 0) { pushCell(); pushRow(); }
  return rows;
}

function parseTimeToMinutes(value) {
  const text = normalizeValue(value).toLowerCase();
  const match = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
  if (!match) return null;
  let hour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  const meridiem = match[3];
  if (meridiem === "pm" && hour !== 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  return hour * 60 + minute;
}

function loadDataFromCSV(text) {
  const rows = parseCSV(text);
  if (!rows.length) return [];
  const headers = rows[0].map((h) => normalizeValue(h));
  return rows.slice(1)
    .filter((row) => row.some((c) => c && c.trim()))
    .map((row) => {
      const r = {};
      headers.forEach((h, i) => { r[h] = normalizeValue(row[i]); });
      return r;
    });
}

function collectVibes(venues) {
  const vibeSet = new Set();
  venues.forEach((venue) => {
    normalizeValue(venue["Vibe Tags"]).split(",")
      .map((t) => normalizeValue(t)).filter(Boolean)
      .forEach((t) => vibeSet.add(t));
  });
  return vibeSet;
}

function getVibeSet(venue) {
  return new Set(
    normalizeValue(venue["Vibe Tags"]).split(",")
      .map((t) => normalizeValue(t).toLowerCase()).filter(Boolean)
  );
}

/* ─── Open now / closed logic ─── */
function isVenueOpen(closingTimeStr) {
  const minutes = parseTimeToMinutes(closingTimeStr);
  if (minutes === null) return null;
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const closingAdj = minutes <= 360 ? minutes + 1440 : minutes;
  const nowAdj = nowMinutes < 540 ? nowMinutes + 1440 : nowMinutes;
  const openAt = 17 * 60;
  if (nowAdj >= openAt && nowAdj < closingAdj) return true;
  return false;
}

function getOpenStatusPill(closingTimeStr) {
  const status = isVenueOpen(closingTimeStr);
  if (status === null) return '<span class="pill">Hours unknown</span>';
  if (status) return '<span class="pill pill-open">Open now</span>';
  return '<span class="pill pill-closed">Likely closed</span>';
}

/* ─── Build filters ─── */
function buildOptions(select, values) {
  if (!select) return;
  const current = select.value;
  select.innerHTML = "<option value=\"\">All</option>";
  values.forEach((value) => {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = value;
    select.appendChild(opt);
  });
  select.value = current;
}

function buildVibeChips(vibes, container) {
  if (!container) return;
  container.innerHTML = "";
  Array.from(vibes).sort().forEach((tag) => {
    const label = document.createElement("label");
    label.className = "vibe-chip";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = tag;
    input.checked = state.activeVibes.has(tag);
    input.addEventListener("change", () => {
      if (input.checked) state.activeVibes.add(tag);
      else state.activeVibes.delete(tag);
      syncVibeCheckboxes();
      applyFilters();
    });
    const span = document.createElement("span");
    span.textContent = tag;
    label.appendChild(input);
    label.appendChild(span);
    container.appendChild(label);
  });
}

function syncVibeCheckboxes() {
  [elements.vibeList, elements.vibeListMobile].forEach((container) => {
    if (!container) return;
    container.querySelectorAll("input[type='checkbox']").forEach((box) => {
      box.checked = state.activeVibes.has(box.value);
    });
  });
}

/* ─── Filter badge ─── */
function updateFilterBadge() {
  if (!elements.filterToggle) return;
  let count = 0;
  if (getAreaValue()) count++;
  if (getCategoryValue()) count++;
  if (state.openNowOnly) count++;
  count += state.activeVibes.size;
  let badge = elements.filterToggle.querySelector(".filter-badge");
  if (count > 0) {
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "filter-badge";
      elements.filterToggle.appendChild(badge);
    }
    badge.textContent = count;
  } else if (badge) {
    badge.remove();
  }
}

/* ─── Get current filter values ─── */
function getSearchQuery() {
  const desktop = elements.searchInput ? elements.searchInput.value : "";
  const mobile = elements.searchInputMobile ? elements.searchInputMobile.value : "";
  return normalizeValue(desktop || mobile).toLowerCase();
}

function getAreaValue() {
  const d = elements.areaSelect ? elements.areaSelect.value : "";
  const m = elements.areaSelectMobile ? elements.areaSelectMobile.value : "";
  return normalizeValue(d || m);
}

function getCategoryValue() {
  const d = elements.categorySelect ? elements.categorySelect.value : "";
  const m = elements.categorySelectMobile ? elements.categorySelectMobile.value : "";
  return normalizeValue(d || m);
}

function getSortValue() {
  const d = elements.sortSelect ? elements.sortSelect.value : "";
  const m = elements.sortSelectMobile ? elements.sortSelectMobile.value : "";
  return d || m || "name";
}

/* ─── Filter + Sort ─── */
function applyFilters(keepRenderLimit) {
  const query = getSearchQuery();
  const area = getAreaValue();
  const category = getCategoryValue();
  const activeVibes = Array.from(state.activeVibes);

  state.filtered = state.all.filter((venue) => {
    if (state.showSavedOnly && !state.favorites.has(normalizeValue(venue.Name))) return false;
    if (state.openNowOnly) {
      const open = isVenueOpen(normalizeValue(venue["Typical Closing Time"]));
      if (open !== true) return false;
    }
    if (area && normalizeValue(venue.Area) !== area) return false;
    if (category && normalizeValue(venue.Category) !== category) return false;
    if (query) {
      const haystack = [venue.Name, venue.Address, venue.Category, venue["Vibe Tags"], venue.Area]
        .map((item) => normalizeValue(item).toLowerCase()).join(" ");
      if (!haystack.includes(query)) return false;
    }
    if (activeVibes.length) {
      const tags = normalizeValue(venue["Vibe Tags"]).split(",").map((t) => normalizeValue(t));
      if (!activeVibes.every((t) => tags.includes(t))) return false;
    }
    return true;
  });

  if (!keepRenderLimit) state.renderLimit = PAGE_SIZE;
  sortFiltered();
  renderGrid();
  updateLoadMore();
  updateStats();
  updateFilterBadge();
  updateResultSummary();
  saveFilterState();
  if (state.currentView === "map") renderMap();
  if (!keepRenderLimit && elements.grid) elements.grid.scrollIntoView({ behavior: "smooth", block: "start" });
}

function sortFiltered() {
  const sortBy = getSortValue();
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
  state.filtered.sort((a, b) => {
    if (sortBy === "distance") {
      const aVal = parseFloat(normalizeValue(a["Driving Distance"]).replace(/[^\d.]/g, "")) || Infinity;
      const bVal = parseFloat(normalizeValue(b["Driving Distance"]).replace(/[^\d.]/g, "")) || Infinity;
      return aVal - bVal;
    }
    if (sortBy === "closing") {
      const aVal = parseTimeToMinutes(a["Typical Closing Time"]);
      const bVal = parseTimeToMinutes(b["Typical Closing Time"]);
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;
      return aVal - bVal;
    }
    if (sortBy === "area") return collator.compare(a.Area, b.Area);
    if (sortBy === "category") return collator.compare(a.Category, b.Category);
    return collator.compare(a.Name, b.Name);
  });
}

/* ─── Render ─── */
function getPrimaryTag(tags) {
  return tags.length ? tags[0] : "general";
}

function getAttributeClasses(tags) {
  const classes = [];
  const tagSet = new Set(tags);
  const addIf = (tag, cls) => { if (tagSet.has(tag)) classes.push(cls); };
  addIf("upscale", "attr-upscale"); addIf("divey", "attr-divey");
  addIf("live-music", "attr-live-music"); addIf("dancey", "attr-dancey");
  addIf("sports", "attr-sports"); addIf("karaoke", "attr-karaoke");
  addIf("late-eats", "attr-late-eats"); addIf("rooftop", "attr-rooftop");
  addIf("views", "attr-views"); addIf("adult", "attr-adult");
  return classes.join(" ");
}

function updateResultSummary() {
  if (!elements.resultSummary) return;
  const total = state.filtered.length;
  const label = state.showSavedOnly ? "saved venue" : "venue";
  elements.resultSummary.textContent = `${total} ${label}${total !== 1 ? "s" : ""}`;
}

/* ─── Skeleton loading ─── */
function showSkeletons() {
  elements.grid.innerHTML = "";
  for (let i = 0; i < 12; i++) {
    const sk = document.createElement("div");
    sk.className = "skeleton-card";
    sk.innerHTML = `
      <div class="skeleton-poster"></div>
      <div class="skeleton-body">
        <div class="skeleton-line w80"></div>
        <div class="skeleton-line w60"></div>
        <div class="skeleton-line w40"></div>
      </div>
    `;
    elements.grid.appendChild(sk);
  }
}

function renderGrid() {
  elements.grid.innerHTML = "";
  if (!state.filtered.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    if (state.showSavedOnly) {
      empty.innerHTML = "No saved venues yet. Tap the ♡ on any venue card to save it.";
    } else {
      empty.innerHTML = "No venues match this filter set. Try removing the <strong>area</strong> or <strong>vibe</strong> filter.";
    }
    elements.grid.appendChild(empty);
    return;
  }
  const visibleVenues = state.filtered.slice(0, state.renderLimit);
  visibleVenues.forEach((venue, venueIdx) => {
    const mapLink = normalizeValue(venue["Google Maps Driving Link"]);
    const nameText = normalizeValue(venue.Name);
    const closingTime = normalizeValue(venue["Typical Closing Time"]);
    const tags = normalizeValue(venue["Vibe Tags"]).split(",")
      .map((t) => normalizeValue(t).toLowerCase()).filter(Boolean);
    const primaryTag = getPrimaryTag(tags);
    const posterClass = `poster-general poster-${primaryTag.replace(/[^a-z0-9-]/g, "") || "general"}`;
    const attributeClasses = getAttributeClasses(tags);
    const isFav = state.favorites.has(nameText);
    const openPill = getOpenStatusPill(closingTime);

    const card = document.createElement("div");
    card.className = `venue-card ${attributeClasses}`;
    card.innerHTML = `
      <button class="venue-fav ${isFav ? "active" : ""}" aria-label="Save venue" data-name="${nameText.replace(/"/g, "&quot;")}">
        ${isFav ? "♥" : "♡"}
      </button>
      <div class="poster ${posterClass}"></div>
      <div class="venue-info">
        <div class="venue-name">${nameText}</div>
        <div class="venue-meta">${normalizeValue(venue.Area)} · ${normalizeValue(venue.Category)}</div>
        <div class="venue-pills">
          ${openPill}
          <span class="pill pill-closing">${closingTime || "Late"}</span>
          <span class="pill pill-distance">${normalizeValue(venue["Driving Distance"]) || "Distance TBD"}</span>
        </div>
        <div class="venue-vibes">${normalizeValue(venue["Vibe Tags"])}</div>
      </div>
    `;

    const favBtn = card.querySelector(".venue-fav");
    favBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFavorite(nameText);
      favBtn.classList.toggle("active", state.favorites.has(nameText));
      favBtn.textContent = state.favorites.has(nameText) ? "♥" : "♡";
      if (state.showSavedOnly) applyFilters();
    });

    card.addEventListener("click", (e) => {
      if (e.target.closest(".venue-fav")) return;
      openDetail(venue);
    });

    // Staggered entrance animation
    card.style.animationDelay = `${Math.min(venueIdx, 30) * 30}ms`;

    card.style.cursor = "pointer";
    elements.grid.appendChild(card);

    if (window.venuePhotos && window.venuePhotos.isEnabled()) {
      const posterEl = card.querySelector(".poster");
      window.venuePhotos.applyVenuePhoto(posterEl, nameText, normalizeValue(venue.Area));
    }
  });
}

function updateStats() {
  if (elements.venueCount) elements.venueCount.textContent = state.all.length;
  if (elements.filteredCount) elements.filteredCount.textContent = state.filtered.length;
  if (elements.activeVibes) elements.activeVibes.textContent = state.activeVibes.size;
}

/* ─── Autocomplete ─── */
let acHighlight = -1;

function buildAutocompleteIndex() {
  // Pre-build a flat list of searchable items: venues, areas, vibes
  const items = [];
  const seenAreas = new Set();
  const seenVibes = new Set();
  state.all.forEach((v) => {
    items.push({ name: normalizeValue(v.Name), meta: `${normalizeValue(v.Area)} · ${normalizeValue(v.Category)}`, type: "venue", venue: v });
    const area = normalizeValue(v.Area);
    if (area && !seenAreas.has(area)) { seenAreas.add(area); items.push({ name: area, meta: "", type: "area" }); }
    normalizeValue(v["Vibe Tags"]).split(",").map((t) => normalizeValue(t)).filter(Boolean).forEach((t) => {
      if (!seenVibes.has(t)) { seenVibes.add(t); items.push({ name: t, meta: "", type: "vibe" }); }
    });
  });
  return items;
}

function showAutocomplete(input, dropdown, query) {
  if (!dropdown || !query || query.length < 2) {
    if (dropdown) dropdown.classList.remove("open");
    return;
  }

  const items = buildAutocompleteIndex();
  const q = query.toLowerCase();
  const matches = items.filter((it) => it.name.toLowerCase().includes(q)).slice(0, 8);

  if (!matches.length) {
    dropdown.classList.remove("open");
    return;
  }

  dropdown.innerHTML = "";
  acHighlight = -1;
  matches.forEach((it, idx) => {
    const div = document.createElement("div");
    div.className = "ac-item";
    div.innerHTML = `
      <span><span class="ac-name">${it.name}</span>${it.meta ? ` <span class="ac-meta">${it.meta}</span>` : ""}</span>
      <span class="ac-type">${it.type}</span>
    `;
    div.addEventListener("mousedown", (e) => {
      e.preventDefault();
      if (it.type === "venue") {
        input.value = it.name;
        if (elements.searchInput) elements.searchInput.value = it.name;
        if (elements.searchInputMobile) elements.searchInputMobile.value = it.name;
        applyFilters();
        openDetail(it.venue);
      } else if (it.type === "area") {
        // Set area filter
        [elements.areaSelect, elements.areaSelectMobile].forEach((sel) => { if (sel) sel.value = it.name; });
        input.value = "";
        if (elements.searchInput) elements.searchInput.value = "";
        if (elements.searchInputMobile) elements.searchInputMobile.value = "";
        applyFilters();
      } else if (it.type === "vibe") {
        state.activeVibes.add(it.name);
        syncVibeCheckboxes();
        input.value = "";
        if (elements.searchInput) elements.searchInput.value = "";
        if (elements.searchInputMobile) elements.searchInputMobile.value = "";
        applyFilters();
      }
      dropdown.classList.remove("open");
    });
    dropdown.appendChild(div);
  });
  dropdown.classList.add("open");
}

function setupAutocomplete(input, dropdown) {
  if (!input || !dropdown) return;
  input.addEventListener("input", () => {
    showAutocomplete(input, dropdown, input.value);
  });
  input.addEventListener("focus", () => {
    if (input.value.length >= 2) showAutocomplete(input, dropdown, input.value);
  });
  input.addEventListener("blur", () => {
    setTimeout(() => dropdown.classList.remove("open"), 150);
  });
  input.addEventListener("keydown", (e) => {
    const items = dropdown.querySelectorAll(".ac-item");
    if (!items.length || !dropdown.classList.contains("open")) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      acHighlight = Math.min(acHighlight + 1, items.length - 1);
      items.forEach((it, i) => it.classList.toggle("highlighted", i === acHighlight));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      acHighlight = Math.max(acHighlight - 1, 0);
      items.forEach((it, i) => it.classList.toggle("highlighted", i === acHighlight));
    } else if (e.key === "Enter" && acHighlight >= 0) {
      e.preventDefault();
      items[acHighlight].dispatchEvent(new MouseEvent("mousedown"));
    } else if (e.key === "Escape") {
      dropdown.classList.remove("open");
    }
  });
}

setupAutocomplete(elements.searchInput, elements.autocompleteDesktop);
setupAutocomplete(elements.searchInputMobile, elements.autocompleteMobile);

/* ─── Vibe legend ─── */
const VIBE_COLORS = {
  "general": "#2bff86", "chill": "#4dd6ff", "dancey": "#ff7ad6",
  "high-energy": "#ff9f5b", "late-night": "#9f9bff", "date-friendly": "#ffd36e",
  "upscale": "#b9c7ff", "divey": "#8f8f8f", "rowdy": "#ff5b5b",
  "live-music": "#7afff4", "karaoke": "#ff7ad6", "sports": "#2bff86",
  "games": "#7afff4", "group-fun": "#ff9f5b", "food-focused": "#ffd36e",
  "late-eats": "#ffb86b", "rooftop": "#4dd6ff", "views": "#7afff4",
  "adult": "#5b5b5b", "playful": "#7afff4", "loud": "#ff5b5b",
  "casual": "#4dd6ff", "sweet": "#ffd36e", "drinks": "#6ea8ff",
  "social": "#ff9f5b", "group-friendly": "#5bff9f", "interactive": "#7afff4",
};

function buildVibeLegend() {
  if (!elements.vibeLegend) return;
  const vibes = Array.from(collectVibes(state.all)).sort();
  elements.vibeLegend.innerHTML = vibes.map((v) => {
    const key = v.toLowerCase().replace(/[^a-z0-9-]/g, "");
    const color = VIBE_COLORS[key] || "#2bff86";
    return `<div class="legend-item"><div class="legend-swatch" style="background:${color}"></div>${v}</div>`;
  }).join("");
}

if (elements.legendToggle) {
  elements.legendToggle.addEventListener("click", () => {
    if (!elements.vibeLegend) return;
    const visible = elements.vibeLegend.style.display !== "none";
    elements.vibeLegend.style.display = visible ? "none" : "grid";
  });
}

/* ─── View toggle (grid / map) ─── */
function setView(view) {
  state.currentView = view;
  if (elements.viewToggle) {
    elements.viewToggle.querySelectorAll("button").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === view);
    });
  }
  if (view === "grid") {
    elements.grid.style.display = "";
    elements.mapContainer.style.display = "none";
  } else {
    elements.grid.style.display = "none";
    elements.mapContainer.style.display = "block";
    renderMap();
  }
  saveFilterState();
}

if (elements.viewToggle) {
  elements.viewToggle.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-view]");
    if (btn) setView(btn.dataset.view);
  });
}

/* ─── Map rendering (Leaflet) ─── */
let leafletMap = null;
let mapMarkers = [];

const NEIGHBORHOOD_COORDS = {
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
  "Rainier Valley": [47.5430, -122.2870], "Skyway": [47.4910, -122.2870],
  "Shoreline": [47.7557, -122.3420], "Lake City": [47.7110, -122.2900],
  "Northgate": [47.7069, -122.3278], "Burien": [47.4710, -122.3470],
  "Renton": [47.4829, -122.2170], "Tukwila": [47.4740, -122.2850],
  "Kent": [47.3809, -122.2348], "Auburn": [47.3073, -122.2285],
  "Everett": [47.9790, -122.2021], "Bellevue": [47.6101, -122.2015],
  "Kirkland": [47.6769, -122.2060], "Redmond": [47.6740, -122.1215],
  "Issaquah": [47.5301, -122.0326], "Eastside": [47.6200, -122.1800],
  "Pioneer Square": [47.6015, -122.3340], "Ravenna": [47.6774, -122.3020],
  "Phinney Ridge": [47.6740, -122.3540], "Roosevelt": [47.6780, -122.3180],
  "Maple Leaf": [47.6930, -122.3160], "Wedgwood": [47.6910, -122.2890],
  "Leschi": [47.6010, -122.2880], "Madison Park": [47.6340, -122.2750],
  "Montlake": [47.6380, -122.3010],
};

function getVenueCoords(venue) {
  const lat = parseFloat(venue.Latitude);
  const lng = parseFloat(venue.Longitude);
  if (!isNaN(lat) && !isNaN(lng)) return [lat, lng];
  const area = normalizeValue(venue.Area);
  for (const [name, coords] of Object.entries(NEIGHBORHOOD_COORDS)) {
    if (area.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(area.toLowerCase())) {
      const jitter = () => (Math.random() - 0.5) * 0.006;
      return [coords[0] + jitter(), coords[1] + jitter()];
    }
  }
  return null;
}

function renderMap() {
  if (!elements.mapContainer) return;
  if (typeof L === "undefined") {
    elements.mapContainer.innerHTML = '<div style="padding:40px;text-align:center;color:#93a1c6">Map library loading…</div>';
    return;
  }
  if (!leafletMap) {
    leafletMap = L.map(elements.mapContainer).setView([47.6062, -122.3321], 12);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(leafletMap);
  }
  mapMarkers.forEach((m) => leafletMap.removeLayer(m));
  mapMarkers = [];
  const bounds = [];
  state.filtered.forEach((venue) => {
    const coords = getVenueCoords(venue);
    if (!coords) return;
    const [lat, lng] = coords;
    const tags = normalizeValue(venue["Vibe Tags"]).split(",").map((t) => normalizeValue(t).toLowerCase()).filter(Boolean);
    const primaryTag = tags[0] || "general";
    const color = VIBE_COLORS[primaryTag] || "#2bff86";
    const marker = L.circleMarker([lat, lng], {
      radius: 7, fillColor: color, color: "#0b0d14", weight: 2, opacity: 1, fillOpacity: 0.85,
    }).addTo(leafletMap);
    const isFav = state.favorites.has(normalizeValue(venue.Name));
    marker.bindPopup(`<div><strong>${normalizeValue(venue.Name)}</strong> ${isFav ? "♥" : ""}<br><span style="color:#8fa0c2">${normalizeValue(venue.Area)} · ${normalizeValue(venue.Category)}</span><br><span style="color:#93a1c6">${normalizeValue(venue["Typical Closing Time"]) || "Late"}</span></div>`);
    marker.on("click", () => openDetail(venue));
    mapMarkers.push(marker);
    bounds.push([lat, lng]);
  });
  if (bounds.length) leafletMap.fitBounds(bounds, { padding: [30, 30] });
  setTimeout(() => leafletMap.invalidateSize(), 200);
}

/* ─── Init ─── */
function initFilters() {
  const areas = Array.from(new Set(state.all.map((v) => normalizeValue(v.Area)).filter(Boolean))).sort();
  const categories = Array.from(new Set(state.all.map((v) => normalizeValue(v.Category)).filter(Boolean))).sort();
  buildOptions(elements.areaSelect, areas);
  buildOptions(elements.categorySelect, categories);
  buildVibeChips(collectVibes(state.all), elements.vibeList);
  buildOptions(elements.areaSelectMobile, areas);
  buildOptions(elements.categorySelectMobile, categories);
  buildVibeChips(collectVibes(state.all), elements.vibeListMobile);
  buildVibeLegend();
}

function loadFromText(text) {
  state.all = loadDataFromCSV(text);
  initFilters();
  restoreFilterState();
  applyFilters();
  setStatus("Loaded " + state.all.length + " venues");
}

async function loadDefaultCSV() {
  showSkeletons();
  try {
    const response = await fetch(DEFAULT_CSV);
    if (!response.ok) throw new Error("Fetch failed");
    loadFromText(await response.text());
  } catch (err) {
    setStatus("Unable to load default CSV. Use Load CSV to import.");
    elements.grid.innerHTML = '<div class="empty-state">Unable to load venue data.</div>';
  }
}

/* ─── Event listeners (desktop) ─── */
function addListener(el, event, fn) { if (el) el.addEventListener(event, fn); }

addListener(elements.searchInput, "input", () => {
  if (elements.searchInputMobile) elements.searchInputMobile.value = elements.searchInput.value;
  applyFilters();
});
addListener(elements.areaSelect, "change", () => { syncSelect(elements.areaSelect, elements.areaSelectMobile); applyFilters(); });
addListener(elements.categorySelect, "change", () => { syncSelect(elements.categorySelect, elements.categorySelectMobile); applyFilters(); });
addListener(elements.sortSelect, "change", () => { syncSelect(elements.sortSelect, elements.sortSelectMobile); applyFilters(); });

/* ─── Event listeners (mobile) ─── */
addListener(elements.searchInputMobile, "input", () => {
  if (elements.searchInput) elements.searchInput.value = elements.searchInputMobile.value;
  applyFilters();
});
addListener(elements.areaSelectMobile, "change", () => { syncSelect(elements.areaSelectMobile, elements.areaSelect); applyFilters(); });
addListener(elements.categorySelectMobile, "change", () => { syncSelect(elements.categorySelectMobile, elements.categorySelect); applyFilters(); });
addListener(elements.sortSelectMobile, "change", () => { syncSelect(elements.sortSelectMobile, elements.sortSelect); applyFilters(); });

addListener(elements.csvFile, "change", (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => loadFromText(reader.result);
  reader.readAsText(file);
});

/* ─── Load More pagination ─── */
function updateLoadMore() {
  if (!elements.loadMoreWrap) return;
  const total = state.filtered.length;
  const showing = Math.min(state.renderLimit, total);
  if (showing < total) {
    elements.loadMoreWrap.style.display = "flex";
    const remaining = total - showing;
    elements.loadMoreCount.textContent = `Showing ${showing} of ${total} — ${remaining} more`;
  } else {
    elements.loadMoreWrap.style.display = "none";
  }
}

if (elements.loadMoreBtn) {
  elements.loadMoreBtn.addEventListener("click", () => {
    state.renderLimit += PAGE_SIZE;
    renderGrid();
    updateLoadMore();
  });
}

/* ─── Open Now toggle ─── */
function syncOpenNow() {
  if (elements.openNowDesktop) elements.openNowDesktop.checked = state.openNowOnly;
  if (elements.openNowMobile) elements.openNowMobile.checked = state.openNowOnly;
}

addListener(elements.openNowDesktop, "change", () => {
  state.openNowOnly = elements.openNowDesktop.checked;
  syncOpenNow();
  applyFilters();
});

addListener(elements.openNowMobile, "change", () => {
  state.openNowOnly = elements.openNowMobile.checked;
  syncOpenNow();
  applyFilters();
});

/* ─── Persist filter state to sessionStorage ─── */
function saveFilterState() {
  try {
    const data = {
      area: getAreaValue(),
      category: getCategoryValue(),
      sort: getSortValue(),
      search: getSearchQuery(),
      vibes: Array.from(state.activeVibes),
      view: state.currentView,
      openNow: state.openNowOnly,
    };
    sessionStorage.setItem("lnv_filters", JSON.stringify(data));
  } catch (_) {}
}

function restoreFilterState() {
  try {
    const raw = sessionStorage.getItem("lnv_filters");
    if (!raw) return false;
    const data = JSON.parse(raw);

    // Restore search
    if (data.search) {
      if (elements.searchInput) elements.searchInput.value = data.search;
      if (elements.searchInputMobile) elements.searchInputMobile.value = data.search;
    }

    // Restore area (must happen after initFilters populates options)
    if (data.area) {
      if (elements.areaSelect) elements.areaSelect.value = data.area;
      if (elements.areaSelectMobile) elements.areaSelectMobile.value = data.area;
    }

    // Restore category
    if (data.category) {
      if (elements.categorySelect) elements.categorySelect.value = data.category;
      if (elements.categorySelectMobile) elements.categorySelectMobile.value = data.category;
    }

    // Restore sort
    if (data.sort) {
      if (elements.sortSelect) elements.sortSelect.value = data.sort;
      if (elements.sortSelectMobile) elements.sortSelectMobile.value = data.sort;
    }

    // Restore vibes
    if (data.vibes && data.vibes.length) {
      state.activeVibes = new Set(data.vibes);
      syncVibeCheckboxes();
    }

    // Restore open now
    if (data.openNow) {
      state.openNowOnly = true;
      syncOpenNow();
    }

    // Restore view
    if (data.view && data.view !== "grid") {
      setView(data.view);
    }

    return true;
  } catch (_) {
    return false;
  }
}

/* ─── Highlight active nav for saved view ─── */
if (state.showSavedOnly) {
  document.querySelectorAll(".bottom-nav-item").forEach((a) => a.classList.remove("active"));
  const savedNav = $("savedNavItem");
  if (savedNav) savedNav.classList.add("active");
  const savedLink = $("savedLink");
  if (savedLink) savedLink.style.borderColor = "#2bff86";
}

/* ─── Swipe-to-dismiss detail drawer (mobile) ─── */
(function initSwipeToDismiss() {
  const drawer = elements.detailDrawer;
  const overlay = elements.detailOverlay;
  if (!drawer) return;

  let startY = 0;
  let currentY = 0;
  let isDragging = false;

  drawer.addEventListener("touchstart", (e) => {
    // Only start swipe from the handle / header area (top 60px)
    const touch = e.touches[0];
    const rect = drawer.getBoundingClientRect();
    if (touch.clientY - rect.top > 60) return;
    startY = touch.clientY;
    currentY = startY;
    isDragging = true;
    drawer.style.transition = "none";
  }, { passive: true });

  drawer.addEventListener("touchmove", (e) => {
    if (!isDragging) return;
    currentY = e.touches[0].clientY;
    const dy = Math.max(0, currentY - startY);
    drawer.style.transform = `translateY(${dy}px)`;
    if (overlay) overlay.style.opacity = Math.max(0, 1 - dy / 300);
  }, { passive: true });

  drawer.addEventListener("touchend", () => {
    if (!isDragging) return;
    isDragging = false;
    drawer.style.transition = "";
    if (overlay) overlay.style.opacity = "";
    const dy = currentY - startY;
    if (dy > 80) {
      closeDetail();
    } else {
      drawer.style.transform = "";
    }
  }, { passive: true });
})();

/* ─── Pull-to-refresh (mobile) ─── */
(function initPullToRefresh() {
  const indicator = $("ptrIndicator");
  if (!indicator) return;

  let startY = 0;
  let isPulling = false;

  const content = document.querySelector(".content") || document.querySelector(".layout");
  if (!content) return;

  content.addEventListener("touchstart", (e) => {
    // Only if scrolled to top
    if (window.scrollY > 10) return;
    startY = e.touches[0].clientY;
    isPulling = true;
  }, { passive: true });

  content.addEventListener("touchmove", (e) => {
    if (!isPulling) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 40 && dy < 150 && window.scrollY <= 0) {
      indicator.classList.add("pulling");
      indicator.innerHTML = "<span>Release to refresh</span>";
    } else {
      indicator.classList.remove("pulling");
    }
  }, { passive: true });

  content.addEventListener("touchend", () => {
    if (!isPulling) return;
    isPulling = false;
    if (indicator.classList.contains("pulling")) {
      indicator.classList.remove("pulling");
      indicator.classList.add("refreshing");
      indicator.innerHTML = '<div class="ptr-spinner"></div><span>Refreshing…</span>';
      // Re-render to update open/closed badges
      setTimeout(() => {
        applyFilters();
        indicator.classList.remove("refreshing");
        indicator.innerHTML = "<span>Pull to refresh</span>";
        showToast("Status badges updated");
      }, 600);
    }
  }, { passive: true });
})();

/* ─── Keyboard shortcut: / to focus search ─── */
document.addEventListener("keydown", (e) => {
  // Don't trigger if typing in an input, select, or textarea
  const tag = (e.target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable) return;
  if (e.key === "/") {
    e.preventDefault();
    const isMobile = window.innerWidth < 860;
    const input = isMobile ? elements.searchInputMobile : elements.searchInput;
    if (input) {
      input.focus();
      input.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }
  // Escape to close detail drawer
  if (e.key === "Escape") {
    if (elements.detailDrawer && elements.detailDrawer.classList.contains("open")) {
      closeDetail();
    }
  }
});

loadDefaultCSV();
