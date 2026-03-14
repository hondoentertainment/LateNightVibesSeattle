/* ─── Squad Sync — page controller ─── */

const DEFAULT_CSV = (window.LNVCities && window.LNVCities.getCurrentCity().csv) || "data/seattle.csv";
let allVenues = [];

const $ = (id) => document.getElementById(id);
const { normalizeValue, loadDataFromCSV, collectVibes, showToast, showErrorToast } = window.LNVCore;
const Sync = window.LNVSquadSync;

/* ─── State ─── */
let currentSession = null;
let currentMember = null;
let currentCardIndex = 0;

/* ─── View management ─── */
function showView(viewId) {
  document.querySelectorAll(".squad-view").forEach((v) => v.classList.remove("active"));
  const el = $(viewId);
  if (el) el.classList.add("active");
}

/* ─── Load venue data ─── */
async function loadVenueData() {
  try {
    const resp = await fetch(DEFAULT_CSV);
    if (!resp.ok) throw new Error("Fetch failed");
    const text = await resp.text();
    allVenues = loadDataFromCSV(text);
    onDataLoaded();
  } catch (_) {
    showErrorToast("Failed to load venue data.");
  }
}

/* ─── Populate filters once data is loaded ─── */
function onDataLoaded() {
  // Areas
  const areas = Array.from(new Set(allVenues.map((v) => normalizeValue(v.Area)).filter(Boolean))).sort();
  const areaSelect = $("areaFilter");
  areas.forEach((a) => {
    const opt = document.createElement("option");
    opt.value = a;
    opt.textContent = a;
    areaSelect.appendChild(opt);
  });

  // Categories
  const cats = Array.from(new Set(allVenues.map((v) => normalizeValue(v.Category)).filter(Boolean))).sort();
  const catSelect = $("categoryFilter");
  cats.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    catSelect.appendChild(opt);
  });

  // Vibes
  const vibes = Array.from(collectVibes(allVenues)).sort();
  const vibeGrid = $("vibeGrid");
  vibes.forEach((vibe) => {
    const chip = document.createElement("label");
    chip.className = "squad-vibe-chip";
    chip.innerHTML = `<input type="checkbox" value="${vibe}" />${vibe}`;
    chip.addEventListener("click", () => {
      setTimeout(() => {
        chip.classList.toggle("checked", chip.querySelector("input").checked);
      }, 0);
    });
    vibeGrid.appendChild(chip);
  });

  // Check URL hash for session
  checkURLForSession();
}

/* ─── Check URL for encoded session ─── */
function checkURLForSession() {
  const decoded = Sync.decodeSessionURL();
  if (decoded) {
    // Save to localStorage and show voting or results
    Sync.saveSession(decoded);
    currentSession = decoded;
    if (decoded.status === "results") {
      showResultsView();
    } else {
      showView("viewVote");
    }
    return;
  }

  // Check for ?session= query param
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session");
  if (sessionId) {
    currentSession = Sync.getSession(sessionId);
    if (currentSession) {
      if (currentSession.status === "results") {
        showResultsView();
      } else {
        showView("viewVote");
      }
      return;
    }
  }

  // Default: show create view
  showView("viewCreate");
}

/* ─── Create session ─── */
function createSession() {
  const hostName = $("hostName").value.trim();
  if (!hostName) {
    showErrorToast("Please enter your name.");
    return;
  }

  const area = $("areaFilter").value;
  const category = $("categoryFilter").value;
  const vibeCheckboxes = document.querySelectorAll("#vibeGrid input:checked");
  const vibes = Array.from(vibeCheckboxes).map((cb) => cb.value);
  const maxVenues = parseInt($("maxVenues").value, 10);

  currentSession = Sync.createSession(hostName, { area, category, vibes, maxVenues }, allVenues);
  currentMember = hostName;

  if (currentSession.candidates.length === 0) {
    showErrorToast("No venues matched your filters. Try broader criteria.");
    return;
  }

  showHostView();
}

