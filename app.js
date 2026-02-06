const DEFAULT_CSV = "venue_list_500plus.csv";

const state = {
  all: [],
  filtered: [],
  vibes: new Set(),
  activeVibes: new Set(),
};

const elements = {
  csvFile: document.getElementById("csvFile"),
  resetFilters: document.getElementById("resetFilters"),
  venueCount: document.getElementById("venueCount"),
  filteredCount: document.getElementById("filteredCount"),
  activeVibes: document.getElementById("activeVibes"),
  statusText: document.getElementById("statusText"),
  searchInput: document.getElementById("searchInput"),
  areaSelect: document.getElementById("areaSelect"),
  categorySelect: document.getElementById("categorySelect"),
  sortSelect: document.getElementById("sortSelect"),
  vibeList: document.getElementById("vibeList"),
  grid: document.getElementById("venueGrid"),
  venueSelect: document.getElementById("venueSelect"),
  maxDistanceInput: document.getElementById("maxDistanceInput"),
  resultCountInput: document.getElementById("resultCountInput"),
  recommendationList: document.getElementById("recommendationList"),
};

function setStatus(text) {
  elements.statusText.textContent = text;
}

function parseCSV(text) {
  const rows = [];
  let current = "";
  let inQuotes = false;
  const cells = [];

  function pushCell() {
    cells.push(current);
    current = "";
  }

  function pushRow() {
    rows.push(cells.splice(0));
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === "\"") {
      const next = text[i + 1];
      if (inQuotes && next === "\"") {
        current += "\"";
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      pushCell();
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[i + 1] === "\n") {
        i++;
      }
      pushCell();
      pushRow();
    } else {
      current += char;
    }
  }
  if (current.length > 0 || cells.length > 0) {
    pushCell();
    pushRow();
  }
  return rows;
}

function normalizeValue(value) {
  return (value || "").toString().trim();
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

function parseDistanceMiles(value) {
  const text = normalizeValue(value).toLowerCase();
  const match = text.match(/([\d.]+)\s*mi/);
  return match ? parseFloat(match[1]) : null;
}

function loadDataFromCSV(text) {
  const rows = parseCSV(text);
  if (!rows.length) return [];
  const headers = rows[0].map((h) => normalizeValue(h));
  const data = rows.slice(1).filter((row) => row.some((cell) => cell && cell.trim()));
  return data.map((row) => {
    const record = {};
    headers.forEach((header, idx) => {
      record[header] = normalizeValue(row[idx]);
    });
    return record;
  });
}

function collectVibes(venues) {
  const vibeSet = new Set();
  venues.forEach((venue) => {
    const tags = normalizeValue(venue["Vibe Tags"]).split(",");
    tags.map((tag) => normalizeValue(tag)).filter(Boolean).forEach((tag) => vibeSet.add(tag));
  });
  return vibeSet;
}

function getVibeSet(venue) {
  return new Set(
    normalizeValue(venue["Vibe Tags"])
      .split(",")
      .map((tag) => normalizeValue(tag).toLowerCase())
      .filter(Boolean)
  );
}

function buildOptions(select, values) {
  const current = select.value;
  select.innerHTML = "<option value=\"\">All</option>";
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
  select.value = current;
}

function buildVibeChips(vibes) {
  elements.vibeList.innerHTML = "";
  Array.from(vibes).sort().forEach((tag) => {
    const label = document.createElement("label");
    label.className = "vibe-chip";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = tag;
    input.addEventListener("change", () => {
      if (input.checked) {
        state.activeVibes.add(tag);
      } else {
        state.activeVibes.delete(tag);
      }
      applyFilters();
    });
    const span = document.createElement("span");
    span.textContent = tag;
    label.appendChild(input);
    label.appendChild(span);
    elements.vibeList.appendChild(label);
  });
}

function applyFilters() {
  const query = normalizeValue(elements.searchInput.value).toLowerCase();
  const area = normalizeValue(elements.areaSelect.value);
  const category = normalizeValue(elements.categorySelect.value);
  const activeVibes = Array.from(state.activeVibes);

  state.filtered = state.all.filter((venue) => {
    if (area && normalizeValue(venue.Area) !== area) return false;
    if (category && normalizeValue(venue.Category) !== category) return false;
    if (query) {
      const haystack = [
        venue.Name,
        venue.Address,
        venue.Category,
        venue["Vibe Tags"],
        venue.Area,
      ].map((item) => normalizeValue(item).toLowerCase()).join(" ");
      if (!haystack.includes(query)) return false;
    }
    if (activeVibes.length) {
      const tags = normalizeValue(venue["Vibe Tags"]).split(",").map((tag) => normalizeValue(tag));
      if (!activeVibes.every((tag) => tags.includes(tag))) return false;
    }
    return true;
  });

  sortFiltered();
  renderGrid();
  updateStats();
}

function sortFiltered() {
  const sortBy = elements.sortSelect.value;
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
    if (sortBy === "area") {
      return collator.compare(a.Area, b.Area);
    }
    if (sortBy === "category") {
      return collator.compare(a.Category, b.Category);
    }
    return collator.compare(a.Name, b.Name);
  });
}

