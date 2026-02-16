const DEFAULT_CSV = "venue_list_500plus.csv";
let allVenues = [];

const $ = (id) => document.getElementById(id);

/* ─── Import shared helpers from LNVCore (loaded via lib/core.js) ─── */
const { normalizeValue, loadDataFromCSV, parseTimeToMinutes, minutesToLabel } = window.LNVCore;

/* ─── Analyze a neighborhood ─── */
function analyzeArea(areaName) {
  const venues = allVenues.filter((v) => normalizeValue(v.Area) === areaName);
  if (!venues.length) return null;

  // Count categories
  const catCount = {};
  venues.forEach((v) => {
    const cat = normalizeValue(v.Category);
    if (cat) catCount[cat] = (catCount[cat] || 0) + 1;
  });
  const topCategories = Object.entries(catCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Count vibes
  const vibeCount = {};
  venues.forEach((v) => {
    normalizeValue(v["Vibe Tags"]).split(",").map((t) => normalizeValue(t)).filter(Boolean).forEach((t) => {
      vibeCount[t] = (vibeCount[t] || 0) + 1;
    });
  });
  const topVibes = Object.entries(vibeCount).sort((a, b) => b[1] - a[1]).slice(0, 8);

  // Closing time range
  const closingTimes = venues.map((v) => parseTimeToMinutes(v["Typical Closing Time"])).filter((m) => m !== null);
  // Adjust for after-midnight times
  const adjusted = closingTimes.map((m) => m <= 360 ? m + 1440 : m);
  const latestClose = adjusted.length ? Math.max(...adjusted) : null;
  const earliestClose = adjusted.length ? Math.min(...adjusted) : null;

  // Distance range
  const distances = venues.map((v) => {
    const match = normalizeValue(v["Driving Distance"]).match(/([\d.]+)\s*mi/);
    return match ? parseFloat(match[1]) : null;
  }).filter((d) => d !== null);
  const avgDistance = distances.length ? (distances.reduce((a, b) => a + b, 0) / distances.length).toFixed(1) : null;

  const bestFor = (window.LNVFeatures && window.LNVFeatures.getBestForVerdict) ? window.LNVFeatures.getBestForVerdict(topVibes, topCategories) : "varied vibes";

  let openNowCount = 0;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowAdj = nowMin < 540 ? nowMin + 1440 : nowMin;
  venues.forEach(function (v) {
    const m = parseTimeToMinutes(v["Typical Closing Time"]);
    if (m !== null) {
      const closeAdj = m <= 360 ? m + 1440 : m;
      if (nowAdj >= 21 * 60 && nowAdj < closeAdj) openNowCount++;
    }
  });

  return {
    name: areaName,
    total: venues.length,
    topCategories,
    topVibes,
    latestClose: latestClose !== null ? minutesToLabel(latestClose) : "Unknown",
    earliestClose: earliestClose !== null ? minutesToLabel(earliestClose) : "Unknown",
    avgDistance: avgDistance ? `${avgDistance} mi` : "N/A",
    categoryCount: Object.keys(catCount).length,
    bestFor,
    openNowCount,
  };
}

/* ─── Render ─── */
function renderComparison() {
  const area1 = $("area1").value;
  const area2 = $("area2").value;
  const area3 = $("area3").value;
  const grid = $("comparisonGrid");
  grid.innerHTML = "";

  const areas = [area1, area2, area3].filter(Boolean);
  if (areas.length < 2) {
    grid.innerHTML = '<div class="compare-empty">Pick at least 2 neighborhoods above to compare them side by side.</div>';
    return;
  }

  areas.forEach((areaName) => {
    const data = analyzeArea(areaName);
    if (!data) return;

    const card = document.createElement("div");
    card.className = "hood-card";
    card.innerHTML = `
      <div class="hood-header">
        <div class="hood-name">${data.name}</div>
        <div class="hood-subtitle">${data.total} venue${data.total !== 1 ? "s" : ""} · ${data.categoryCount} categories</div>
        <div class="hood-best-for">Best for: ${data.bestFor || "varied vibes"}</div>
        ${data.openNowCount !== undefined ? `<div class="hood-open-now">${data.openNowCount} open right now</div>` : ""}
      </div>
      <div class="hood-stats">
        <div class="hood-stat">
          <div class="hood-stat-label">Venues</div>
          <div class="hood-stat-value highlight">${data.total}</div>
        </div>
        <div class="hood-stat">
          <div class="hood-stat-label">Avg Distance</div>
          <div class="hood-stat-value">${data.avgDistance}</div>
        </div>
        <div class="hood-stat">
          <div class="hood-stat-label">Latest Close</div>
          <div class="hood-stat-value">${data.latestClose}</div>
        </div>
        <div class="hood-stat">
          <div class="hood-stat-label">Earliest Close</div>
          <div class="hood-stat-value">${data.earliestClose}</div>
        </div>
      </div>
      <div class="hood-vibes">
        <div class="hood-vibes-title">Top Vibes</div>
        <div class="hood-vibes-list">
          ${data.topVibes.map(([v, c]) => `<span class="pill">${v} (${c})</span>`).join("")}
        </div>
      </div>
      <div class="hood-categories">
        ${data.topCategories.map(([cat, count]) => `<div class="hood-cat-item"><span>${cat}</span><span class="hood-cat-count">${count}</span></div>`).join("")}
      </div>
      <a href="index.html" class="hood-action" onclick="localStorage.setItem('lnv_jumpArea','${data.name}')">Browse ${data.name} venues →</a>
      <a href="planner.html?area=${encodeURIComponent(data.name)}" class="hood-action hood-action-plan">Build a night in ${data.name} →</a>
    `;
    grid.appendChild(card);
  });
}

/* ─── Init ─── */
function buildAreaOptions() {
  const areas = Array.from(new Set(allVenues.map((v) => normalizeValue(v.Area)).filter(Boolean))).sort();
  [$("area1"), $("area2"), $("area3")].forEach((select, idx) => {
    if (!select) return;
    const placeholder = idx < 2 ? `Pick area ${idx + 1}` : "(optional) Area 3";
    select.innerHTML = `<option value="">${placeholder}</option>`;
    areas.forEach((a) => {
      const opt = document.createElement("option");
      opt.value = a;
      opt.textContent = `${a} (${allVenues.filter((v) => normalizeValue(v.Area) === a).length})`;
      select.appendChild(opt);
    });
  });
}

function loadFromText(text) {
  allVenues = loadDataFromCSV(text);
  buildAreaOptions();
  renderComparison();
}

async function loadDefaultCSV() {
  try {
    const resp = await fetch(DEFAULT_CSV);
    if (!resp.ok) throw new Error("Fetch failed");
    loadFromText(await resp.text());
  } catch (err) {
    $("comparisonGrid").innerHTML = '<div class="compare-empty">Unable to load venue data.</div>';
  }
}

[$("area1"), $("area2"), $("area3")].forEach((sel) => {
  if (sel) sel.addEventListener("change", renderComparison);
});

loadDefaultCSV();