/* ─── Host view ─── */
function showHostView() {
  showView("viewHost");
  $("hostSessionCode").textContent = currentSession.sessionId;
  renderMemberList();

  // Show host voting if they haven't voted yet
  const hostVotes = currentSession.votes[currentSession.host] || {};
  const totalVenues = currentSession.candidates.length;
  const votedCount = Object.keys(hostVotes).length;

  if (votedCount < totalVenues) {
    $("hostVoteSection").style.display = "block";
    currentCardIndex = votedCount;
    renderSwipeCards("hostSwipeContainer", "hostProgress", "hostProgressFill", "hostProgressLabel", "hostVoteBtns");
  } else {
    $("hostVoteSection").style.display = "none";
  }
}

/* ─── Share link ─── */
function shareLink() {
  if (!currentSession) return;
  const url = Sync.encodeSessionURL(currentSession);

  if (navigator.share) {
    navigator.share({ title: "Squad Sync", text: "Join our Squad Sync session!", url }).catch((err) => {
      if (err.name !== "AbortError") copyToClipboard(url);
    });
  } else {
    copyToClipboard(url);
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(
    () => showToast("Link copied!"),
    () => {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      showToast("Link copied!");
    }
  );
}

function copyCode() {
  if (!currentSession) return;
  copyToClipboard(currentSession.sessionId);
  showToast("Code copied!");
}

/* ─── Member list ─── */
function renderMemberList() {
  if (!currentSession) return;
  const container = $("hostMemberList");
  container.innerHTML = "";

  const members = Object.keys(currentSession.votes);
  const totalVenues = currentSession.candidates.length;

  members.forEach((name) => {
    const votedCount = Object.keys(currentSession.votes[name] || {}).length;
    const isHost = name === currentSession.host;
    const isDone = votedCount >= totalVenues;

    const chip = document.createElement("div");
    chip.className = "squad-member-chip" + (isDone ? " voted" : "") + (isHost ? " host" : "");

    const avatar = document.createElement("span");
    avatar.className = "squad-member-avatar";
    avatar.textContent = name.charAt(0).toUpperCase();
    chip.appendChild(avatar);

    const nameSpan = document.createElement("span");
    nameSpan.textContent = name;
    chip.appendChild(nameSpan);

    container.appendChild(chip);
  });
}

/* ─── Swipe card rendering ─── */
function renderSwipeCards(containerId, progressId, fillId, labelId, btnsId) {
  const container = $(containerId);
  const progressFill = $(fillId);
  const progressLabel = $(labelId);
  const btnsContainer = $(btnsId);

  if (!currentSession) return;

  const candidates = currentSession.candidates;
  const total = candidates.length;
  const member = currentMember || currentSession.host;

  // Determine current index from votes
  const votes = currentSession.votes[member] || {};
  const votedCount = Object.keys(votes).length;
  currentCardIndex = votedCount;

  // Update progress
  const pct = total > 0 ? Math.round((currentCardIndex / total) * 100) : 0;
  progressFill.style.width = pct + "%";
  progressLabel.textContent = currentCardIndex + " / " + total + " venues";

  container.innerHTML = "";

  if (currentCardIndex >= total) {
    // Done voting
    container.style.display = "none";
    btnsContainer.style.display = "none";
    handleVotingDone(containerId);
    return;
  }

  container.style.display = "";
  btnsContainer.style.display = "flex";

  // Render behind card (next card preview)
  if (currentCardIndex + 1 < total) {
    const behindCard = buildVenueCard(candidates[currentCardIndex + 1]);
    behindCard.classList.add("behind");
    container.appendChild(behindCard);
  }

  // Render current card
  const card = buildVenueCard(candidates[currentCardIndex]);
  initSwipeGesture(card, containerId, progressId, fillId, labelId, btnsId);
  container.appendChild(card);
}

function buildVenueCard(venue) {
  const card = document.createElement("div");
  card.className = "squad-swipe-card";

  const tags = normalizeValue(venue["Vibe Tags"]).split(",").map((t) => normalizeValue(t)).filter(Boolean);

  card.innerHTML = `
    <div class="squad-card-vote-indicator left">NOPE</div>
    <div class="squad-card-vote-indicator right">YES</div>
    <div class="squad-card-name">${normalizeValue(venue.Name)}</div>
    <div class="squad-card-meta">
      <span>${normalizeValue(venue.Area)}</span>
      <span class="squad-card-meta-dot"></span>
      <span>${normalizeValue(venue.Category)}</span>
    </div>
    <div class="squad-card-vibes">
      ${tags.slice(0, 5).map((t) => `<span class="squad-card-vibe-pill">${t}</span>`).join("")}
    </div>
    ${venue.Address ? `<div class="squad-card-address">${normalizeValue(venue.Address)}</div>` : ""}
    <div class="squad-card-closing">
      <span class="squad-card-closing-icon">&#x1F556;</span>
      <span>Closes ${normalizeValue(venue["Typical Closing Time"]) || "Late"}</span>
    </div>
  `;

  return card;
}

/* ─── Swipe gesture (touch + drag) ─── */
function initSwipeGesture(card, containerId, progressId, fillId, labelId, btnsId) {
  let startX = 0;
  let _startY = 0;
  let currentX = 0;
  let isDragging = false;

  const leftIndicator = card.querySelector(".squad-card-vote-indicator.left");
  const rightIndicator = card.querySelector(".squad-card-vote-indicator.right");

  function onStart(e) {
    isDragging = true;
    const point = e.touches ? e.touches[0] : e;
    startX = point.clientX;
    _startY = point.clientY;
    card.style.transition = "none";
  }

  function onMove(e) {
    if (!isDragging) return;
    const point = e.touches ? e.touches[0] : e;
    currentX = point.clientX - startX;
    const rotation = currentX * 0.08;
    card.style.transform = `translateX(${currentX}px) rotate(${rotation}deg)`;

    // Show vote indicators based on drag direction
    const threshold = 40;
    if (currentX < -threshold) {
      leftIndicator.style.opacity = Math.min(Math.abs(currentX) / 120, 1);
      rightIndicator.style.opacity = 0;
    } else if (currentX > threshold) {
      rightIndicator.style.opacity = Math.min(currentX / 120, 1);
      leftIndicator.style.opacity = 0;
    } else {
      leftIndicator.style.opacity = 0;
      rightIndicator.style.opacity = 0;
    }
  }

  function onEnd() {
    if (!isDragging) return;
    isDragging = false;
    card.style.transition = "";
    leftIndicator.style.opacity = 0;
    rightIndicator.style.opacity = 0;

    const swipeThreshold = 80;

    if (currentX > swipeThreshold) {
      castVoteAndAdvance("yes", card, "swiping-right", containerId, progressId, fillId, labelId, btnsId);
    } else if (currentX < -swipeThreshold) {
      castVoteAndAdvance("no", card, "swiping-left", containerId, progressId, fillId, labelId, btnsId);
    } else {
      card.style.transform = "";
    }
    currentX = 0;
  }

  card.addEventListener("touchstart", onStart, { passive: true });
  card.addEventListener("touchmove", onMove, { passive: true });
  card.addEventListener("touchend", onEnd);
  card.addEventListener("mousedown", onStart);
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onEnd);
}