function hashSeed(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function initialsFromName(name) {
  const parts = normalizeValue(name).split(" ").filter(Boolean);
  if (!parts.length) return "LN";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
    const posterIndex = hashSeed(venue.Name || "") % 6;
    const card = document.createElement("div");
    card.className = "venue-card";
    card.innerHTML = `
      <div class="poster poster-${posterIndex}">${initialsFromName(venue.Name)}</div>
      <div class="venue-info">
        <div class="venue-name">${normalizeValue(venue.Name)}</div>
        <div class="venue-meta">${normalizeValue(venue.Area)} • ${normalizeValue(venue.Category)}</div>
        <div class="venue-pills">
          <span class="pill">${normalizeValue(venue["Typical Closing Time"]) || "Late"}</span>
          <span class="pill">${normalizeValue(venue["Driving Distance"]) || "Distance TBD"}</span>
        </div>
        <div class="venue-vibes">${normalizeValue(venue["Vibe Tags"])}</div>
        <div class="venue-links">
          ${mapLink ? `<a href="${mapLink}" target="_blank" rel="noopener">Directions</a>` : "<span></span>"}
          <span class="venue-distance">${normalizeValue(venue.Address)}</span>
        </div>
      </div>
    `;
    elements.grid.appendChild(card);
  });
}

function buildVenueOptions() {
  const venues = state.all
    .map((venue) => normalizeValue(venue.Name))
    .filter(Boolean)
    .sort();
  const current = elements.venueSelect.value;
  elements.venueSelect.innerHTML = "<option value=\"\">Pick a venue</option>";
  venues.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    elements.venueSelect.appendChild(option);
  });
  elements.venueSelect.value = current;
}

