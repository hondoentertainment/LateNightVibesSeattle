/**
 * Night Challenges — page controller.
 *
 * Renders weekly challenges, handles tab switching, claim actions,
 * countdown timer, and leaderboard display.
 */
(function () {
  "use strict";

  var NC = window.LNVNightChallenges;
  var Core = window.LNVCore;
  if (!NC) {
    console.warn("LNVNightChallenges not loaded");
    return;
  }

  /* ─── DOM refs ─── */

  var activeGrid = document.getElementById("activeChallenges");
  var completedGrid = document.getElementById("completedChallenges");
  var historyGrid = document.getElementById("historyChallenges");
  var leaderboardSection = document.getElementById("leaderboardSection");
  var leaderboardList = document.getElementById("leaderboardList");
  var countdownText = document.getElementById("countdownText");
  var tabs = document.querySelectorAll(".challenge-tab");
  var panels = {
    active: activeGrid,
    completed: completedGrid,
    history: historyGrid,
    leaderboard: leaderboardSection
  };

  /* ─── Tab switching ─── */

  function switchTab(tabName) {
    for (var i = 0; i < tabs.length; i++) {
      var t = tabs[i];
      var isActive = t.getAttribute("data-tab") === tabName;
      t.classList.toggle("active", isActive);
      t.setAttribute("aria-selected", isActive ? "true" : "false");
    }
    for (var key in panels) {
      if (panels.hasOwnProperty(key)) {
        panels[key].style.display = key === tabName ? "" : "none";
      }
    }
  }

  for (var i = 0; i < tabs.length; i++) {
    tabs[i].addEventListener("click", function () {
      switchTab(this.getAttribute("data-tab"));
    });
  }

  /* ─── Countdown timer ─── */

  function updateCountdown() {
    var remaining = NC.getTimeRemaining();
    if (remaining <= 0) {
      countdownText.textContent = "New challenges available!";
      return;
    }
    var days = Math.floor(remaining / 86400000);
    var hours = Math.floor((remaining % 86400000) / 3600000);
    var mins = Math.floor((remaining % 3600000) / 60000);

    var parts = [];
    if (days > 0) parts.push(days + "d");
    parts.push(hours + "h");
    parts.push(mins + "m");
    countdownText.textContent = parts.join(" ") + " remaining";
  }

  updateCountdown();
  setInterval(updateCountdown, 60000);

  /* ─── Card rendering ─── */

  function buildChallengeCard(challenge, options) {
    var opts = options || {};
    var progress = NC.getChallengeProgress(challenge.id);
    var pct = progress ? progress.percentComplete : 0;
    var isCompleted = challenge.completed;
    var isClaimed = challenge.claimed;
    var isHistory = opts.isHistory || false;

    var card = document.createElement("div");
    card.className = "challenge-card" + (isCompleted ? " completed" : "") + (isHistory ? " history-card" : "");

    var headerHtml =
      '<div class="challenge-card-header">' +
        '<span class="challenge-type-badge ' + challenge.type + '">' + challenge.type + '</span>' +
        '<span class="challenge-xp">+' + challenge.xpReward + ' XP</span>' +
      '</div>';

    var bodyHtml =
      '<h3 class="challenge-title">' + escapeHtml(challenge.title) + '</h3>' +
      '<p class="challenge-desc">' + escapeHtml(challenge.description) + '</p>';

    var progressHtml =
      '<div class="progress-bar-wrap">' +
        '<div class="progress-bar-fill" style="width:' + pct + '%"></div>' +
      '</div>' +
      '<div class="progress-label">' +
        '<span>' + (progress ? progress.progress : 0) + ' / ' + (progress ? progress.target : challenge.target) + '</span>' +
        '<span>' + pct + '%</span>' +
      '</div>';

    var actionHtml = "";
    if (isCompleted && !isClaimed && !isHistory) {
      actionHtml = '<button class="btn-claim" data-challenge-id="' + challenge.id + '">Claim ' + challenge.xpReward + ' XP</button>';
    } else if (isClaimed) {
      actionHtml = '<div class="btn-claimed">Claimed</div>';
    } else if (isHistory && challenge.expired && !challenge.completed) {
      actionHtml = '<div class="btn-claimed">Expired</div>';
    }

    card.innerHTML = headerHtml + bodyHtml + progressHtml + actionHtml;

    // Attach claim handler
    var claimBtn = card.querySelector(".btn-claim");
    if (claimBtn) {
      claimBtn.addEventListener("click", function () {
        var id = this.getAttribute("data-challenge-id");
        var result = NC.claimChallengeReward(id);
        if (result) {
          if (Core && Core.showToast) {
            Core.showToast("Claimed " + result.xpAwarded + " XP!");
          }
          renderAll();
        }
      });
    }

    return card;
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  /* ─── Render sections ─── */

  function renderActive() {
    var challenges = NC.getActiveChallenges();
    activeGrid.innerHTML = "";
    if (challenges.length === 0) {
      activeGrid.innerHTML = '<div class="empty-state">No active challenges right now. Check back soon!</div>';
      return;
    }
    for (var i = 0; i < challenges.length; i++) {
      activeGrid.appendChild(buildChallengeCard(challenges[i]));
    }
  }

  function renderCompleted() {
    var weekly = NC.getWeeklyChallenges();
    var completed = [];
    for (var i = 0; i < weekly.length; i++) {
      if (weekly[i].completed) {
        completed.push(weekly[i]);
      }
    }
    completedGrid.innerHTML = "";
    if (completed.length === 0) {
      completedGrid.innerHTML = '<div class="empty-state">No completed challenges yet this week. Keep going!</div>';
      return;
    }
    for (var j = 0; j < completed.length; j++) {
      completedGrid.appendChild(buildChallengeCard(completed[j]));
    }
  }

  function renderHistory() {
    var allCompleted = NC.getCompletedChallenges();
    // Show challenges from previous weeks only
    var weekly = NC.getWeeklyChallenges();
    var currentIds = {};
    for (var i = 0; i < weekly.length; i++) {
      currentIds[weekly[i].id + "-" + weekly[i].weekKey] = true;
    }

    historyGrid.innerHTML = "";
    var historyItems = [];
    for (var j = 0; j < allCompleted.length; j++) {
      var ch = allCompleted[j];
      var key = ch.id + "-" + ch.weekKey;
      // Only include items not in the current active list
      // (completed challenges from past weeks are in the completedChallenges array)
      historyItems.push(ch);
    }

    if (historyItems.length === 0) {
      historyGrid.innerHTML = '<div class="empty-state">No challenge history yet. Complete some challenges!</div>';
      return;
    }
    for (var k = 0; k < historyItems.length; k++) {
      historyGrid.appendChild(buildChallengeCard(historyItems[k], { isHistory: true }));
    }
  }

  function renderLeaderboard() {
    var board = NC.getChallengeLeaderboard();
    leaderboardList.innerHTML = "";
    if (board.length === 0) {
      leaderboardList.innerHTML = '<li class="empty-state">No leaderboard entries yet.</li>';
      return;
    }
    for (var i = 0; i < board.length; i++) {
      var entry = board[i];
      var li = document.createElement("li");
      li.className = "leaderboard-item";
      li.innerHTML =
        '<span class="leaderboard-rank">#' + (i + 1) + '</span>' +
        '<span class="leaderboard-name">' + escapeHtml(entry.username) + '</span>' +
        '<span class="leaderboard-score">' + entry.score + ' pts</span>';
      leaderboardList.appendChild(li);
    }
  }

  function renderAll() {
    renderActive();
    renderCompleted();
    renderHistory();
    renderLeaderboard();
  }

  /* ─── Init ─── */

  renderAll();

})();
