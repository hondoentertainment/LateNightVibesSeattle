const DEFAULT_CSV = "venue_list_500plus.csv";
let allVenues = [];
let lastItinerary = { stops: [], phases: [], startMin: 0, slotDuration: 0 };
let lockedStops = new Set(); // indices of locked stops

const $ = (id) => document.getElementById(id);

/* ─── Import shared helpers from LNVCore (loaded via lib/core.js) ─── */
const { normalizeValue, loadDataFromCSV, parseTimeToMinutes, parseHHMM, minutesToLabel, getVibeSet, syncSelect, addListener, showToast, showErrorToast } = window.LNVCore;

/* ─── Vibe arc definitions ─── */
const VIBE_ARCS = {
  "chill-to-wild": [
    { vibes: ["chill", "casual", "date-friendly"], label: "Warm up" },
    { vibes: ["high-energy", "dancey", "loud", "rowdy"], label: "Peak energy" },
    { vibes: ["late-eats", "food-focused", "chill"], label: "Late eats" },
  ],
  "date-night": [
    { vibes: ["chill", "date-friendly", "upscale"], label: "Start classy" },
    { vibes: ["upscale", "views", "rooftop", "live-music"], label: "Impress" },
    { vibes: ["late-eats", "chill", "sweet"], label: "Wind down" },
  ],
  "party": [
    { vibes: ["dancey", "high-energy", "loud"], label: "Get moving" },
    { vibes: ["rowdy", "high-energy", "dancey", "karaoke"], label: "Go all out" },
    { vibes: ["late-eats", "late-night", "food-focused"], label: "Refuel" },
  ],
  "explore": [
    { vibes: ["chill", "casual", "views"], label: "Start chill" },
    { vibes: ["live-music", "karaoke", "games", "playful"], label: "Something different" },
    { vibes: ["late-night", "divey", "casual"], label: "Finish strong" },
  ],
  "low-key": [
    { vibes: ["chill", "casual", "date-friendly"], label: "Easy start" },
    { vibes: ["chill", "casual", "group-friendly"], label: "Keep it mellow" },
    { vibes: ["chill", "late-night", "casual"], label: "Night cap" },
  ],
};

/* ─── Dual controls sync (syncSelect from LNVCore) ─── */

function getVal(mobileId, desktopId) {
  const m = $(mobileId);
  const d = $(desktopId);
  return (m ? m.value : "") || (d ? d.value : "");
}

/* ─── Time validation ─── */
function validateTimes() {
  const startStr = getVal("startTime", "startTimeDesktop");
  const endStr = getVal("endTime", "endTimeDesktop");
  let startMin = parseHHMM(startStr);
  let endMin = parseHHMM(endStr);
  if (endMin <= startMin) endMin += 1440;
  const totalMin = endMin - startMin;

  const errorEl = $("timeError");
  const errorElDesktop = $("timeErrorDesktop");

  if (totalMin < 30) {
    const msg = "End time must be at least 30 minutes after start time.";
    [errorEl, errorElDesktop].forEach((el) => {
      if (el) { el.textContent = msg; el.classList.add("visible"); }
    });
    return false;
  }

  if (totalMin > 8 * 60) {
    const msg = "Plan duration exceeds 8 hours. Consider a shorter window for a better experience.";
    [errorEl, errorElDesktop].forEach((el) => {
      if (el) { el.textContent = msg; el.classList.add("visible"); }
    });
    return false;
  }

  [errorEl, errorElDesktop].forEach((el) => {
    if (el) { el.textContent = ""; el.classList.remove("visible"); }
  });
  return true;
}

/* ─── Build itinerary ─── */
function buildItinerary() {
  if (!validateTimes()) return;
  lockedStops.clear();
  generateItinerary();
}