/* ─── Cast vote and advance ─── */
function castVoteAndAdvance(vote, card, animClass, containerId, progressId, fillId, labelId, btnsId) {
  if (!currentSession) return;

  const member = currentMember || currentSession.host;
  const venueName = currentSession.candidates[currentCardIndex].Name;

  currentSession = Sync.castVote(currentSession.sessionId, member, venueName, vote);
  currentCardIndex++;

  // Trigger haptic
  if (window.LNVHaptics && window.LNVHaptics.light) {
    window.LNVHaptics.light();
  }

  // Animate card out
  card.classList.add(animClass);

  setTimeout(() => {
    renderSwipeCards(containerId, progressId, fillId, labelId, btnsId);
    // Update member list if host view
    if (containerId === "hostSwipeContainer") {
      renderMemberList();
    }
  }, 350);
}

/* ─── Wire vote buttons ─── */
function wireVoteButtons(btnsId, containerId, progressId, fillId, labelId) {
  const btnsContainer = $(btnsId);
  if (!btnsContainer) return;

  btnsContainer.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const vote = btn.dataset.vote;
      const container = $(containerId);
      const activeCard = container.querySelector(".squad-swipe-card:not(.behind)");
      if (!activeCard) return;

      let animClass = "swiping-up";
      if (vote === "no") animClass = "swiping-left";
      else if (vote === "yes") animClass = "swiping-right";

      castVoteAndAdvance(vote, activeCard, animClass, containerId, progressId, fillId, labelId, btnsId);
    });
  });
}

