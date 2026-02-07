const DEFAULT_CSV = "venue_list_500plus.csv";
let allVenues = [];
let lastItinerary = { stops: [], phases: [], startMin: 0, slotDuration: 0 };
let lockedStops = new Set(); // indices of locked stops

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

function parseHHMM(val) {
  const [h, m] = val.split(":").map(Number);
  return h * 60 + m;
}

function minutesToLabel(mins) {
  if (mins >= 1440) mins -= 1440;
  if (mins < 0) mins += 1440;
  let h = Math.floor(mins / 60);
  const m = mins % 60;
  const meridiem = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m.toString().padStart(2, "0")} ${meridiem}`;
}

function parseDistanceMiles(value) {
  const m = normalizeValue(value).toLowerCase().match(/([\d.]+)\s*mi/);
  return m ? parseFloat(m[1]) : null;
}

function getVibeSet(venue) {
  return new Set(
    normalizeValue(venue["Vibe Tags"]).split(",")
      .map((t) => normalizeValue(t).toLowerCase()).filter(Boolean)
  );
}

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

/* ─── Dual controls sync ─── */
function syncSelect(source, target) {
  if (target) target.value = source.value;
}

function getVal(mobileId, desktopId) {
  const m = $(mobileId);
  const d = $(desktopId);
  return (m ? m.value : "") || (d ? d.value : "");
}

/* ─── Build itinerary ─── */
function buildItinerary() {
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
}

function showSecondaryActions() {
  const m = $("mobileSecondaryActions");
  const d = $("desktopSecondaryActions");
  if (m) m.style.display = "flex";
  if (d) d.style.display = "flex";
}

/* ─── Shuffle (re-generate unlocked stops) ─── */
function shuffleItinerary() {
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

/* ─── Share itinerary ─── */
function shareItinerary() {
  if (!lastItinerary.stops.length) return;
  const lines = lastItinerary.stops.map((venue, idx) => {
    const slotStart = lastItinerary.startMin + idx * lastItinerary.slotDuration;
    const slotEnd = slotStart + lastItinerary.slotDuration;
    const phase = lastItinerary.phases[idx];
    return `${idx + 1}. ${normalizeValue(venue.Name)} (${minutesToLabel(slotStart)}–${minutesToLabel(slotEnd)}) — ${normalizeValue(venue.Area)}, ${normalizeValue(venue.Category)}`;
  });
  const text = `My Late Night Vibes plan:\n${lines.join("\n")}`;

  if (navigator.share) {
    navigator.share({ title: "Night Plan", text }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text).then(() => showToast("Plan copied to clipboard!")).catch(() => {});
  }
}

function showToast(msg) {
  const toast = document.createElement("div");
  toast.className = "share-toast";
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
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
        <div class="stop-actions">
          ${mapLink ? `<a href="${mapLink}" target="_blank" rel="noopener">Directions</a>` : ""}
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

    container.appendChild(stopEl);

    // Swap connector between stops
    if (idx < stops.length - 1) {
      const conn = document.createElement("div");
      conn.className = "connector";
      const nextArea = normalizeValue(stops[idx + 1].Area);
      const thisArea = normalizeValue(venue.Area);
      const travelNote = thisArea === nextArea ? "Same neighborhood" : `${thisArea} → ${nextArea}`;
      conn.innerHTML = `
        <div class="connector-line"><div></div></div>
        <div class="connector-info">
          <button class="swap-btn" data-swap-a="${idx}" data-swap-b="${idx + 1}" title="Swap these two stops" type="button">⇅</button>
          ${travelNote} · ~${Math.floor(slotDuration)} min slot
        </div>
      `;
      const swapBtn = conn.querySelector(".swap-btn");
      swapBtn.addEventListener("click", () => {
        swapStops(idx, idx + 1);
      });
      container.appendChild(conn);
    }
  });
}

/* ─── Init ─── */
function buildAreaOptions() {
  const areas = Array.from(new Set(allVenues.map((v) => normalizeValue(v.Area)).filter(Boolean))).sort();
  [$("areaFilter"), $("areaFilterDesktop")].forEach((select) => {
    if (!select) return;
    select.innerHTML = `<option value="">Any area</option>`;
    areas.forEach((a) => {
      const opt = document.createElement("option");
      opt.value = a;
      opt.textContent = a;
      select.appendChild(opt);
    });
  });
}

function loadFromText(text) {
  allVenues = loadDataFromCSV(text);
  buildAreaOptions();
  $("itinerary").innerHTML = `<div class="itinerary-empty">Choose your settings and tap <strong>Build my night</strong> to generate an itinerary with ${allVenues.length} venues.</div>`;
}

async function loadDefaultCSV() {
  try {
    const resp = await fetch(DEFAULT_CSV);
    if (!resp.ok) throw new Error("Fetch failed");
    loadFromText(await resp.text());
  } catch (err) {
    $("itinerary").innerHTML = `<div class="itinerary-empty">Unable to load venue data.</div>`;
  }
}

/* ─── Listeners ─── */
function addListener(el, event, fn) { if (el) el.addEventListener(event, fn); }

const syncPairs = [
  ["startTime", "startTimeDesktop"],
  ["endTime", "endTimeDesktop"],
  ["areaFilter", "areaFilterDesktop"],
  ["vibeArc", "vibeArcDesktop"],
  ["stopCount", "stopCountDesktop"],
];

syncPairs.forEach(([mobileId, desktopId]) => {
  addListener($(mobileId), "change", () => syncSelect($(mobileId), $(desktopId)));
  addListener($(desktopId), "change", () => syncSelect($(desktopId), $(mobileId)));
});

addListener($("buildPlan"), "click", buildItinerary);
addListener($("buildPlanDesktop"), "click", buildItinerary);
addListener($("shufflePlan"), "click", shuffleItinerary);
addListener($("shufflePlanDesktop"), "click", shuffleItinerary);
addListener($("sharePlan"), "click", shareItinerary);
addListener($("sharePlanDesktop"), "click", shareItinerary);

loadDefaultCSV();
