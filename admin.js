const DEFAULT_CSV = "venue_list_500plus.csv";

/* ─── Import shared helpers from LNVCore (loaded via lib/core.js) ─── */
const { normalizeValue, loadDataFromCSV } = window.LNVCore;

function countByField(venues, field) {
  const counts = {};
  venues.forEach((venue) => {
    const value = normalizeValue(venue[field]);
    if (value) counts[value] = (counts[value] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

function countByVibes(venues) {
  const counts = {};
  venues.forEach((venue) => {
    normalizeValue(venue["Vibe Tags"])
      .split(",")
      .map((t) => normalizeValue(t).toLowerCase())
      .filter(Boolean)
      .forEach((tag) => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

function renderBreakdown(containerId, entries) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  entries.forEach(([label, count]) => {
    const item = document.createElement("div");
    item.className = "breakdown-item";
    item.innerHTML = `<span class="label">${label}</span><span class="count">${count}</span>`;
    container.appendChild(item);
  });
}

function renderAdmin(venues) {
  document.getElementById("venueCount").textContent = venues.length;
  const areas = countByField(venues, "Area");
  const categories = countByField(venues, "Category");
  const vibes = countByVibes(venues);
  document.getElementById("areaCount").textContent = areas.length;
  document.getElementById("categoryCount").textContent = categories.length;
  document.getElementById("vibeCount").textContent = vibes.length;
  renderBreakdown("areaBreakdown", areas);
  renderBreakdown("categoryBreakdown", categories);
  renderBreakdown("vibeBreakdown", vibes);
  document.getElementById("statusText").textContent = "Loaded " + venues.length + " venues";
}

function loadFromText(text) {
  const venues = loadDataFromCSV(text);
  renderAdmin(venues);
}

async function loadDefaultCSV() {
  try {
    const response = await fetch(DEFAULT_CSV);
    if (!response.ok) throw new Error("Fetch failed");
    const text = await response.text();
    loadFromText(text);
  } catch (err) {
    document.getElementById("statusText").textContent =
      "Unable to load default CSV. Use Import to upload.";
  }
}

document.getElementById("csvFile").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => loadFromText(reader.result);
  reader.readAsText(file);
});

const resetBtn = document.getElementById("resetFilters");
if (resetBtn) {
  resetBtn.addEventListener("click", () => {
    loadDefaultCSV();
  });
}

loadDefaultCSV();
