/* ─── Vibe Match page controller ─── */

const DEFAULT_CSV = (window.LNVCities && window.LNVCities.getCurrentCity().csv) || "data/seattle.csv";
let allVenues = [];

const $ = (id) => document.getElementById(id);
const { normalizeValue, loadDataFromCSV, showToast, showErrorToast } = window.LNVCore;
const {
  calculateCompatibility,
  getSharedVibes,
  getConflictingVibes,
  suggestCompromiseVenues,
  getCompatibilityBreakdown,
} = window.LNVVibeMatchFriends;

/* ─── Tag state ─── */
const tagState = {
  vibesA: [], vibesB: [],
  catsA: [], catsB: [],
  hoodsA: [], hoodsB: [],
  venuesA: [], venuesB: [],
};

const tagInputMap = {
  vibesA: "vibeInputA",
  vibesB: "vibeInputB",
  catsA: "catInputA",
  catsB: "catInputB",
  hoodsA: "hoodInputA",
  hoodsB: "hoodInputB",
  venuesA: "venueInputA",
  venuesB: "venueInputB",
};

/* ─── Tag rendering ─── */

function renderTags(listId) {
  const container = $(listId);
  if (!container) return;
  const tags = tagState[listId] || [];
  container.innerHTML = "";
  tags.forEach(function (tag, idx) {
    const el = document.createElement("span");
    el.className = "vm-tag";
    el.innerHTML = escapeHTML(tag) + ' <span class="vm-tag-remove" data-list="' + listId + '" data-idx="' + idx + '" role="button" tabindex="0" aria-label="Remove ' + escapeHTML(tag) + '">&times;</span>';
    container.appendChild(el);
  });
}

function addTag(listId) {
  const inputId = tagInputMap[listId];
  const input = $(inputId);
  if (!input) return;
  const val = input.value.trim();
  if (!val) return;
  // Support comma-separated input
  const items = val.split(",").map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
  items.forEach(function (item) {
    if (tagState[listId].indexOf(item) === -1) {
      tagState[listId].push(item);
    }
  });
  input.value = "";
  renderTags(listId);
}

function removeTag(listId, idx) {
  tagState[listId].splice(idx, 1);
  renderTags(listId);
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ─── Wire up tag add buttons ─── */

document.querySelectorAll(".vm-tag-add-btn").forEach(function (btn) {
  const target = btn.getAttribute("data-target");
  btn.addEventListener("click", function () { addTag(target); });
});

/* Enter key on tag inputs */
Object.keys(tagInputMap).forEach(function (listId) {
  const input = $(tagInputMap[listId]);
  if (input) {
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        addTag(listId);
      }
    });
  }
});

/* Remove tags via event delegation */
document.addEventListener("click", function (e) {
  if (e.target.classList.contains("vm-tag-remove")) {
    var listId = e.target.getAttribute("data-list");
    var idx = parseInt(e.target.getAttribute("data-idx"), 10);
    removeTag(listId, idx);
  }
});

document.addEventListener("keydown", function (e) {
  if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("vm-tag-remove")) {
    e.preventDefault();
    var listId = e.target.getAttribute("data-list");
    var idx = parseInt(e.target.getAttribute("data-idx"), 10);
    removeTag(listId, idx);
  }
});

/* ─── Build profiles from form ─── */

function buildProfile(side) {
  return {
    vibePreferences: tagState["vibes" + side].slice(),
    visitedVenues: tagState["venues" + side].slice(),
    favoriteCategories: tagState["cats" + side].slice(),
    preferredNeighborhoods: tagState["hoods" + side].slice(),
  };
}

/* ─── Compare ─── */

$("btnCompare").addEventListener("click", function () {
  var profileA = buildProfile("A");
  var profileB = buildProfile("B");

  // Need at least some data to compare
  var totalA = profileA.vibePreferences.length + profileA.favoriteCategories.length + profileA.preferredNeighborhoods.length;
  var totalB = profileB.vibePreferences.length + profileB.favoriteCategories.length + profileB.preferredNeighborhoods.length;

  if (totalA === 0 && totalB === 0) {
    showErrorToast("Add some preferences to both profiles first");
    return;
  }

  var breakdown = getCompatibilityBreakdown(profileA, profileB);
  var shared = getSharedVibes([profileA, profileB]);
  var conflicts = getConflictingVibes([profileA, profileB]);
  var compromises = suggestCompromiseVenues([profileA, profileB], allVenues);

  renderResults(breakdown, shared, conflicts, compromises);
});

/* ─── Render results ─── */

