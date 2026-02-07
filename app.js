const DEFAULT_CSV = "venue_list_500plus.csv";

const state = {
  all: [],
  filtered: [],
  vibes: new Set(),
  activeVibes: new Set(),
};

/* ─── Element refs ─── */
const $ = (id) => document.getElementById(id);

const elements = {
  csvFile: $("csvFile"),
  venueCount: $("venueCount"),
  filteredCount: $("filteredCount"),
  activeVibes: $("activeVibes"),
  statusText: $("statusText"),
  grid: $("venueGrid"),
  // Desktop
  searchInput: $("searchInput"),
  areaSelect: $("areaSelectDesktop"),
  categorySelect: $("categorySelectDesktop"),
  sortSelect: $("sortSelectDesktop"),
  vibeList: $("vibeListDesktop"),
  // Mobile drawer
  searchInputMobile: $("searchInputMobile"),
  areaSelectMobile: $("areaSelect"),
  categorySelectMobile: $("categorySelect"),
  sortSelectMobile: $("sortSelect"),
  vibeListMobile: $("vibeList"),
  // Drawer
  filterToggle: $("filterToggle"),
  filterOverlay: $("filterOverlay"),
  filterDrawer: $("filterDrawer"),
  filterClose: $("filterClose"),
};

/* ─── Drawer toggle ─── */
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

/* ─── Get current filter values (prefer whichever was last changed) ─── */
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
function applyFilters() {
  const query = getSearchQuery();
  const area = getAreaValue();
  const category = getCategoryValue();
  const activeVibes = Array.from(state.activeVibes);

  state.filtered = state.all.filter((venue) => {
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

  sortFiltered();
  renderGrid();
  updateStats();
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
  addIf("upscale", "attr-upscale");
  addIf("divey", "attr-divey");
  addIf("live-music", "attr-live-music");
  addIf("dancey", "attr-dancey");
  addIf("sports", "attr-sports");
  addIf("karaoke", "attr-karaoke");
  addIf("late-eats", "attr-late-eats");
  addIf("rooftop", "attr-rooftop");
  addIf("views", "attr-views");
  addIf("adult", "attr-adult");
  return classes.join(" ");
}

function renderGrid() {
  elements.grid.innerHTML = "";
  if (!state.filtered.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No venues match this filter set.";
    elements.grid.appendChild(empty);
    return;
  }
  state.filtered.forEach((venue) => {
    const mapLink = normalizeValue(venue["Google Maps Driving Link"]);
    const nameText = normalizeValue(venue.Name);
    const addressText = normalizeValue(venue.Address);
    const tags = normalizeValue(venue["Vibe Tags"]).split(",")
      .map((t) => normalizeValue(t).toLowerCase()).filter(Boolean);
    const primaryTag = getPrimaryTag(tags);
    const posterClass = `poster-general poster-${primaryTag.replace(/[^a-z0-9-]/g, "") || "general"}`;
    const attributeClasses = getAttributeClasses(tags);
    const card = document.createElement("div");
    card.className = `venue-card ${attributeClasses}`;
    card.innerHTML = `
      <div class="poster ${posterClass}"></div>
      <div class="venue-info">
        <div class="venue-name">
          ${mapLink ? `<a href="${mapLink}" target="_blank" rel="noopener">${nameText}</a>` : nameText}
        </div>
        <div class="venue-meta">${normalizeValue(venue.Area)} · ${normalizeValue(venue.Category)}</div>
        <div class="venue-pills">
          <span class="pill pill-closing">${normalizeValue(venue["Typical Closing Time"]) || "Late"}</span>
          <span class="pill pill-distance">${normalizeValue(venue["Driving Distance"]) || "Distance TBD"}</span>
        </div>
        <div class="venue-vibes">${normalizeValue(venue["Vibe Tags"])}</div>
        <div class="venue-links">
          ${mapLink ? `<a href="${mapLink}" target="_blank" rel="noopener">Directions</a>` : "<span></span>"}
          ${addressText && addressText.toLowerCase() !== "click link"
            ? (mapLink
                ? `<a class="venue-distance" href="${mapLink}" target="_blank" rel="noopener">${addressText}</a>`
                : `<span class="venue-distance">${addressText}</span>`)
            : `<span class="venue-distance"></span>`}
        </div>
      </div>
    `;
    elements.grid.appendChild(card);
  });
}

function updateStats() {
  if (elements.venueCount) elements.venueCount.textContent = state.all.length;
  if (elements.filteredCount) elements.filteredCount.textContent = state.filtered.length;
  if (elements.activeVibes) elements.activeVibes.textContent = state.activeVibes.size;
}

/* ─── Init ─── */
function initFilters() {
  const areas = Array.from(new Set(state.all.map((v) => normalizeValue(v.Area)).filter(Boolean))).sort();
  const categories = Array.from(new Set(state.all.map((v) => normalizeValue(v.Category)).filter(Boolean))).sort();
  // Desktop
  buildOptions(elements.areaSelect, areas);
  buildOptions(elements.categorySelect, categories);
  buildVibeChips(collectVibes(state.all), elements.vibeList);
  // Mobile drawer
  buildOptions(elements.areaSelectMobile, areas);
  buildOptions(elements.categorySelectMobile, categories);
  buildVibeChips(collectVibes(state.all), elements.vibeListMobile);
}

function loadFromText(text) {
  state.all = loadDataFromCSV(text);
  initFilters();
  applyFilters();
  setStatus("Loaded " + state.all.length + " venues");
}

async function loadDefaultCSV() {
  try {
    const response = await fetch(DEFAULT_CSV);
    if (!response.ok) throw new Error("Fetch failed");
    loadFromText(await response.text());
  } catch (err) {
    setStatus("Unable to load default CSV. Use Load CSV to import.");
  }
}

/* ─── Event listeners (desktop) ─── */
function addListener(el, event, fn) { if (el) el.addEventListener(event, fn); }

addListener(elements.searchInput, "input", () => {
  if (elements.searchInputMobile) elements.searchInputMobile.value = elements.searchInput.value;
  applyFilters();
});
addListener(elements.areaSelect, "change", () => {
  syncSelect(elements.areaSelect, elements.areaSelectMobile);
  applyFilters();
});
addListener(elements.categorySelect, "change", () => {
  syncSelect(elements.categorySelect, elements.categorySelectMobile);
  applyFilters();
});
addListener(elements.sortSelect, "change", () => {
  syncSelect(elements.sortSelect, elements.sortSelectMobile);
  applyFilters();
});

/* ─── Event listeners (mobile) ─── */
addListener(elements.searchInputMobile, "input", () => {
  if (elements.searchInput) elements.searchInput.value = elements.searchInputMobile.value;
  applyFilters();
});
addListener(elements.areaSelectMobile, "change", () => {
  syncSelect(elements.areaSelectMobile, elements.areaSelect);
  applyFilters();
});
addListener(elements.categorySelectMobile, "change", () => {
  syncSelect(elements.categorySelectMobile, elements.categorySelect);
  applyFilters();
});
addListener(elements.sortSelectMobile, "change", () => {
  syncSelect(elements.sortSelectMobile, elements.sortSelect);
  applyFilters();
});

addListener(elements.csvFile, "change", (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => loadFromText(reader.result);
  reader.readAsText(file);
});

loadDefaultCSV();
