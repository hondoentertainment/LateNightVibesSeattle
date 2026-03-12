const DEFAULT_CSV = (window.LNVCities && window.LNVCities.getCurrentCity().csv) || "data/seattle.csv";
const ADMIN_TOKEN = "lnv-admin-2024";
const ADMIN_TOKEN_KEY = "lnv_admin_token";

/* ─── Auth gate ─── */
function checkAdminAuth() {
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get("token");
  const storedToken = localStorage.getItem(ADMIN_TOKEN_KEY);

  if (urlToken === ADMIN_TOKEN || storedToken === ADMIN_TOKEN) {
    localStorage.setItem(ADMIN_TOKEN_KEY, ADMIN_TOKEN);
    return true;
  }
  return false;
}

function showAuthGate() {
  const main = document.getElementById("main");
  if (main) main.style.display = "none";

  const gate = document.createElement("div");
  gate.id = "authGate";
  gate.style.cssText =
    "display:flex;align-items:center;justify-content:center;min-height:80vh;padding:2rem;";
  gate.innerHTML =
    '<form id="authForm" style="background:var(--card-bg,#1e1e2e);padding:2rem 2.5rem;border-radius:12px;' +
    "box-shadow:0 4px 24px rgba(0,0,0,.4);text-align:center;max-width:360px;width:100%;\">" +
    '<h2 style="margin:0 0 .5rem;color:var(--text-primary,#fff);font-size:1.25rem;">Admin Access</h2>' +
    '<p style="margin:0 0 1.25rem;color:var(--text-secondary,#aaa);font-size:.9rem;">Enter the admin token to continue.</p>' +
    '<input id="authTokenInput" type="password" placeholder="Admin token" autocomplete="off" ' +
    'style="width:100%;padding:.6rem .75rem;border:1px solid var(--border,#333);border-radius:8px;' +
    'background:var(--input-bg,#16161e);color:var(--text-primary,#fff);font-size:1rem;box-sizing:border-box;" />' +
    '<p id="authError" style="color:#f87171;font-size:.85rem;margin:.75rem 0 0;display:none;">Invalid token. Please try again.</p>' +
    '<button type="submit" style="margin-top:1rem;width:100%;padding:.6rem;border:none;border-radius:8px;' +
    'background:var(--accent,#6366f1);color:#fff;font-size:1rem;font-weight:600;cursor:pointer;">Sign in</button>' +
    "</form>";

  const main2 = document.getElementById("main");
  if (main2 && main2.parentNode) {
    main2.parentNode.insertBefore(gate, main2);
  } else {
    document.body.appendChild(gate);
  }

  document.getElementById("authForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var value = document.getElementById("authTokenInput").value.trim();
    if (value === ADMIN_TOKEN) {
      localStorage.setItem(ADMIN_TOKEN_KEY, ADMIN_TOKEN);
      window.location.reload();
    } else {
      var err = document.getElementById("authError");
      if (err) err.style.display = "block";
    }
  });
}

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
  if (!container) return;
  container.innerHTML = "";
  entries.forEach(([label, count]) => {
    const item = document.createElement("div");
    item.className = "breakdown-item";
    item.innerHTML = `<span class="label">${escapeHtml(label)}</span><span class="count">${count}</span>`;
    container.appendChild(item);
  });
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function showImportFeedback(message, isSuccess) {
  const el = document.getElementById("importFeedback");
  if (!el) return;
  el.textContent = message;
  el.className = "admin-import-feedback" + (isSuccess ? " admin-feedback-success" : message ? " admin-feedback-error" : "");
  if (message) el.setAttribute("aria-live", "polite");
}

function renderAdmin(venues) {
  const venueEl = document.getElementById("venueCount");
  const areaEl = document.getElementById("areaCount");
  const categoryEl = document.getElementById("categoryCount");
  const vibeEl = document.getElementById("vibeCount");
  const statusEl = document.getElementById("statusText");

  if (venueEl) venueEl.textContent = venues.length;
  const areas = countByField(venues, "Area");
  const categories = countByField(venues, "Category");
  const vibes = countByVibes(venues);
  if (areaEl) areaEl.textContent = areas.length;
  if (categoryEl) categoryEl.textContent = categories.length;
  if (vibeEl) vibeEl.textContent = vibes.length;
  renderBreakdown("areaBreakdown", areas);
  renderBreakdown("categoryBreakdown", categories);
  renderBreakdown("vibeBreakdown", vibes);

  if (statusEl) {
    statusEl.textContent = `Loaded ${venues.length} venues successfully`;
    statusEl.className = "admin-status admin-status-success";
  }
}

function loadFromText(text) {
  const venues = loadDataFromCSV(text);
  renderAdmin(venues);
  showImportFeedback("");
}

function renderLoadError(retry) {
  const statusEl = document.getElementById("statusText");
  if (statusEl) {
    statusEl.className = "admin-status admin-status-error";
    statusEl.innerHTML = retry
      ? 'Unable to load venue data. <button type="button" class="btn-primary error-retry-btn" onclick="loadDefaultCSV()">Try again</button>'
      : "Unable to load default CSV. Use Import to upload a file.";
  }
}

async function loadDefaultCSV() {
  const statusEl = document.getElementById("statusText");
  if (statusEl) {
    statusEl.textContent = "Loading…";
    statusEl.className = "admin-status";
  }
  showImportFeedback("", false);
  try {
    const response = await fetch(DEFAULT_CSV);
    if (!response.ok) throw new Error("Fetch failed");
    const text = await response.text();
    loadFromText(text);
  } catch (_err) {
    renderLoadError(true);
  }
}