function generateItinerary() {
  const startStr = getVal("startTime", "startTimeDesktop");
  const endStr = getVal("endTime", "endTimeDesktop");
  const area = getVal("areaFilter", "areaFilterDesktop");
  const arcKey = getVal("vibeArc", "vibeArcDesktop");
  const stopCount = parseInt(getVal("stopCount", "stopCountDesktop") || "3", 10);

  let startMin = parseHHMM(startStr);
  let endMin = parseHHMM(endStr);
  if (endMin <= startMin) endMin += 1440;

  const totalMin = endMin - startMin;
  const slotDuration = Math.floor(totalMin / stopCount);

  const arcPhases = VIBE_ARCS[arcKey] || VIBE_ARCS["chill-to-wild"];
  const phases = [];
  for (let i = 0; i < stopCount; i++) {
    const phaseIdx = Math.min(Math.floor(i * arcPhases.length / stopCount), arcPhases.length - 1);
    phases.push(arcPhases[phaseIdx]);
  }

  let candidates = allVenues.filter((v) => normalizeValue(v.Name));
  if (area) {
    candidates = candidates.filter((v) => normalizeValue(v.Area) === area);
  }

  const picked = [];
  const usedNames = new Set();

  // Preserve locked stops from previous itinerary
  phases.forEach((phase, idx) => {
    if (lockedStops.has(idx) && lastItinerary.stops[idx]) {
      picked.push(lastItinerary.stops[idx]);
      usedNames.add(normalizeValue(lastItinerary.stops[idx].Name));
    } else {
      picked.push(null); // placeholder
    }
  });

  // Fill unlocked stops
  phases.forEach((phase, idx) => {
    if (picked[idx]) return; // already locked

    const slotStart = startMin + idx * slotDuration;
    const slotEnd = slotStart + slotDuration;

    const scored = candidates
      .filter((v) => !usedNames.has(normalizeValue(v.Name)))
      .map((v) => {
        const venueVibes = getVibeSet(v);
        const closingMin = parseTimeToMinutes(v["Typical Closing Time"]);
        let closePenalty = 0;
        if (closingMin !== null) {
          let closeAdj = closingMin <= 360 ? closingMin + 1440 : closingMin;
          if (closeAdj < slotEnd) closePenalty = -2;
        }
        const matched = phase.vibes.filter((t) => venueVibes.has(t));
        const vibeScore = matched.length / phase.vibes.length;
        const diversityBonus = Math.min(venueVibes.size / 5, 0.3);
        let proximityBonus = 0;
        // Check nearest locked/picked neighbor
        const prevPick = idx > 0 ? picked[idx - 1] : null;
        if (prevPick) {
          if (normalizeValue(v.Area) === normalizeValue(prevPick.Area)) proximityBonus = 0.3;
        }
        const score = vibeScore + diversityBonus + proximityBonus + closePenalty;
        return { venue: v, score, matchedVibes: matched };
      })
      .sort((a, b) => b.score - a.score);

    if (scored.length > 0) {
      const topN = scored.slice(0, Math.min(5, scored.length));
      const pick = topN[Math.floor(Math.random() * topN.length)];
      picked[idx] = pick.venue;
      usedNames.add(normalizeValue(pick.venue.Name));
    }
  });

  const finalStops = picked.filter(Boolean);
  lastItinerary = { stops: finalStops, phases, startMin, slotDuration };
  renderItinerary(finalStops, phases, startMin, slotDuration);
  showSecondaryActions();
  const voteSection = $("groupVoteSection");
  if (voteSection) voteSection.style.display = "none";
}

function showSecondaryActions() {
  const m = $("mobileSecondaryActions");
  const d = $("desktopSecondaryActions");
  if (m) m.style.display = "flex";
  if (d) d.style.display = "flex";
}

/* ─── Shuffle (re-generate unlocked stops) with undo (F5) ─── */
let _previousItinerary = null;

function shuffleItinerary() {
  _previousItinerary = {
    stops: [...lastItinerary.stops],
    phases: [...lastItinerary.phases],
    startMin: lastItinerary.startMin,
    slotDuration: lastItinerary.slotDuration,
  };
  generateItinerary();
  showPlannerToast("Shuffled! ", true);
}

// eslint-disable-next-line no-unused-vars -- called from inline onclick in toast
function undoShuffle() {
  if (!_previousItinerary) return;
  lastItinerary = _previousItinerary;
  _previousItinerary = null;
  renderItinerary(lastItinerary.stops, lastItinerary.phases, lastItinerary.startMin, lastItinerary.slotDuration);
  showPlannerToast("Shuffle undone");
}

function showPlannerToast(msg, showUndo) {
  const existing = document.querySelector(".share-toast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.className = "share-toast";
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  if (showUndo) {
    toast.innerHTML = msg + '<button type="button" style="margin-left:12px;background:rgba(0,0,0,0.3);color:#fff;border:none;padding:4px 10px;border-radius:8px;cursor:pointer;font-weight:600;font-size:12px" onclick="undoShuffle();this.parentElement.remove()">Undo</button>';
    toast.style.pointerEvents = "auto";
  } else {
    toast.textContent = msg;
  }
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), showUndo ? 5000 : 2000);
}

