const DEFAULT_CSV = "venue_list_500plus.csv";
let allVenues = [];

const $ = (id) => document.getElementById(id);

/* ─── Import shared helpers from LNVCore (loaded via lib/core.js) ─── */
const { normalizeValue, loadDataFromCSV, getVibeSet, parseDistanceMiles, syncSelect, addListener, showToast, showErrorToast } = window.LNVCore;

/* ─── Dual controls ─── */
const venueSelectMobile = $("venueSelect");
const venueSelectDesktop = $("venueSelectDesktop");
const maxDistMobile = $("maxDistanceInput");
const maxDistDesktop = $("maxDistanceInputDesktop");
const resultCountMobile = $("resultCountInput");
const resultCountDesktop = $("resultCountInputDesktop");
const contextMobile = $("contextModeMobile");
const contextDesktop = $("contextModeDesktop");

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

function getContextMode() {
  const m = contextMobile ? contextMobile.value : "";
  const d = contextDesktop ? contextDesktop.value : "";
  return m || d || "";
}

/* ─── Context-aware vibes (2) ─── */
const CONTEXT_VIBES = {
  "date": ["date-friendly", "upscale", "chill"],
  "friends": ["social", "group-friendly", "group-fun"],
  "solo": ["chill", "casual"],
  "after-concert": ["late-eats", "chill"],
  "post-game": ["sports", "rowdy", "high-energy"],
};

/* ─── Crawl history helpers ─── */
function getCrawlHistory() {
  return (window.LNVCrawl && window.LNVCrawl.loadHistory) ? window.LNVCrawl.loadHistory() : {};
}