function handleFile(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".csv")) {
    showImportFeedback("Please upload a CSV file.", false);
    return;
  }
  const confirmed = window.confirm(
    "This will replace the current venue dataset. Existing data cannot be recovered. Continue?"
  );
  if (!confirmed) {
    showImportFeedback("Import cancelled.", false);
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const venues = loadDataFromCSV(reader.result);
      if (!venues.length) {
        showImportFeedback("CSV appears empty or has no valid rows.", false);
        return;
      }
      loadFromText(reader.result);
      showImportFeedback(`Imported ${venues.length} venues from ${file.name}`, true);
    } catch (_e) {
      showImportFeedback("Invalid CSV format. Check column headers and escaping.", false);
    }
  };
  reader.onerror = () => showImportFeedback("Could not read file.", false);
  reader.readAsText(file);
}

/* ─── Pending submissions management ─── */
const SUBMISSIONS_KEY = "lnv_pending_submissions";

function getSubmissions() {
  try {
    return JSON.parse(localStorage.getItem(SUBMISSIONS_KEY)) || [];
  } catch (_e) {
    return [];
  }
}

function saveSubmissions(list) {
  localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(list));
}

function renderSubmissions() {
  var list = getSubmissions().filter(function (s) { return s.status === "pending"; });
  var container = document.getElementById("submissionsList");
  var emptyMsg = document.getElementById("submissionsEmpty");
  if (!container) return;

  container.innerHTML = "";

  if (!list.length) {
    if (emptyMsg) emptyMsg.style.display = "";
    return;
  }

  if (emptyMsg) emptyMsg.style.display = "none";

  list.forEach(function (sub) {
    var card = document.createElement("div");
    card.className = "submission-card";
    card.setAttribute("data-id", sub.id);

    var cityLabel = sub.city ? escapeHtml(sub.city) + " \u2014 " : "";
    var areaLabel = escapeHtml((sub.area || "").replace(/_/g, " / "));

    card.innerHTML =
      '<div class="submission-header">' +
        '<div class="submission-name">' + escapeHtml(sub.name) + '</div>' +
        '<div class="submission-meta">' + cityLabel + areaLabel + ' \u00B7 ' + escapeHtml(sub.category) + '</div>' +
      '</div>' +
      '<div class="submission-details">' +
        '<div class="submission-detail"><span class="detail-label">Closing:</span> ' + escapeHtml(sub.closingTime || "\u2014") + '</div>' +
        '<div class="submission-detail"><span class="detail-label">Address:</span> ' + escapeHtml(sub.address || "\u2014") + '</div>' +
        '<div class="submission-detail"><span class="detail-label">Website:</span> ' + (sub.website ? '<a href="' + escapeHtml(sub.website) + '" target="_blank" rel="noopener">' + escapeHtml(sub.website) + '</a>' : '\u2014') + '</div>' +
        '<div class="submission-detail"><span class="detail-label">Rating:</span> ' + escapeHtml(sub.rating || "\u2014") + '</div>' +
        '<div class="submission-detail"><span class="detail-label">Vibes:</span> ' + escapeHtml(sub.vibeTags || "\u2014") + '</div>' +
        '<div class="submission-detail"><span class="detail-label">Submitted:</span> ' + escapeHtml(new Date(sub.submittedAt).toLocaleDateString()) + '</div>' +
      '</div>' +
      '<div class="submission-actions">' +
        '<button type="button" class="btn-approve" data-id="' + escapeHtml(sub.id) + '">Approve</button>' +
        '<button type="button" class="btn-reject" data-id="' + escapeHtml(sub.id) + '">Reject</button>' +
      '</div>';

    container.appendChild(card);
  });

  container.onclick = function (e) {
    var btn = e.target.closest("[data-id]");
    if (!btn) return;
    var id = btn.getAttribute("data-id");
    if (btn.classList.contains("btn-approve")) approveSubmission(id);
    else if (btn.classList.contains("btn-reject")) rejectSubmission(id);
  };
}

function approveSubmission(id) {
  var all = getSubmissions();
  var idx = all.findIndex(function (s) { return s.id === id; });
  if (idx === -1) return;
  all[idx].status = "approved";
  saveSubmissions(all);
  renderSubmissions();
}

function rejectSubmission(id) {
  var all = getSubmissions();
  var idx = all.findIndex(function (s) { return s.id === id; });
  if (idx === -1) return;
  all[idx].status = "rejected";
  saveSubmissions(all);
  renderSubmissions();
}

/* ─── Auth check & initialization ─── */
if (checkAdminAuth()) {
  /* ─── Drop zone ─── */
  const dropZone = document.getElementById("dropZone");
  const csvInput = document.getElementById("csvFile");

  if (dropZone && csvInput) {
    dropZone.addEventListener("click", () => csvInput.click());
    dropZone.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        csvInput.click();
      }
    });
    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add("admin-dropzone-dragover");
    });
    dropZone.addEventListener("dragleave", () => {
      dropZone.classList.remove("admin-dropzone-dragover");
    });
    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove("admin-dropzone-dragover");
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      handleFile(file);
    });
  }

  if (csvInput) {
    csvInput.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      handleFile(file);
      e.target.value = "";
    });
  }

  /* ─── Reload button ─── */
  const reloadBtn = document.getElementById("reloadData");
  if (reloadBtn) {
    reloadBtn.addEventListener("click", loadDefaultCSV);
  }

  loadDefaultCSV();
  renderSubmissions();
} else {
  showAuthGate();
}