/* ─── Handle voting done ─── */
function handleVotingDone(containerId) {
  if (containerId === "hostSwipeContainer") {
    // Host done, just hide vote section
    $("hostVoteSection").style.display = "none";
    showToast("All venues voted on!");
    renderMemberList();
    return;
  }

  // Member done
  const voteDone = $("voteDone");
  if (voteDone) voteDone.style.display = "flex";

  // Check if results are available
  if (currentSession && currentSession.status === "results") {
    const goBtn = $("btnGoResults");
    if (goBtn) goBtn.style.display = "inline-block";
  }
}

/* ─── Join session for voting ─── */
function joinForVoting() {
  const name = $("joinName").value.trim();
  if (!name) {
    showErrorToast("Please enter your name.");
    return;
  }

  currentMember = name;

  // Add member to session
  currentSession = Sync.addMember(currentSession.sessionId, name);

  // Hide name prompt, show voting UI
  $("namePrompt").style.display = "none";
  $("votingUI").style.display = "block";

  currentCardIndex = 0;
  renderSwipeCards("swipeContainer", "voteProgress", "voteProgressFill", "voteProgressLabel", "voteBtns");
}

/* ─── Results ─── */
function showResultsView() {
  if (!currentSession) return;

  // Mark status
  currentSession = Sync.setStatus(currentSession.sessionId, "results");
  showView("viewResults");

  const results = Sync.getResults(currentSession.sessionId);
  const matches = Sync.getMatches(currentSession.sessionId);
  const members = Object.keys(currentSession.votes);

  // Match banner
  const bannerEl = $("resultsMatchBanner");
  if (matches.length > 0) {
    bannerEl.innerHTML = `
      <div class="squad-match-banner">
        <div class="squad-match-banner-title">Group Matches!</div>
        <div class="squad-match-banner-sub">Everyone said YES to ${matches.length === 1 ? "this spot" : "these spots"}</div>
        <div class="squad-match-list">
          ${matches.map((m) => `
            <div class="squad-match-item">
              <span class="squad-match-icon">&#x1F389;</span>
              <div>
                <div class="squad-match-name">${m.venueName}</div>
                <div class="squad-match-area">${m.venue.Area}</div>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  } else {
    bannerEl.innerHTML = `<div class="squad-no-matches">No unanimous matches this time. Check out the ranked list below!</div>`;
  }

  // Summary
  $("resultsSummary").textContent = members.length + " member" + (members.length !== 1 ? "s" : "") + " voted on " + currentSession.candidates.length + " venues";

  // Results list
  const listEl = $("resultsList");
  listEl.innerHTML = "";

  results.forEach((r, idx) => {
    const totalVotes = r.yesCount + r.maybeCount + r.noCount;
    const yPct = totalVotes > 0 ? (r.yesCount / totalVotes) * 100 : 0;
    const mPct = totalVotes > 0 ? (r.maybeCount / totalVotes) * 100 : 0;
    const nPct = totalVotes > 0 ? (r.noCount / totalVotes) * 100 : 0;

    const card = document.createElement("div");
    card.className = "squad-result-card";

    // Build vote breakdown tags
    const breakdownTags = Object.keys(r.memberVotes).map((member) => {
      const v = r.memberVotes[member];
      const cls = v === "yes" ? "yes" : v === "maybe" ? "maybe" : v === "no" ? "no" : "no-vote";
      const label = v === "no-vote" ? "skipped" : v;
      return `<span class="squad-vote-tag ${cls}">${member}: ${label}</span>`;
    }).join("");

    card.innerHTML = `
      <div class="squad-result-header">
        <span class="squad-result-rank">#${idx + 1}</span>
        <div style="flex:1">
          <div class="squad-result-name">${r.venueName}</div>
          <div class="squad-result-area">${r.venue.Area}${r.venue.Category ? " &middot; " + r.venue.Category : ""}</div>
        </div>
        <span class="squad-result-score">${r.score} pts</span>
      </div>
      <div class="squad-score-bar">
        <div class="squad-score-bar-yes" style="width:${yPct}%"></div>
        <div class="squad-score-bar-maybe" style="width:${mPct}%"></div>
        <div class="squad-score-bar-no" style="width:${nPct}%"></div>
      </div>
      <div class="squad-vote-breakdown">${breakdownTags}</div>
    `;

    listEl.appendChild(card);
  });

  // Plan link for matches
  const planLinkEl = $("resultsPlanLink");
  if (matches.length > 0) {
    const _venueNames = matches.map((m) => m.venueName).join(",");
    planLinkEl.innerHTML = `<a href="planner.html">Plan This Night</a>`;
  } else {
    planLinkEl.innerHTML = "";
  }
}

