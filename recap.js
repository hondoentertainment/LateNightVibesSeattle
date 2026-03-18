/**
 * Morning Recap — page controller for Late Night Vibes.
 *
 * Drives the recap.html page: date picker, recap generation,
 * night card rendering, share button, and history timeline.
 */
(function () {
  "use strict";

  var Recap = window.LNVMorningRecap;
  var Core = window.LNVCore;

  /* ─── DOM refs ─── */
  var dateInput = document.getElementById("recapDate");
  var generateBtn = document.getElementById("generateRecap");
  var contentEl = document.getElementById("recapContent");
  var emptyEl = document.getElementById("recapEmpty");
  var historySection = document.getElementById("recapHistory");
  var historyList = document.getElementById("recapHistoryList");

  /* ─── Initialise date picker ─── */
  function initDate() {
    var now = new Date();
    // If before 6 AM, default to yesterday (the night just ended)
    if (now.getHours() < 6) {
      now.setDate(now.getDate() - 1);
    }
    // Go back one more day for "last night"
    now.setDate(now.getDate() - 1);
    var yyyy = now.getFullYear();
    var mm = String(now.getMonth() + 1).padStart(2, "0");
    var dd = String(now.getDate()).padStart(2, "0");
    dateInput.value = yyyy + "-" + mm + "-" + dd;
  }

  /* ─── Escape HTML ─── */
  function escapeHTML(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  /* ─── Format date for display ─── */
  function formatDisplayDate(dateStr) {
    var parts = dateStr.split("-");
    var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    var days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return days[d.getDay()] + ", " + months[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
  }

  /* ─── Format duration ─── */
  function formatDuration(ms) {
    var totalMin = Math.round(ms / 60000);
    var hours = Math.floor(totalMin / 60);
    var mins = totalMin % 60;
    if (hours === 0) return mins + "m";
    if (mins === 0) return hours + "h";
    return hours + "h " + mins + "m";
  }

  /* ─── Night score SVG ring ─── */
  function scoreRingHTML(score) {
    var radius = 50;
    var circumference = 2 * Math.PI * radius;
    var offset = circumference - (score / 100) * circumference;
    return '<div class="recap-score-section">' +
      '<div class="recap-score-ring">' +
        '<svg width="120" height="120" viewBox="0 0 120 120">' +
          '<circle cx="60" cy="60" r="' + radius + '" fill="none" stroke="#2a334d" stroke-width="7"/>' +
          '<circle cx="60" cy="60" r="' + radius + '" fill="none" stroke="#2bff86" stroke-width="7" ' +
            'stroke-dasharray="' + circumference + '" stroke-dashoffset="' + offset + '" stroke-linecap="round"/>' +
        '</svg>' +
        '<span class="recap-score-value">' + score + '</span>' +
      '</div>' +
      '<div class="recap-score-label">Night Score</div>' +
    '</div>';
  }

  /* ─── Vibe cloud HTML ─── */
  function vibeCloudHTML(vibeCloud) {
    if (!vibeCloud || !vibeCloud.length) return "";

    var maxCount = vibeCloud[0].count;
    var html = '<div class="recap-section-title">Vibe Cloud</div><div class="recap-vibe-cloud">';

    for (var i = 0; i < vibeCloud.length; i++) {
      var entry = vibeCloud[i];
      var ratio = entry.count / maxCount;
      var sizeClass = "size-1";
      if (ratio > 0.75) sizeClass = "size-4";
      else if (ratio > 0.5) sizeClass = "size-3";
      else if (ratio > 0.25) sizeClass = "size-2";
      html += '<span class="recap-vibe-tag ' + sizeClass + '">' + escapeHTML(entry.tag) + '</span>';
    }

    html += '</div>';
    return html;
  }

  /* ─── Highlights HTML ─── */
  function highlightsHTML(highlights) {
    if (!highlights || !highlights.length) return "";

    var icons = {
      "first-visit": "\uD83C\uDF1F",
      "highest-rated": "\u2B50",
      "achievement": "\uD83C\uDFC6"
    };

    var html = '<div class="recap-section-title">Highlights</div><div class="recap-highlights">';

    for (var i = 0; i < highlights.length; i++) {
      var h = highlights[i];
      var icon = icons[h.type] || "\u2728";
      html += '<div class="recap-highlight-item">';
      html += '<span class="recap-highlight-icon">' + icon + '</span>';
      html += '<span class="recap-highlight-text">' + escapeHTML(h.description) + '</span>';
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  /* ─── Render the night card ─── */
  function renderRecap(recap) {
    var html = '';

    // Night card
    html += '<div class="recap-night-card">';

    // Brand + header
    html += '<div class="recap-card-brand">Late Night Vibes</div>';
    html += '<div class="recap-card-header">';
    html += '<div>';
    html += '<h2 class="recap-card-title">Morning Recap</h2>';
    html += '<div class="recap-card-date">' + formatDisplayDate(recap.date) + '</div>';
    html += '</div>';
    html += '</div>';

    // Score ring
    html += scoreRingHTML(recap.nightScore);

    // Stats grid
    html += '<div class="recap-stats-grid">';
    html += '<div class="recap-stat"><div class="recap-stat-number">' + recap.stats.totalVenues + '</div><div class="recap-stat-label">Venues</div></div>';
    html += '<div class="recap-stat"><div class="recap-stat-number">' + (recap.stats.duration > 0 ? formatDuration(recap.stats.duration) : "--") + '</div><div class="recap-stat-label">Time Out</div></div>';
    html += '<div class="recap-stat"><div class="recap-stat-number">' + recap.stats.musicGenres + '</div><div class="recap-stat-label">Genres</div></div>';
    html += '</div>';

    // Venues list
    if (recap.venues && recap.venues.length > 0) {
      html += '<div class="recap-section-title">Venues Visited</div>';
      html += '<ul class="recap-venues-list">';
      for (var i = 0; i < recap.venues.length; i++) {
        html += '<li class="recap-venue-item">';
        html += '<span class="recap-venue-number">' + (i + 1) + '</span>';
        html += '<span class="recap-venue-name">' + escapeHTML(recap.venues[i]) + '</span>';
        html += '</li>';
      }
      html += '</ul>';
    }

    // Vibe cloud
    html += vibeCloudHTML(recap.vibeCloud);

    // Highlights
    html += highlightsHTML(recap.highlights);

    // Mood
    if (recap.mood) {
      html += '<div class="recap-mood">';
      html += '<span class="recap-mood-badge">Mood: ' + escapeHTML(recap.mood) + '</span>';
      html += '</div>';
    }

    html += '</div>'; // close night card

    // Action buttons
    html += '<div class="recap-actions">';
    html += '<button class="recap-btn recap-btn-share" id="recapShare" type="button">';
    html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>';
    html += 'Share';
    html += '</button>';
    html += '<button class="recap-btn" id="recapCopy" type="button">';
    html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
    html += 'Copy Text';
    html += '</button>';
    html += '</div>';

    contentEl.innerHTML = html;

    // Bind buttons
    var shareBtn = document.getElementById("recapShare");
    var copyBtn = document.getElementById("recapCopy");

    if (shareBtn) shareBtn.addEventListener("click", function () { handleShare(recap); });
    if (copyBtn) copyBtn.addEventListener("click", function () { handleCopy(recap); });
  }

  /* ─── Share handler ─── */
  function handleShare(recap) {
    var text = recap.shareText;
    if (!text) {
      showToast("Nothing to share");
      return;
    }

    if (navigator.share) {
      navigator.share({
        title: "Morning Recap - " + formatDisplayDate(recap.date),
        text: text,
      }).catch(function () {
        copyToClipboard(text);
      });
    } else {
      copyToClipboard(text);
    }
  }

  /* ─── Copy handler ─── */
  function handleCopy(recap) {
    var text = recap.shareText;
    if (!text) {
      showToast("Nothing to copy");
      return;
    }
    copyToClipboard(text);
  }

  /* ─── Copy to clipboard with toast ─── */
  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        showToast("Copied to clipboard!");
      }).catch(function () {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      showToast("Copied to clipboard!");
    } catch (_e) {
      showToast("Could not copy");
    }
    document.body.removeChild(ta);
  }

  /* ─── Toast ─── */
  function showToast(msg) {
    var existing = document.querySelector(".recap-toast");
    if (existing) existing.remove();

    var toast = document.createElement("div");
    toast.className = "recap-toast";
    toast.textContent = msg;
    document.body.appendChild(toast);

    requestAnimationFrame(function () {
      toast.classList.add("show");
    });

    setTimeout(function () {
      toast.classList.remove("show");
      setTimeout(function () { toast.remove(); }, 300);
    }, 2000);
  }

  /* ─── Render recap history ─── */
  function renderHistory() {
    var history = Recap.getRecapHistory();
    if (!history || !history.length) {
      historySection.style.display = "none";
      return;
    }

    historySection.style.display = "";
    var html = "";

    for (var i = 0; i < history.length; i++) {
      var r = history[i];
      html += '<div class="recap-history-card" data-date="' + escapeHTML(r.date) + '">';
      html += '<div class="recap-history-card-header">';
      html += '<span class="recap-history-date">' + formatDisplayDate(r.date) + '</span>';
      html += '<span class="recap-history-score">' + r.nightScore + '/100</span>';
      html += '</div>';
      html += '<div class="recap-history-stats">';
      html += r.stats.totalVenues + ' venues';
      if (r.stats.duration > 0) html += ' &middot; ' + formatDuration(r.stats.duration);
      html += '</div>';
      html += '</div>';
    }

    historyList.innerHTML = html;

    // Bind clicks on history cards
    var cards = historyList.querySelectorAll(".recap-history-card");
    for (var j = 0; j < cards.length; j++) {
      cards[j].addEventListener("click", function () {
        var date = this.getAttribute("data-date");
        dateInput.value = date;
        onGenerate();
      });
    }
  }

  /* ─── Main generate handler ─── */
  function onGenerate() {
    var date = dateInput.value;
    if (!date) {
      showToast("Please select a date");
      return;
    }

    var recap = Recap.generateRecap(date);
    if (!recap) {
      contentEl.innerHTML = '';
      contentEl.appendChild(emptyEl);
      emptyEl.style.display = "";
      emptyEl.querySelector(".recap-empty-desc").textContent =
        'No night data found for ' + formatDisplayDate(date) + '. Start a Night Timeline session and check into venues to generate a recap!';
      return;
    }

    renderRecap(recap);
    renderHistory();
  }

  /* ─── Wire up ─── */
  initDate();
  generateBtn.addEventListener("click", onGenerate);
  renderHistory();

})();
