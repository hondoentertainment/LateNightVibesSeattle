const DEFAULT_CSV = (window.LNVCities && window.LNVCities.getCurrentCity().csv) || "data/seattle.csv";
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
    const limitedTag = data.total < 3 ? ' <span class="lnv-limited-data" style="font-size:11px;color:#ffd36e;font-weight:500;opacity:0.85;">(limited data)</span>' : "";
    card.innerHTML = `
      <div class="hood-header">
        <div class="hood-name">${data.name}${limitedTag}</div>
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
      <div class="hood-chart">
        <div class="hood-chart-title">Top Vibes</div>
        ${(function () {
          const maxVibe = data.topVibes.length ? data.topVibes[0][1] : 1;
          const VIBE_COLORS = {
            "chill": "#4dd6ff", "dancey": "#ff7ad6", "high-energy": "#ff9f5b",
            "date-friendly": "#ffd36e", "upscale": "#b9c7ff", "divey": "#8f8f8f",
            "live-music": "#7afff4", "karaoke": "#ff7ad6", "sports": "#2bff86",
            "late-eats": "#ffb86b", "casual": "#4dd6ff", "social": "#ff9f5b",
            "group-friendly": "#5bff9f", "rowdy": "#ff5b5b", "games": "#7afff4",
            "views": "#7afff4", "rooftop": "#4dd6ff", "food-focused": "#ffd36e",
          };
          return data.topVibes.slice(0, 6).map(([v, c]) => {
            const pct = Math.round((c / maxVibe) * 100);
            const color = VIBE_COLORS[v.toLowerCase()] || "#2bff86";
            return '<div class="hood-bar-row"><span class="hood-bar-label">' + v + '</span><div class="hood-bar-track"><div class="hood-bar-fill" style="width:' + pct + '%;background:' + color + '"></div></div><span class="hood-bar-count">' + c + '</span></div>';
          }).join("");
        })()}
      </div>
      <div class="hood-chart">
        <div class="hood-chart-title">Categories</div>
        ${(function () {
          const maxCat = data.topCategories.length ? data.topCategories[0][1] : 1;
          return data.topCategories.map(([cat, count]) => {
            const pct = Math.round((count / maxCat) * 100);
            return '<div class="hood-bar-row"><span class="hood-bar-label">' + cat + '</span><div class="hood-bar-track"><div class="hood-bar-fill" style="width:' + pct + '%;background:#2bff86"></div></div><span class="hood-bar-count">' + count + '</span></div>';
          }).join("");
        })()}
      </div>
      <button type="button" class="hood-action hood-expand-btn" aria-expanded="false">Show venues ▾</button>
      <div class="hood-venue-list"></div>
      <a href="index.html" class="hood-action" onclick="localStorage.setItem('lnv_jumpArea','${data.name}')">Browse ${data.name} venues →</a>
      <a href="planner.html?area=${encodeURIComponent(data.name)}" class="hood-action hood-action-plan">Build a night in ${data.name} →</a>
    `;

    // Expandable venue list
    const expandBtn = card.querySelector(".hood-expand-btn");
    const venueListEl = card.querySelector(".hood-venue-list");
    expandBtn.addEventListener("click", () => {
      const isOpen = expandBtn.getAttribute("aria-expanded") === "true";
      if (isOpen) {
        venueListEl.classList.remove("expanded");
        expandBtn.setAttribute("aria-expanded", "false");
        expandBtn.textContent = "Show venues ▾";
      } else {
        if (!venueListEl.children.length) {
          const venues = allVenues.filter((v) => normalizeValue(v.Area) === data.name);
          // Add filter input for large lists
          if (venues.length > 10) {
            const filterInput = document.createElement("input");
            filterInput.type = "search";
            filterInput.className = "hood-venue-filter";
            filterInput.placeholder = "Filter venues…";
            filterInput.setAttribute("aria-label", "Filter venues in " + data.name);
            filterInput.addEventListener("input", () => {
              const q = filterInput.value.toLowerCase().trim();
              venueListEl.querySelectorAll(".hood-venue-item").forEach((item) => {
                item.style.display = !q || item.textContent.toLowerCase().includes(q) ? "" : "none";
              });
            });
            venueListEl.appendChild(filterInput);
          }
          venues.forEach((v) => {
            const name = normalizeValue(v.Name);
            const cat = normalizeValue(v.Category);
            const closing = normalizeValue(v["Typical Closing Time"]) || "Late";
            const mapLink = normalizeValue(v["Google Maps Driving Link"]);
            const item = document.createElement("div");
            item.className = "hood-venue-item";
            item.innerHTML = '<div class="hood-venue-name">' + (mapLink ? '<a href="' + mapLink + '" target="_blank" rel="noopener">' + name + '</a>' : name) + '</div>' +
              '<div class="hood-venue-meta">' + cat + ' · ' + closing + '</div>';
            venueListEl.appendChild(item);
          });
        }
        venueListEl.classList.add("expanded");
        expandBtn.setAttribute("aria-expanded", "true");
        expandBtn.textContent = "Hide venues ▴";
      }
    });

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

