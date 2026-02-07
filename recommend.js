const DEFAULT_CSV = "venue_list_500plus.csv";
let allVenues = [];

const $ = (id) => document.getElementById(id);

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

function getVibeSet(venue) {
  return new Set(
    normalizeValue(venue["Vibe Tags"]).split(",")
      .map((t) => normalizeValue(t).toLowerCase()).filter(Boolean)
  );
}

function parseDistanceMiles(value) {
  const m = normalizeValue(value).toLowerCase().match(/([\d.]+)\s*mi/);
  return m ? parseFloat(m[1]) : null;
}

/* ─── Dual controls ─── */
const venueSelectMobile = $("venueSelect");
const venueSelectDesktop = $("venueSelectDesktop");
const maxDistMobile = $("maxDistanceInput");
const maxDistDesktop = $("maxDistanceInputDesktop");
const resultCountMobile = $("resultCountInput");
const resultCountDesktop = $("resultCountInputDesktop");

function getVenueSelectValue() {
  return normalizeValue((venueSelectMobile ? venueSelectMobile.value : "") || (venueSelectDesktop ? venueSelectDesktop.value : ""));
}

function getMaxDist() {
  const m = maxDistMobile ? maxDistMobile.value : "";
  const d = maxDistDesktop ? maxDistDesktop.value : "";
  return parseFloat(m || d || "6");
}

function getResultCount() {
  const m = resultCountMobile ? resultCountMobile.value : "";
  const d = resultCountDesktop ? resultCountDesktop.value : "";
  return Math.min(parseInt(m || d || "8", 10), 20);
}

function syncSelect(source, target) {
  if (target) target.value = source.value;
}