function renderResults(breakdown, shared, conflicts, compromises) {
  var resultsEl = $("vmResults");
  resultsEl.classList.add("active");

  // Score ring
  var score = breakdown.overallScore;
  var ring = $("scoreRing");
  var circumference = 2 * Math.PI * 60; // r=60
  var offset = circumference - (score / 100) * circumference;
  ring.style.strokeDashoffset = String(offset);
  $("scoreValue").textContent = score;

  // Label
  var label = "Compatibility Score";
  if (score >= 80) label = "Amazing match!";
  else if (score >= 60) label = "Great compatibility!";
  else if (score >= 40) label = "Some common ground";
  else if (score >= 20) label = "Different tastes";
  else label = "Opposite vibes";
  $("scoreLabel").textContent = label;

  // Breakdown bars
  var categories = [
    { label: "Vibes", score: breakdown.vibes.score },
    { label: "Venues", score: breakdown.venues.score },
    { label: "Categories", score: breakdown.categories.score },
    { label: "Neighborhoods", score: breakdown.neighborhoods.score },
  ];
  var barsHtml = "";
  categories.forEach(function (cat) {
    barsHtml += '<div class="vm-breakdown-row">' +
      '<div class="vm-breakdown-label">' + cat.label + '</div>' +
      '<div class="vm-breakdown-bar"><div class="vm-breakdown-bar-fill" style="width:' + cat.score + '%"></div></div>' +
      '<div class="vm-breakdown-pct">' + cat.score + '%</div>' +
      '</div>';
  });
  $("breakdownBars").innerHTML = barsHtml;

  // Shared vibes
  var sharedEl = $("sharedVibes");
  if (shared.length > 0) {
    sharedEl.innerHTML = shared.map(function (v) {
      return '<span class="vm-pill vm-pill-shared">' + escapeHTML(v) + '</span>';
    }).join("");
  } else {
    sharedEl.innerHTML = '<span class="vm-empty-note">No shared vibes found</span>';
  }

  // Conflicts
  var conflictEl = $("conflictVibes");
  if (conflicts.length > 0) {
    conflictEl.innerHTML = conflicts.map(function (c) {
      return '<span class="vm-pill vm-pill-conflict">' + escapeHTML(c.vibe) + '</span>';
    }).join("");
  } else {
    conflictEl.innerHTML = '<span class="vm-empty-note">No conflicts detected</span>';
  }

  // Unique preferences
  var uniqueHtml = "";
  var nameA = ($("nameA").value || "You").trim();
  var nameB = ($("nameB").value || "Friend").trim();

  if (breakdown.vibes.uniqueToA.length > 0) {
    uniqueHtml += '<div style="margin-bottom:8px"><span style="font-size:12px;color:var(--color-text-secondary);font-weight:600">' + escapeHTML(nameA) + ' only:</span><div class="vm-pill-list" style="margin-top:4px">';
    uniqueHtml += breakdown.vibes.uniqueToA.map(function (v) {
      return '<span class="vm-pill vm-pill-unique-a">' + escapeHTML(v) + '</span>';
    }).join("");
    uniqueHtml += '</div></div>';
  }
  if (breakdown.vibes.uniqueToB.length > 0) {
    uniqueHtml += '<div><span style="font-size:12px;color:var(--color-text-secondary);font-weight:600">' + escapeHTML(nameB) + ' only:</span><div class="vm-pill-list" style="margin-top:4px">';
    uniqueHtml += breakdown.vibes.uniqueToB.map(function (v) {
      return '<span class="vm-pill vm-pill-unique-b">' + escapeHTML(v) + '</span>';
    }).join("");
    uniqueHtml += '</div></div>';
  }
  if (!uniqueHtml) {
    uniqueHtml = '<span class="vm-empty-note">All vibes are shared</span>';
  }
  $("uniqueVibes").innerHTML = uniqueHtml;

  // Compromise venues
  var compEl = $("compromiseVenues");
  if (compromises.length > 0) {
    compEl.innerHTML = "";
    compromises.slice(0, 5).forEach(function (item, idx) {
      var venue = item.venue;
      var name = normalizeValue(venue.Name || venue.name || "");
      var area = normalizeValue(venue.Area || venue.area || venue.neighborhood || "");
      var category = normalizeValue(venue.Category || venue.category || "");
      var card = document.createElement("div");
      card.className = "vm-venue-card";
      card.innerHTML = '<div class="vm-venue-rank">' + (idx + 1) + '</div>' +
        '<div class="vm-venue-info">' +
          '<div class="vm-venue-name">' + escapeHTML(name) + '</div>' +
          '<div class="vm-venue-meta">' + escapeHTML(category) + (area ? " &middot; " + escapeHTML(area) : "") + '</div>' +
        '</div>' +
        '<div class="vm-venue-score">' + Math.round(item.score) + ' pts</div>';
      compEl.appendChild(card);
    });
  } else {
    compEl.innerHTML = '<span class="vm-empty-note">Load venue data to see compromise suggestions</span>';
  }

  // Scroll to results
  resultsEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ─── Load venue data for compromise suggestions ─── */

fetch(DEFAULT_CSV)
  .then(function (r) { return r.text(); })
  .then(function (text) {
    allVenues = loadDataFromCSV(text);
  })
  .catch(function () {
    /* offline or no CSV — compromise suggestions won't work but everything else will */
  });