function computeRecommendations(baseVenue, maxDistance, maxResults) {
  const baseDistance = parseDistanceMiles(baseVenue["Driving Distance"]);
  const baseVibes = getVibeSet(baseVenue);

  return state.all
    .filter((venue) => venue.Name && venue.Name !== baseVenue.Name)
    .map((venue) => {
      const distance = parseDistanceMiles(venue["Driving Distance"]);
      if (maxDistance !== null && distance !== null && distance > maxDistance) {
        return null;
      }
      const candidateVibes = getVibeSet(venue);
      const intersection = Array.from(candidateVibes).filter((tag) => baseVibes.has(tag));
      const union = new Set([...candidateVibes, ...baseVibes]);
      const vibeScore = union.size ? intersection.length / union.size : 0;

      const categoryScore =
        normalizeValue(venue.Category).toLowerCase() === normalizeValue(baseVenue.Category).toLowerCase()
          ? 1
          : 0;
      const areaScore =
        normalizeValue(venue.Area).toLowerCase() === normalizeValue(baseVenue.Area).toLowerCase()
          ? 1
          : 0;

      let distanceScore = 0.4;
      if (distance !== null && baseDistance !== null && maxDistance) {
        const diff = Math.abs(distance - baseDistance);
        distanceScore = 1 - Math.min(diff / maxDistance, 1);
      }

      const score = vibeScore * 0.5 + categoryScore * 0.2 + areaScore * 0.2 + distanceScore * 0.1;
      const reason = [
        intersection.length ? `${intersection.length} shared vibes` : "new vibe twist",
        categoryScore ? "same category" : "different category",
        areaScore ? "same area" : "nearby area",
      ].join(" • ");

      return {
        venue,
        score,
        reason,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}

function renderRecommendations() {
  const selectedName = normalizeValue(elements.venueSelect.value);
  elements.recommendationList.innerHTML = "";
  if (!selectedName) {
    const message = document.createElement("div");
    message.className = "empty-state";
    message.textContent = "Pick a venue to see similar nearby spots.";
    elements.recommendationList.appendChild(message);
    return;
  }
  const baseVenue = state.all.find((venue) => normalizeValue(venue.Name) === selectedName);
  if (!baseVenue) return;
  const maxDistance = parseFloat(elements.maxDistanceInput.value);
  const results = Math.min(parseInt(elements.resultCountInput.value, 10) || 8, 20);
  const recs = computeRecommendations(baseVenue, Number.isFinite(maxDistance) ? maxDistance : null, results);

  if (!recs.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No nearby matches. Try a wider distance.";
    elements.recommendationList.appendChild(empty);
    return;
  }

  recs.forEach(({ venue, reason }) => {
    const card = document.createElement("div");
    card.className = "recommendation-card";
    const mapLink = normalizeValue(venue["Google Maps Driving Link"]);
    card.innerHTML = `
      <div class="name">${normalizeValue(venue.Name)}</div>
      <div class="meta">${normalizeValue(venue.Area)} • ${normalizeValue(venue.Category)}</div>
      <div class="reason">${reason}</div>
      ${mapLink ? `<a href="${mapLink}" target="_blank" rel="noopener">Directions</a>` : ""}
    `;
    elements.recommendationList.appendChild(card);
  });
}

function updateStats() {
  elements.venueCount.textContent = state.all.length.toString();
  elements.filteredCount.textContent = state.filtered.length.toString();
  elements.activeVibes.textContent = state.activeVibes.size.toString();
}

function resetFilters() {
  elements.searchInput.value = "";
  elements.areaSelect.value = "";
  elements.categorySelect.value = "";
  elements.sortSelect.value = "name";
  state.activeVibes.clear();
  elements.vibeList.querySelectorAll("input[type='checkbox']").forEach((box) => {
    box.checked = false;
  });
  applyFilters();
}

function initFilters() {
  const areas = Array.from(new Set(state.all.map((v) => normalizeValue(v.Area)).filter(Boolean))).sort();
  const categories = Array.from(new Set(state.all.map((v) => normalizeValue(v.Category)).filter(Boolean))).sort();
  buildOptions(elements.areaSelect, areas);
  buildOptions(elements.categorySelect, categories);
  state.vibes = collectVibes(state.all);
  buildVibeChips(state.vibes);
  buildVenueOptions();
  renderRecommendations();
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
    const text = await response.text();
    loadFromText(text);
  } catch (err) {
    setStatus("Unable to load default CSV. Use Load CSV to import.");
  }
}

elements.searchInput.addEventListener("input", applyFilters);
elements.areaSelect.addEventListener("change", applyFilters);
elements.categorySelect.addEventListener("change", applyFilters);
elements.sortSelect.addEventListener("change", applyFilters);
elements.resetFilters.addEventListener("click", resetFilters);
elements.venueSelect.addEventListener("change", renderRecommendations);
elements.maxDistanceInput.addEventListener("input", renderRecommendations);
elements.resultCountInput.addEventListener("input", renderRecommendations);
elements.csvFile.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => loadFromText(reader.result);
  reader.readAsText(file);
});

loadDefaultCSV();
