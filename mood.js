/* ─── Mood Match page logic ─── */

const DEFAULT_CSV = (window.LNVCities && window.LNVCities.getCurrentCity().csv) || "data/seattle.csv";
let allVenues = [];

const $ = (id) => document.getElementById(id);

/* ─── Import shared helpers ─── */
const { normalizeValue, loadDataFromCSV, showToast, showErrorToast } = window.LNVCore;
const { matchMood } = window.LNVMoodMatch;

/* ─── DOM refs ─── */
const moodInput = $("moodInput");
const moodBtn = $("moodBtn");
const moodResults = $("moodResults");
const moodResultsHeader = $("moodResultsHeader");
const moodResultsCount = $("moodResultsCount");
const moodExamples = $("moodExamples");
const moodQuickChips = $("moodQuickChips");

/* ─── Typing indicator ─── */
function showTypingIndicator() {
  moodResults.innerHTML = `
    <div class="mood-typing-indicator">
      <div class="mood-typing-dots">
        <span></span><span></span><span></span>
      </div>
      <span class="mood-typing-text">Finding your vibe...</span>
    </div>
  `;
  moodResultsHeader.style.display = "none";
}

/* ─── Search ─── */

function doSearch() {
  const query = (moodInput.value || "").trim();
  if (!query) {
    renderEmpty();
    return;
  }
  if (!allVenues.length) {
    showErrorToast("Still loading venues...");
    return;
  }

  // Show typing indicator, then display results after brief delay
  showTypingIndicator();
  setTimeout(function () {
    const results = matchMood(query, allVenues);
    renderResults(results, query);
  }, 600);
}

/* ─── Render results ─── */