/* ─── 8. Reroute from here (recovery UX) ─── */
function rerouteFromIndex(fromIdx) {
  if (!lastItinerary.stops.length || fromIdx >= lastItinerary.stops.length - 1) return;
  lockedStops.clear();
  for (let i = 0; i <= fromIdx; i++) lockedStops.add(i);
  generateItinerary();
}

/* ─── Swap two stops ─── */
function swapStops(i, j) {
  if (!lastItinerary.stops[i] || !lastItinerary.stops[j]) return;
  const temp = lastItinerary.stops[i];
  lastItinerary.stops[i] = lastItinerary.stops[j];
  lastItinerary.stops[j] = temp;
  renderItinerary(lastItinerary.stops, lastItinerary.phases, lastItinerary.startMin, lastItinerary.slotDuration);
}

/* ─── 6. Share itinerary (group planning link) ─── */
function shareItinerary() {
  if (!lastItinerary.stops.length) return;
  const encoded = (window.LNVSharePlan && window.LNVSharePlan.encodeSharePlan)
    ? window.LNVSharePlan.encodeSharePlan(lastItinerary.stops, lastItinerary.startMin, lastItinerary.slotDuration)
    : (() => {
        const payload = { s: lastItinerary.stops.map((v) => ({ n: normalizeValue(v.Name), a: normalizeValue(v.Area), c: normalizeValue(v.Category), t: normalizeValue(v["Typical Closing Time"]), l: normalizeValue(v["Google Maps Driving Link"]) })), start: lastItinerary.startMin, dur: lastItinerary.slotDuration };
        return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
      })();
  const url = `${window.location.origin}${window.location.pathname}?plan=${encoded}`;
  const lines = lastItinerary.stops.map((venue, idx) => {
    const slotStart = lastItinerary.startMin + idx * lastItinerary.slotDuration;
    const slotEnd = slotStart + lastItinerary.slotDuration;
    return `${idx + 1}. ${normalizeValue(venue.Name)} (${minutesToLabel(slotStart)}–${minutesToLabel(slotEnd)}) — ${normalizeValue(venue.Area)}`;
  });
  const text = `My Late Night Vibes plan:\n${lines.join("\n")}\n\nOpen plan: ${url}`;

  if (navigator.share) {
    navigator.share({ title: "Night Plan", text, url }).catch((err) => {
      if (err.name !== "AbortError") {
        navigator.clipboard.writeText(url).then(() => showToast("Link copied!")).catch(() => {});
      }
    });
  } else {
    navigator.clipboard.writeText(url).then(() => showToast("Plan link copied!")).catch(() => {});
  }
}