function showDataThresholdBanner() {
  const existing = document.querySelector(".lnv-data-threshold-banner");
  if (existing) existing.remove();
  if (allVenues.length >= 30) return;
  const cityObj = (window.LNVCities && window.LNVCities.getCurrentCity) ? window.LNVCities.getCurrentCity() : null;
  const cityName = cityObj ? cityObj.name : "this city";
  const banner = document.createElement("div");
  banner.className = "lnv-data-threshold-banner";
  banner.setAttribute("role", "status");
  banner.innerHTML = '<span class="lnv-banner-icon">i</span> We\'re still building out ' + cityName + '\'s venue data. Some features may be limited.';
  banner.style.cssText = "background:rgba(43,255,134,0.08);border:1px solid rgba(43,255,134,0.25);color:#c8ffd8;padding:10px 16px;border-radius:10px;font-size:13px;margin:0 0 16px;display:flex;align-items:center;gap:8px;";
  const iconEl = banner.querySelector(".lnv-banner-icon");
  if (iconEl) iconEl.style.cssText = "display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:rgba(43,255,134,0.18);color:#2bff86;font-size:12px;font-weight:700;flex-shrink:0;";
  const grid = $("comparisonGrid");
  if (grid && grid.parentNode) grid.parentNode.insertBefore(banner, grid);
}

function loadFromText(text) {
  allVenues = loadDataFromCSV(text);
  buildAreaOptions();
  showDataThresholdBanner();

  const area1 = $("area1");
  const area2 = $("area2");
  const hasSelection = area1?.value || area2?.value || $("area3")?.value;
  if (!hasSelection && area1 && area2) {
    const areas = [...new Set(allVenues.map((v) => normalizeValue(v.Area)).filter(Boolean))].sort();
    const capHill = areas.find((a) => /capitol\s*hill/i.test(a));
    const ballard = areas.find((a) => /^ballard$/i.test(a));
    if (capHill && ballard) {
      area1.value = capHill;
      area2.value = ballard;
    }
  }
  renderComparison();
}

function renderLoadError(grid, retry) {
  if (!grid) return;
  grid.innerHTML = `
    <div class="compare-empty error-state" role="alert">
      <div class="error-state-icon" style="font-size:32px;margin-bottom:12px" aria-hidden="true">⚠️</div>
      <h3 class="error-state-title">Unable to load venue data</h3>
      <p class="error-state-desc">Check your connection and try again.</p>
      ${retry ? '<button type="button" class="btn-primary error-retry-btn" onclick="loadDefaultCSV()">Try again</button>' : ""}
    </div>
  `;
}

async function loadDefaultCSV() {
  const grid = $("comparisonGrid");
  if (grid) {
    let skeletonHtml = "";
    for (let i = 0; i < 2; i++) {
      skeletonHtml += `
        <div class="hood-skeleton-card">
          <div class="hood-skeleton-header">
            <div class="hood-skeleton-line hood-skeleton-w60"></div>
            <div class="hood-skeleton-line hood-skeleton-w40"></div>
          </div>
          <div class="hood-skeleton-stats">
            <div class="hood-skeleton-stat"></div>
            <div class="hood-skeleton-stat"></div>
            <div class="hood-skeleton-stat"></div>
            <div class="hood-skeleton-stat"></div>
          </div>
          <div class="hood-skeleton-bars">
            <div class="hood-skeleton-line hood-skeleton-w80"></div>
            <div class="hood-skeleton-line hood-skeleton-w60"></div>
            <div class="hood-skeleton-line hood-skeleton-w40"></div>
          </div>
        </div>`;
    }
    grid.innerHTML = skeletonHtml;
  }
  try {
    const resp = await fetch(DEFAULT_CSV);
    if (!resp.ok) throw new Error("Fetch failed");
    loadFromText(await resp.text());
  } catch (_err) {
    renderLoadError(grid, true);
  }
}

[$("area1"), $("area2"), $("area3")].forEach((sel) => {
  if (sel) sel.addEventListener("change", renderComparison);
});

loadDefaultCSV();