function renderResults(results, query) {
  moodResults.innerHTML = "";

  if (!results.length) {
    moodResultsHeader.style.display = "none";
    moodResults.innerHTML = `
      <div class="mood-no-results">
        <div style="font-size:28px;margin-bottom:12px">&#x1F50D;</div>
        <div class="mood-empty-title">No matches found</div>
        <p>We couldn't find venues matching "${escapeHTML(query)}". Try different words like "chill", "cocktails", "dance", "late night", or "rooftop".</p>
      </div>
    `;
    return;
  }

  // Show header
  moodResultsHeader.style.display = "";
  moodResultsCount.textContent = results.length + " venue" + (results.length !== 1 ? "s" : "") + " matched";

  // Render cards
  results.forEach(function (result, idx) {
    var venue = result.venue;
    var tags = normalizeValue(venue["Vibe Tags"]).split(",").map(function (t) { return normalizeValue(t).toLowerCase(); }).filter(Boolean);
    var primaryTag = tags[0] || "general";
    var posterClass = "poster-general poster-" + primaryTag.replace(/[^a-z0-9-]/g, "") || "general";
    var nameText = normalizeValue(venue.Name);
    var mapLink = normalizeValue(venue["Google Maps Driving Link"]);
    var matchedSet = {};
    result.matchedTags.forEach(function (t) { matchedSet[t.toLowerCase()] = true; });

    var card = document.createElement("div");
    card.className = "mood-result-card";
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", "View details for " + nameText);

    // Build tag pills
    var pillsHTML = tags.map(function (t) {
      var isMatched = matchedSet[t];
      return '<span class="pill' + (isMatched ? " pill-matched" : "") + '">' + t + "</span>";
    }).join("");

    card.innerHTML =
      '<div class="mood-result-poster ' + posterClass + '"></div>' +
      '<div class="mood-result-body">' +
        '<div class="name">' + (mapLink ? '<a href="' + mapLink + '" target="_blank" rel="noopener">' + nameText + '</a>' : nameText) + '</div>' +
        '<div class="meta">' + normalizeValue(venue.Area) + " &middot; " + normalizeValue(venue.Category) + " &middot; " + (normalizeValue(venue["Typical Closing Time"]) || "Late") + '</div>' +
        '<div class="mood-match-reason">' + escapeHTML(result.reason) + '</div>' +
        '<div class="pills">' + pillsHTML + '</div>' +
        '<div class="score-badge">Score: ' + result.score + '</div>' +
      '</div>';

    // Open detail on click
    card.addEventListener("click", function (e) {
      if (e.target.closest("a")) return;
      openMoodDetail(venue);
    });
    card.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openMoodDetail(venue); }
    });

    // Apply staggered fade-in animation
    card.classList.add("mood-fade-in");
    card.style.animationDelay = (idx * 100) + "ms";

    moodResults.appendChild(card);
  });

  // Add "Try another" button at the end of results
  var tryAnotherWrap = document.createElement("div");
  tryAnotherWrap.className = "mood-try-another-wrap";
  tryAnotherWrap.innerHTML = '<button type="button" class="mood-try-another-btn">Try a different mood</button>';
  tryAnotherWrap.querySelector(".mood-try-another-btn").addEventListener("click", function () {
    moodInput.value = "";
    moodInput.focus();
    renderEmpty();
    moodInput.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  moodResults.appendChild(tryAnotherWrap);

  // Scroll results into view on mobile
  if (window.innerWidth < 860) {
    moodResultsHeader.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function renderEmpty() {
  moodResultsHeader.style.display = "none";
  moodResults.innerHTML = `
    <div class="mood-empty">
      <div class="mood-empty-icon" aria-hidden="true">&#x2728;</div>
      <div class="mood-empty-title">Tell us the vibe</div>
      <p>Type what you're in the mood for above, or tap an example to get started. We'll match venues based on vibes, categories, and atmosphere.</p>
    </div>
  `;
}

function escapeHTML(str) {
  var div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ─── Loading skeletons ─── */

function showSkeletons() {
  moodResults.innerHTML = "";
  for (var i = 0; i < 6; i++) {
    var sk = document.createElement("div");
    sk.className = "mood-skeleton-card";
    sk.innerHTML =
      '<div class="mood-skeleton-poster"></div>' +
      '<div class="mood-skeleton-body">' +
        '<div class="mood-skeleton-line mood-skeleton-w80"></div>' +
        '<div class="mood-skeleton-line mood-skeleton-w60"></div>' +
        '<div class="mood-skeleton-line mood-skeleton-w40"></div>' +
      '</div>';
    moodResults.appendChild(sk);
  }
}

/* ─── Load error ─── */

function renderLoadError() {
  var msg = !navigator.onLine
    ? "You appear to be offline. Connect to the internet and try again."
    : "Check your connection and try again.";
  moodResults.innerHTML = `
    <div class="mood-empty error-state" role="alert">
      <div style="font-size:32px;margin-bottom:12px" aria-hidden="true">&#x26A0;&#xFE0F;</div>
      <div class="mood-empty-title">Unable to load venue data</div>
      <p>${msg}</p>
      <button type="button" class="mood-btn" onclick="loadDefaultCSV()" style="margin-top:16px;font-size:14px;padding:10px 24px">Try again</button>
    </div>
  `;
}

/* ─── Data loading ─── */

function loadFromText(text) {
  allVenues = loadDataFromCSV(text);
  renderEmpty();
  // Deep-link: auto-open venue drawer if ?venue= param is present
  if (window.LNVDetailDrawer && window.LNVDetailDrawer.openFromURL) {
    window.LNVDetailDrawer.openFromURL(allVenues);
  }
  // Auto-search if query param present
  var urlQuery = new URLSearchParams(window.location.search).get("q");
  if (urlQuery) {
    moodInput.value = urlQuery;
    doSearch();
  }
}

async function loadDefaultCSV() {
  showSkeletons();
  try {
    var resp = await fetch(DEFAULT_CSV);
    if (!resp.ok) throw new Error("Fetch failed");
    loadFromText(await resp.text());
  } catch (_err) {
    renderLoadError();
    var msg = !navigator.onLine ? "You appear to be offline. Connect and try again." : "Failed to load venues — check your connection.";
    showErrorToast(msg);
  }
}

/* ─── Event listeners ─── */

// Search button
moodBtn.addEventListener("click", doSearch);

// Enter key in textarea (without shift)
moodInput.addEventListener("keydown", function (e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    doSearch();
  }
});

// Example chips
moodExamples.addEventListener("click", function (e) {
  var chip = e.target.closest(".mood-example-chip");
  if (!chip) return;
  var query = chip.getAttribute("data-query");
  if (query) {
    moodInput.value = query;
    doSearch();
  }
});

// Quick mood chips (above textarea)
if (moodQuickChips) {
  moodQuickChips.addEventListener("click", function (e) {
    var chip = e.target.closest(".mood-quick-chip");
    if (!chip) return;
    var mood = chip.getAttribute("data-mood");
    if (mood) {
      moodInput.value = mood;
      doSearch();
    }
  });
}

/* ─── Detail drawer ─── */

if (window.LNVDetailDrawer) {
  window.LNVDetailDrawer.init({
    overlay: $("moodDetailOverlay"),
    drawer: $("moodDetailDrawer"),
    close: $("moodDetailClose"),
    title: $("moodDetailTitle"),
    body: $("moodDetailBody"),
  });
}

function openMoodDetail(venue) {
  if (window.LNVDetailDrawer) window.LNVDetailDrawer.open(venue);
}

/* ─── Network status ─── */

window.addEventListener("offline", function () { showErrorToast("You are offline. Some features may not work."); });
window.addEventListener("online", function () {
  showToast("Back online!");
  if (allVenues.length === 0) loadDefaultCSV();
});

/* ─── Init ─── */

loadDefaultCSV();