/* ─── Recommendation engine ─── */
function computeRecommendations(base, maxDist, maxResults, contextMode) {
  const baseDist = parseDistanceMiles(base["Driving Distance"]);
  const baseVibes = getVibeSet(base);
  const contextPreferred = (CONTEXT_VIBES[contextMode] || []).map((t) => t.toLowerCase());
  const crawl = getCrawlHistory();
  const excludedVibes = (window.LNVUserPrefs && window.LNVUserPrefs.loadExcludedVibes) ? window.LNVUserPrefs.loadExcludedVibes() : [];

  return allVenues
    .filter((v) => {
      if (!v.Name || v.Name === base.Name) return false;
      if (excludedVibes.length) {
        const vVibes = getVibeSet(v);
        const hasExcluded = excludedVibes.some((ev) => vVibes.has(ev));
        if (hasExcluded) return false;
      }
      return true;
    })
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
      let contextBonus = 0;
      if (contextPreferred.length && candidateVibes.size) {
        const contextMatch = contextPreferred.filter((t) => candidateVibes.has(t)).length;
        contextBonus = Math.min(0.2, (contextMatch / contextPreferred.length) * 0.2);
      }

      // Crawl history: boost unvisited, slight penalty for already-visited
      const venueName = normalizeValue(venue.Name);
      let crawlAdj = 0;
      const entry = crawl[venueName];
      if (entry) {
        crawlAdj = -0.05; // slight deprioritize already-visited
        if (entry.rating === -1) crawlAdj = -0.15; // stronger penalty for disliked
      } else {
        crawlAdj = 0.03; // small boost for new-to-you
      }

      const score = Math.max(0, Math.min(1, vibeScore * 0.5 + catScore * 0.2 + areaScore * 0.2 + distScore * 0.1 + contextBonus + crawlAdj));
      const sharedVibes = intersection.length ? intersection.join(", ") : "new vibe twist";
      const reasonParts = [
        intersection.length ? `${intersection.length} shared vibe${intersection.length > 1 ? "s" : ""}: ${sharedVibes}` : "Different vibe mix",
        catScore ? "Same category" : "Different category",
        areaScore ? "Same neighborhood" : normalizeValue(venue.Area),
      ];
      if (entry) reasonParts.push("Been there");
      const reason = reasonParts.join(" · ");
      const breakdown = {
        vibe: Math.round(vibeScore * 100),
        category: Math.round(catScore * 100),
        area: Math.round(areaScore * 100),
        distance: Math.round(distScore * 100),
        total: Math.round(score * 100),
      };
      return { venue, score, reason, breakdown, visited: !!entry };
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
    grid.innerHTML = `
      <div class="rec-empty">
        <div style="font-size:28px;margin-bottom:12px">✨</div>
        <p style="font-weight:600;margin-bottom:8px">Pick a starting venue</p>
        <p>Choose a venue above to get personalized recommendations based on distance, vibes, and category. You can also add favorites from Browse — we'll use those to tailor results.</p>
        <a href="index.html" style="display:inline-block;margin-top:16px;color:#2bff86;font-weight:600;text-decoration:none">Browse venues →</a>
      </div>
    `;
    return;
  }

  const base = allVenues.find((v) => normalizeValue(v.Name) === selectedName);
  if (!base) return;
  renderSourceCard(base);

  const maxDist = getMaxDist();
  const count = getResultCount();
  const context = getContextMode();
  const recs = computeRecommendations(base, Number.isFinite(maxDist) ? maxDist : null, count, context);

  if (!recs.length) {
    grid.innerHTML = `
      <div class="rec-empty">
        <div style="font-size:28px;margin-bottom:12px">🗺️</div>
        <p style="font-weight:600;margin-bottom:8px">No nearby matches</p>
        <p>Try increasing the max distance, or pick a different starting venue. You can also explore by neighborhood in Browse.</p>
        <a href="index.html" style="display:inline-block;margin-top:16px;color:#2bff86;font-weight:600;text-decoration:none">Browse venues →</a>
      </div>
    `;
    return;
  }

  recs.forEach(({ venue, reason, breakdown, visited }) => {
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
        <div class="score-breakdown">
          <div class="score-bar-group">
            <div class="score-bar-row"><span class="score-label">Vibes</span><div class="score-track"><div class="score-fill" style="width:${breakdown.vibe}%;background:#2bff86"></div></div><span class="score-pct">${breakdown.vibe}%</span></div>
            <div class="score-bar-row"><span class="score-label">Category</span><div class="score-track"><div class="score-fill" style="width:${breakdown.category}%;background:#4dd6ff"></div></div><span class="score-pct">${breakdown.category}%</span></div>
            <div class="score-bar-row"><span class="score-label">Area</span><div class="score-track"><div class="score-fill" style="width:${breakdown.area}%;background:#ff7ad6"></div></div><span class="score-pct">${breakdown.area}%</span></div>
            <div class="score-bar-row"><span class="score-label">Distance</span><div class="score-track"><div class="score-fill" style="width:${breakdown.distance}%;background:#ffd36e"></div></div><span class="score-pct">${breakdown.distance}%</span></div>
          </div>
          <div class="score-total">Match: ${breakdown.total}%</div>
        </div>
        <div class="pills">
          ${visited ? '<span class="pill pill-visited">Been There</span>' : ""}
          <span class="pill">${normalizeValue(venue["Typical Closing Time"]) || "Late"}</span>
          <span class="pill">${normalizeValue(venue["Driving Distance"]) || "Distance TBD"}</span>
          ${tags[0] ? `<button type="button" class="pill pill-exclude" data-vibe="${(tags[0] || "").toLowerCase()}" title="Don't recommend more ${tags[0]} spots">Exclude ${tags[0]}</button>` : ""}
        </div>
        <div class="vibes">${normalizeValue(venue["Vibe Tags"])}</div>
        <div class="links">
          ${mapLink ? `<a href="${mapLink}" target="_blank" rel="noopener">Directions</a>` : "<span></span>"}
        </div>
      </div>
    `;
    const excludeBtn = card.querySelector(".pill-exclude");
    if (excludeBtn && window.LNVUserPrefs) {
      excludeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const vibe = excludeBtn.dataset.vibe;
        if (vibe) {
          window.LNVUserPrefs.excludeVibe(vibe);
          renderRecommendations();
        }
      });
    }
    grid.appendChild(card);
  });
}

/* ─── Build venue select ─── */
function buildVenueOptions() {
  const names = allVenues.map((v) => normalizeValue(v.Name)).filter(Boolean).sort();
  let defaultName = "";
  if (window.LNVUserPrefs) {
    try {
      const favs = JSON.parse(localStorage.getItem("lnv_favorites") || "[]");
      if (favs && favs.length) {
        const firstFav = favs[0];
        if (names.includes(firstFav)) defaultName = firstFav;
      }
    } catch (_) {}
  }
  [venueSelectMobile, venueSelectDesktop].forEach((select) => {
    if (!select) return;
    select.innerHTML = `<option value="">Pick a venue</option>`;
    names.forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      if (name === defaultName) opt.selected = true;
      select.appendChild(opt);
    });
  });
  if (defaultName) renderRecommendations();
}

function loadFromText(text) {
  allVenues = loadDataFromCSV(text);
  buildVenueOptions();
  renderRecommendations();
}

function renderLoadError(grid, retry) {
  if (!grid) return;
  const msg = !navigator.onLine
    ? "You appear to be offline. Connect to the internet and try again."
    : "Check your connection and try again.";
  grid.innerHTML = `
    <div class="rec-empty error-state" role="alert">
      <div class="error-state-icon" style="font-size:32px;margin-bottom:12px" aria-hidden="true">⚠️</div>
      <h3 class="error-state-title">Unable to load venue data</h3>
      <p class="error-state-desc">${msg}</p>
      ${retry ? '<button type="button" class="btn-primary error-retry-btn" onclick="loadDefaultCSV()">Try again</button>' : ""}
    </div>
  `;
}

function showRecSkeletons() {
  const grid = $("recommendationGrid");
  if (!grid) return;
  grid.innerHTML = "";
  for (let i = 0; i < 6; i++) {
    const sk = document.createElement("div");
    sk.className = "rec-skeleton-card";
    sk.innerHTML = `
      <div class="rec-skeleton-poster"></div>
      <div class="rec-skeleton-body">
        <div class="rec-skeleton-line rec-skeleton-w80"></div>
        <div class="rec-skeleton-line rec-skeleton-w60"></div>
        <div class="rec-skeleton-line rec-skeleton-w40"></div>
        <div class="rec-skeleton-line rec-skeleton-w70"></div>
      </div>
    `;
    grid.appendChild(sk);
  }
}

async function loadDefaultCSV() {
  const grid = $("recommendationGrid");
  if (grid) showRecSkeletons();
  try {
    const resp = await fetch(DEFAULT_CSV);
    if (!resp.ok) throw new Error("Fetch failed");
    loadFromText(await resp.text());
  } catch (err) {
    renderLoadError(grid, true);
    const msg = !navigator.onLine ? "You appear to be offline. Connect and try again." : "Failed to load venues — check your connection.";
    showErrorToast(msg);
  }
}

/* ─── Listeners ─── */

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
addListener(contextMobile, "change", () => {
  syncSelect(contextMobile, contextDesktop);
  renderRecommendations();
});
addListener(contextDesktop, "change", () => {
  syncSelect(contextDesktop, contextMobile);
  renderRecommendations();
});

function handleSurpriseMe() {
  const selectedName = getVenueSelectValue();
  let pool = [];
  if (selectedName) {
    const base = allVenues.find((v) => normalizeValue(v.Name) === selectedName);
    if (base) pool = computeRecommendations(base, getMaxDist(), 20, getContextMode());
  }
  if (!pool.length) pool = allVenues.filter((v) => normalizeValue(v.Name)).map((v) => ({ venue: v, score: 0.5, reason: "Random pick", breakdown: { total: 50 }, visited: false }));
  if (pool.length) {
    const pick = pool[Math.floor(Math.random() * pool.length)];
    const venue = pick.venue || pick;
    const name = normalizeValue(venue.Name);
    [venueSelectMobile, venueSelectDesktop].forEach((sel) => { if (sel) sel.value = name; });
    renderRecommendations();
    const grid = $("recommendationGrid");
    if (grid && grid.firstElementChild) grid.firstElementChild.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

addListener($("surpriseMeBtn"), "click", handleSurpriseMe);
addListener($("surpriseMeBtnDesktop"), "click", handleSurpriseMe);

loadDefaultCSV();

window.addEventListener("offline", () => showErrorToast("You are offline. Some features may not work."));
window.addEventListener("online", () => {
  showToast("Back online!");
  if (allVenues.length === 0) loadDefaultCSV();
});