/* ─── Recommendation engine ─── */
function computeRecommendations(base, maxDist, maxResults) {
  const baseDist = parseDistanceMiles(base["Driving Distance"]);
  const baseVibes = getVibeSet(base);

  return allVenues
    .filter((v) => v.Name && v.Name !== base.Name)
    .map((venue) => {
      const dist = parseDistanceMiles(venue["Driving Distance"]);
      if (maxDist !== null && dist !== null && dist > maxDist) return null;

      const candidateVibes = getVibeSet(venue);
      const intersection = Array.from(candidateVibes).filter((t) => baseVibes.has(t));
      const union = new Set([...candidateVibes, ...baseVibes]);
      const vibeScore = union.size ? intersection.length / union.size : 0;
      const catScore = normalizeValue(venue.Category).toLowerCase() === normalizeValue(base.Category).toLowerCase() ? 1 : 0;
      const areaScore = normalizeValue(venue.Area).toLowerCase() === normalizeValue(base.Area).toLowerCase() ? 1 : 0;
      let distScore = 0.4;
      if (dist !== null && baseDist !== null && maxDist) {
        distScore = 1 - Math.min(Math.abs(dist - baseDist) / maxDist, 1);
      }
      const score = vibeScore * 0.5 + catScore * 0.2 + areaScore * 0.2 + distScore * 0.1;
      const sharedVibes = intersection.length ? intersection.join(", ") : "new vibe twist";
      const reason = [
        intersection.length ? `${intersection.length} shared vibe${intersection.length > 1 ? "s" : ""}: ${sharedVibes}` : "Different vibe mix",
        catScore ? "Same category" : "Different category",
        areaScore ? "Same neighborhood" : normalizeValue(venue.Area),
      ].join(" · ");
      return { venue, score, reason };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}

/* ─── Render ─── */
function renderSourceCard(venue) {
  ["sourceCard", "sourceCardMobile"].forEach((id) => {
    const card = $(id);
    const infoId = id === "sourceCard" ? "sourceInfo" : "sourceInfoMobile";
    const info = $(infoId);
    if (!card || !info) return;
    if (!venue) { card.style.display = "none"; return; }
    card.style.display = "";
    const mapLink = normalizeValue(venue["Google Maps Driving Link"]);
    info.innerHTML = `
      <div class="name">${normalizeValue(venue.Name)}</div>
      <div class="meta">${normalizeValue(venue.Area)} · ${normalizeValue(venue.Category)}</div>
      <div class="meta">${normalizeValue(venue["Typical Closing Time"]) || "Late"} · ${normalizeValue(venue["Driving Distance"]) || "Distance TBD"}</div>
      <div class="vibes">${normalizeValue(venue["Vibe Tags"])}</div>
      ${mapLink ? `<a href="${mapLink}" target="_blank" rel="noopener">Directions</a>` : ""}
    `;
  });
}

function renderRecommendations() {
  const selectedName = getVenueSelectValue();
  const grid = $("recommendationGrid");
  grid.innerHTML = "";

  if (!selectedName) {
    renderSourceCard(null);
    grid.innerHTML = `<div class="rec-empty">Pick a starting venue to get recommendations based on distance and shared vibes.</div>`;
    return;
  }

  const base = allVenues.find((v) => normalizeValue(v.Name) === selectedName);
  if (!base) return;
  renderSourceCard(base);

  const maxDist = getMaxDist();
  const count = getResultCount();
  const recs = computeRecommendations(base, Number.isFinite(maxDist) ? maxDist : null, count);

  if (!recs.length) {
    grid.innerHTML = `<div class="rec-empty">No nearby matches. Try a wider distance.</div>`;
    return;
  }

  recs.forEach(({ venue, reason }) => {
    const mapLink = normalizeValue(venue["Google Maps Driving Link"]);
    const tags = normalizeValue(venue["Vibe Tags"]).split(",").map((t) => normalizeValue(t).toLowerCase()).filter(Boolean);
    const primaryTag = tags[0] || "general";
    const posterClass = `poster-general poster-${primaryTag.replace(/[^a-z0-9-]/g, "") || "general"}`;
    const nameText = normalizeValue(venue.Name);
    const card = document.createElement("div");
    card.className = "rec-card";
    card.innerHTML = `
      <div class="rec-poster ${posterClass}"></div>
      <div class="rec-body">
        <div class="name">${mapLink ? `<a href="${mapLink}" target="_blank" rel="noopener">${nameText}</a>` : nameText}</div>
        <div class="meta">${normalizeValue(venue.Area)} · ${normalizeValue(venue.Category)}</div>
        <div class="reason">${reason}</div>
        <div class="pills">
          <span class="pill">${normalizeValue(venue["Typical Closing Time"]) || "Late"}</span>
          <span class="pill">${normalizeValue(venue["Driving Distance"]) || "Distance TBD"}</span>
        </div>
        <div class="vibes">${normalizeValue(venue["Vibe Tags"])}</div>
        <div class="links">
          ${mapLink ? `<a href="${mapLink}" target="_blank" rel="noopener">Directions</a>` : "<span></span>"}
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

/* ─── Build venue select ─── */
function buildVenueOptions() {
  const names = allVenues.map((v) => normalizeValue(v.Name)).filter(Boolean).sort();
  [venueSelectMobile, venueSelectDesktop].forEach((select) => {
    if (!select) return;
    select.innerHTML = `<option value="">Pick a venue</option>`;
    names.forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    });
  });
}

function loadFromText(text) {
  allVenues = loadDataFromCSV(text);
  buildVenueOptions();
  renderRecommendations();
}

async function loadDefaultCSV() {
  try {
    const resp = await fetch(DEFAULT_CSV);
    if (!resp.ok) throw new Error("Fetch failed");
    loadFromText(await resp.text());
  } catch (err) {
    $("recommendationGrid").innerHTML = `<div class="rec-empty">Unable to load venue data.</div>`;
  }
}

/* ─── Listeners ─── */
function addListener(el, event, fn) { if (el) el.addEventListener(event, fn); }

addListener(venueSelectMobile, "change", () => {
  syncSelect(venueSelectMobile, venueSelectDesktop);
  renderRecommendations();
});
addListener(venueSelectDesktop, "change", () => {
  syncSelect(venueSelectDesktop, venueSelectMobile);
  renderRecommendations();
});
addListener(maxDistMobile, "input", () => {
  syncSelect(maxDistMobile, maxDistDesktop);
  renderRecommendations();
});
addListener(maxDistDesktop, "input", () => {
  syncSelect(maxDistDesktop, maxDistMobile);
  renderRecommendations();
});
addListener(resultCountMobile, "input", () => {
  syncSelect(resultCountMobile, resultCountDesktop);
  renderRecommendations();
});
addListener(resultCountDesktop, "input", () => {
  syncSelect(resultCountDesktop, resultCountMobile);
  renderRecommendations();
});

loadDefaultCSV();