/* ─── Render ─── */
function renderItinerary(stops, phases, startMin, slotDuration) {
  const container = $("itinerary");
  container.innerHTML = "";

  if (!stops.length) {
    container.innerHTML = `<div class="itinerary-empty">No venues matched your criteria. Try a different area or vibe arc.</div>`;
    return;
  }

  stops.forEach((venue, idx) => {
    const slotStart = startMin + idx * slotDuration;
    const slotEnd = slotStart + slotDuration;
    const phase = phases[idx];
    const mapLink = normalizeValue(venue["Google Maps Driving Link"]);
    const nameText = normalizeValue(venue.Name);
    const tags = normalizeValue(venue["Vibe Tags"]).split(",").map((t) => normalizeValue(t)).filter(Boolean);
    const isLocked = lockedStops.has(idx);

    const stopEl = document.createElement("div");
    stopEl.className = "stop-card";
    stopEl.innerHTML = `
      <div class="stop-timeline">
        <div class="stop-dot"></div>
        <div class="stop-line"></div>
      </div>
      <div class="stop-content">
        <div class="stop-header">
          <div>
            <div class="stop-number">Stop ${idx + 1} · ${phase.label}</div>
            <div class="stop-name">${mapLink ? `<a href="${mapLink}" target="_blank" rel="noopener">${nameText}</a>` : nameText}</div>
          </div>
          <div class="stop-header-right">
            <button class="stop-lock ${isLocked ? "locked" : ""}" data-idx="${idx}" title="${isLocked ? "Unlock this stop" : "Lock this stop"}" type="button">${isLocked ? "🔒" : "🔓"}</button>
            <div class="stop-time">${minutesToLabel(slotStart)} – ${minutesToLabel(slotEnd)}</div>
          </div>
        </div>
        <div class="stop-meta">${normalizeValue(venue.Area)} · ${normalizeValue(venue.Category)}</div>
        <div class="stop-why">
          <strong>Why here:</strong> ${phase.vibes.filter((t) => tags.map((v) => v.toLowerCase()).includes(t)).join(", ") || "Good variety pick"} — fits the ${phase.label.toLowerCase()} phase of your night.
        </div>
        <div class="stop-pills">
          ${tags.slice(0, 5).map((t) => `<span class="pill">${t}</span>`).join("")}
          <span class="pill pill-closing">${normalizeValue(venue["Typical Closing Time"]) || "Late"}</span>
        </div>
        ${(function () {
          const closingMin = parseTimeToMinutes(venue["Typical Closing Time"]);
          let closingWarn = "";
          if (closingMin !== null) {
            const closeAdj = closingMin <= 360 ? closingMin + 1440 : closingMin;
            if (closeAdj < slotEnd) closingWarn = '<div class="stop-warning">⚠ Closes before slot ends</div>';
          }
          return closingWarn;
        })()}
        <div class="stop-actions">
          ${mapLink ? `<a href="${mapLink}" target="_blank" rel="noopener">Directions</a>` : ""}
          <button class="reroute-btn" data-reroute-idx="${idx}" type="button" title="Reroute from here — keep stops before, regenerate rest">Reroute from here</button>
        </div>
      </div>
    `;

    // Lock button
    const lockBtn = stopEl.querySelector(".stop-lock");
    lockBtn.addEventListener("click", () => {
      if (lockedStops.has(idx)) {
        lockedStops.delete(idx);
        lockBtn.classList.remove("locked");
        lockBtn.textContent = "🔓";
        lockBtn.title = "Lock this stop";
      } else {
        lockedStops.add(idx);
        lockBtn.classList.add("locked");
        lockBtn.textContent = "🔒";
        lockBtn.title = "Unlock this stop";
      }
    });

    const rerouteBtn = stopEl.querySelector(".reroute-btn");
    if (rerouteBtn) rerouteBtn.addEventListener("click", () => rerouteFromIndex(idx));

    container.appendChild(stopEl);

    // Swap connector between stops
    if (idx < stops.length - 1) {
    const conn = document.createElement("div");
    conn.className = "connector";
    const nextVenue = stops[idx + 1];
    const nextArea = normalizeValue(nextVenue.Area);
    const thisArea = normalizeValue(venue.Area);
    const travelNote = thisArea === nextArea ? "Same neighborhood" : `${thisArea} → ${nextArea}`;
    let travelMin = (window.LNVFeatures && window.LNVFeatures.estimateTravelMinutes) ? window.LNVFeatures.estimateTravelMinutes(venue, nextVenue) : (thisArea === nextArea ? 5 : 15);
    let isWalkable = false;
    let distanceMiles = null;
    if (window.LNVGeo) {
      const miles = window.LNVGeo.venueToVenueDistanceMiles(venue, nextVenue);
      if (miles != null) {
        distanceMiles = miles;
        if (window.LNVGeo.isWalkable && window.LNVGeo.isWalkable(venue, nextVenue)) {
          isWalkable = true;
          travelMin = Math.ceil(miles * 20);
        } else {
          travelMin = Math.ceil(miles * 4 + 5);
        }
      }
    }
    const travelIcon = isWalkable ? "🚶" : "🚗";
    const travelLabel = isWalkable ? `~${travelMin} min walk` : `~${travelMin} min drive`;
    const queueBuf = "~10 min buffer";
    conn.innerHTML = `
      <div class="connector-line"><div></div></div>
      <div class="connector-info">
        <button class="swap-btn" data-swap-a="${idx}" data-swap-b="${idx + 1}" title="Swap these two stops" type="button">⇅</button>
        <div class="travel-segment">
          <span class="travel-icon" aria-hidden="true">${travelIcon}</span>
          <span class="travel-label">${travelLabel}</span>
          ${distanceMiles != null && !isWalkable ? `<span class="travel-distance">(~${distanceMiles.toFixed(1)} mi)</span>` : ""}
        </div>
        <span class="connector-meta">${travelNote} · ${queueBuf} · ~${Math.floor(slotDuration)} min at venue</span>
      </div>
    `;
    const swapBtn = conn.querySelector(".swap-btn");
    swapBtn.addEventListener("click", () => swapStops(idx, idx + 1));
    container.appendChild(conn);
    }
  });
}