/* ─── Export text ─── */
function exportText() {
  if (!currentSession) return;
  const results = Sync.getResults(currentSession.sessionId);
  const text = Sync.exportSessionText(currentSession, results);

  if (navigator.share) {
    navigator.share({ title: "Squad Sync Results", text }).catch(() => copyToClipboard(text));
  } else {
    copyToClipboard(text);
    showToast("Results copied!");
  }
}

/* ─── New session ─── */
function newSession() {
  currentSession = null;
  currentMember = null;
  currentCardIndex = 0;
  // Clear URL hash
  if (window.history.replaceState) {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }
  showView("viewCreate");
}

/* ─── Enable/disable create button ─── */
function updateCreateBtn() {
  const name = $("hostName").value.trim();
  $("btnCreate").disabled = !name;
}

function updateJoinBtn() {
  const name = $("joinName").value.trim();
  $("btnJoinVote").disabled = !name;
}

/* ─── Max venues slider ─── */
function updateSliderVal() {
  $("maxVenuesVal").textContent = $("maxVenues").value;
}

/* ─── Wire up event listeners ─── */
$("hostName").addEventListener("input", updateCreateBtn);
$("maxVenues").addEventListener("input", updateSliderVal);
$("btnCreate").addEventListener("click", createSession);
$("btnShareLink").addEventListener("click", shareLink);
$("btnCopyCode").addEventListener("click", copyCode);
$("btnShowResults").addEventListener("click", showResultsView);
$("btnExportText").addEventListener("click", exportText);
$("btnExportResults").addEventListener("click", exportText);
$("btnNewSession").addEventListener("click", newSession);
$("joinName").addEventListener("input", updateJoinBtn);
$("btnJoinVote").addEventListener("click", joinForVoting);

var btnGoResults = $("btnGoResults");
if (btnGoResults) btnGoResults.addEventListener("click", showResultsView);

// Wire vote buttons for both contexts
wireVoteButtons("voteBtns", "swipeContainer", "voteProgress", "voteProgressFill", "voteProgressLabel");
wireVoteButtons("hostVoteBtns", "hostSwipeContainer", "hostProgress", "hostProgressFill", "hostProgressLabel");

/* ─── Keyboard shortcuts for voting ─── */
document.addEventListener("keydown", (e) => {
  // Only when voting view or host vote section is visible
  const isVoting = $("viewVote").classList.contains("active") && $("votingUI").style.display !== "none";
  const isHostVoting = $("viewHost").classList.contains("active") && $("hostVoteSection").style.display !== "none";

  if (!isVoting && !isHostVoting) return;
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

  const containerId = isHostVoting ? "hostSwipeContainer" : "swipeContainer";
  const progressId = isHostVoting ? "hostProgress" : "voteProgress";
  const fillId = isHostVoting ? "hostProgressFill" : "voteProgressFill";
  const labelId = isHostVoting ? "hostProgressLabel" : "voteProgressLabel";
  const btnsId = isHostVoting ? "hostVoteBtns" : "voteBtns";

  const container = $(containerId);
  const activeCard = container ? container.querySelector(".squad-swipe-card:not(.behind)") : null;
  if (!activeCard) return;

  if (e.key === "ArrowLeft" || e.key === "1") {
    e.preventDefault();
    castVoteAndAdvance("no", activeCard, "swiping-left", containerId, progressId, fillId, labelId, btnsId);
  } else if (e.key === "ArrowDown" || e.key === "2") {
    e.preventDefault();
    castVoteAndAdvance("maybe", activeCard, "swiping-up", containerId, progressId, fillId, labelId, btnsId);
  } else if (e.key === "ArrowRight" || e.key === "3") {
    e.preventDefault();
    castVoteAndAdvance("yes", activeCard, "swiping-right", containerId, progressId, fillId, labelId, btnsId);
  }
});

/* ─── Init ─── */
loadVenueData();