/* ─── Init ─── */
function buildAreaOptions() {
  const areas = Array.from(new Set(allVenues.map((v) => normalizeValue(v.Area)).filter(Boolean))).sort();
  const areaParam = new URLSearchParams(window.location.search).get("area");
  [$("areaFilter"), $("areaFilterDesktop")].forEach((select) => {
    if (!select) return;
    select.innerHTML = `<option value="">Any area</option>`;
    areas.forEach((a) => {
      const opt = document.createElement("option");
      opt.value = a;
      opt.textContent = a;
      if (areaParam && a === areaParam) opt.selected = true;
      select.appendChild(opt);
    });
  });
}

function loadFromText(text) {
  allVenues = loadDataFromCSV(text);
  buildAreaOptions();
  const planParam = new URLSearchParams(window.location.search).get("plan");
  const seedParam = new URLSearchParams(window.location.search).get("seed");
  if (planParam) {
    loadSharedPlan(planParam);
  } else if (seedParam && window.LNVUserPrefs) {
    const seed = window.LNVUserPrefs.loadPlanSeed();
    if (seed) {
      const venue = allVenues.find((v) => normalizeValue(v.Name) === seed.n && normalizeValue(v.Area) === seed.a)
        || { Name: seed.n, Area: seed.a, Category: seed.c || "", "Typical Closing Time": seed.t || "", "Google Maps Driving Link": seed.l || "", "Vibe Tags": seed.v || "", "Driving Distance": seed.d || "" };
      const arcKey = getVal("vibeArc", "vibeArcDesktop") || "chill-to-wild";
      const stopCount = parseInt(getVal("stopCount", "stopCountDesktop") || "3", 10);
      const arcPhases = VIBE_ARCS[arcKey] || VIBE_ARCS["chill-to-wild"];
      const seedPhases = [];
      for (let i = 0; i < stopCount; i++) {
        const phaseIdx = Math.min(Math.floor(i * arcPhases.length / stopCount), arcPhases.length - 1);
        seedPhases.push(i === 0 ? { label: "Start here", vibes: [] } : arcPhases[phaseIdx]);
      }
      lockedStops.add(0);
      lastItinerary = { stops: [venue], phases: seedPhases, startMin: 22 * 60, slotDuration: 60 };
      generateItinerary();
      window.LNVUserPrefs.clearPlanSeed();
    } else {
      $("itinerary").innerHTML = `<div class="itinerary-empty">Choose your settings and tap <strong>Build my night</strong> to generate an itinerary with ${allVenues.length} venues.</div>`;
    }
  } else {
    $("itinerary").innerHTML = `<div class="itinerary-empty">Choose your settings and tap <strong>Build my night</strong> to generate an itinerary with ${allVenues.length} venues.</div>`;
  }
}

/* ─── 6. Load shared plan from URL (group planning) ─── */
function loadSharedPlan(encoded) {
  try {
    const data = (window.LNVSharePlan && window.LNVSharePlan.decodeSharePlan)
      ? window.LNVSharePlan.decodeSharePlan(encoded)
      : JSON.parse(decodeURIComponent(escape(atob(encoded))));
    const rawStops = data.s || [];
    const startMin = data.start || 22 * 60;
    const slotDuration = data.dur || 60;
    const stops = rawStops.map((s) => {
      const match = allVenues.find((v) => normalizeValue(v.Name) === s.n && normalizeValue(v.Area) === s.a);
      return match || {
        Name: s.n, Area: s.a, Category: s.c || "", "Typical Closing Time": s.t || "", "Google Maps Driving Link": s.l || "",
        "Vibe Tags": "", "Driving Distance": "",
      };
    });
    const phases = stops.map((_, i) => ({ label: `Stop ${i + 1}`, vibes: [] }));
    lastItinerary = { stops, phases, startMin, slotDuration };
    renderItinerary(stops, phases, startMin, slotDuration);
    showSecondaryActions();
    renderGroupVoteUI(stops);
  } catch (_) {
    $("itinerary").innerHTML = `<div class="itinerary-empty">Invalid or expired plan link.</div>`;
  }
}

function renderGroupVoteUI(stops) {
  const section = $("groupVoteSection");
  if (!section || !stops.length) return;
  section.style.display = "block";
  section.innerHTML = `
    <div class="group-vote-title">Vote for your favorite stop</div>
    <div class="group-vote-btns">
      ${stops.map((v, i) => `<button type="button" class="vote-btn" data-idx="${i}">${i + 1}. ${normalizeValue(v.Name)}</button>`).join("")}
    </div>
  `;
  const votes = {};
  section.querySelectorAll(".vote-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = btn.dataset.idx;
      votes[idx] = (votes[idx] || 0) + 1;
      btn.textContent = `${parseInt(idx, 10) + 1}. ${normalizeValue(stops[idx].Name)} (${votes[idx]})`;
      showToast("Vote counted!");
    });
  });
}

/* ─── Listeners ─── */

const syncPairs = [
  ["startTime", "startTimeDesktop"],
  ["endTime", "endTimeDesktop"],
  ["areaFilter", "areaFilterDesktop"],
  ["vibeArc", "vibeArcDesktop"],
  ["groupSize", "groupSizeDesktop"],
  ["stopCount", "stopCountDesktop"],
];

syncPairs.forEach(([mobileId, desktopId]) => {
  addListener($(mobileId), "change", () => { syncSelect($(mobileId), $(desktopId)); validateTimes(); });
  addListener($(desktopId), "change", () => { syncSelect($(desktopId), $(mobileId)); validateTimes(); });
});

addListener($("buildPlan"), "click", buildItinerary);
addListener($("buildPlanDesktop"), "click", buildItinerary);
addListener($("shufflePlan"), "click", shuffleItinerary);
addListener($("shufflePlanDesktop"), "click", shuffleItinerary);
addListener($("sharePlan"), "click", shareItinerary);
addListener($("sharePlanDesktop"), "click", shareItinerary);

function renderLoadError(container, retry) {
  if (!container) return;
  const msg = !navigator.onLine
    ? "You appear to be offline. Connect to the internet and try again."
    : "Check your connection and try again.";
  container.innerHTML = `
    <div class="itinerary-empty error-state" role="alert">
      <div class="error-state-icon" style="font-size:32px;margin-bottom:12px" aria-hidden="true">⚠️</div>
      <h3 class="error-state-title">Unable to load venue data</h3>
      <p class="error-state-desc">${msg}</p>
      ${retry ? '<button type="button" class="btn-primary error-retry-btn" onclick="loadDefaultCSV()">Try again</button>' : ""}
    </div>
  `;
}

function showPlannerSkeletons() {
  const itinerary = $("itinerary");
  if (!itinerary) return;
  let html = "";
  for (let i = 0; i < 3; i++) {
    html += `
      <div class="planner-skeleton-stop">
        <div class="planner-skeleton-dot"></div>
        <div class="planner-skeleton-line"></div>
        <div class="planner-skeleton-content">
          <div class="planner-skeleton-row planner-skeleton-w70"></div>
          <div class="planner-skeleton-row planner-skeleton-w50"></div>
          <div class="planner-skeleton-row planner-skeleton-w90"></div>
        </div>
      </div>
      ${i < 2 ? '<div class="planner-skeleton-connector"><div></div></div>' : ""}
    `;
  }
  itinerary.innerHTML = html;
}

async function loadDefaultCSV() {
  const itinerary = $("itinerary");
  if (itinerary) showPlannerSkeletons();
  try {
    const resp = await fetch(DEFAULT_CSV);
    if (!resp.ok) throw new Error("Fetch failed");
    loadFromText(await resp.text());
  } catch (_) {
    renderLoadError(itinerary, true);
    const msg = !navigator.onLine ? "You appear to be offline. Connect and try again." : "Failed to load venues — check your connection.";
    showErrorToast(msg);
  }
}

loadDefaultCSV();

window.addEventListener("offline", () => showErrorToast("You are offline. Some features may not work."));
window.addEventListener("online", () => {
  showToast("Back online!");
  if (allVenues.length === 0) loadDefaultCSV();
});
