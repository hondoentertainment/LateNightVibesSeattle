/**
 * Night Replay — post-night summary / journal for Late Night Vibes.
 *
 * Reads crawl history from localStorage, matches visited venues to venue
 * data for the current city, and generates a replay card with timeline,
 * stats, vibe cloud, night score, and shareable Night Card.
 */
(function () {
  "use strict";

  var Core = window.LNVCore;
  var Crawl = window.LNVCrawl;
  var Cities = window.LNVCities;

  /* ─── DOM refs ─── */
  var dateInput = document.getElementById("replayDate");
  var generateBtn = document.getElementById("generateReplay");
  var contentEl = document.getElementById("replayContent");
  var emptyEl = document.getElementById("replayEmpty");

  /* ─── Venue data cache ─── */
  var venueData = null;

  /* ─── Initialise date picker ─── */
  function initDate() {
    var now = new Date();
    // If before 6 AM, default to yesterday (the night just ended)
    if (now.getHours() < 6) {
      now.setDate(now.getDate() - 1);
    }
    var yyyy = now.getFullYear();
    var mm = String(now.getMonth() + 1).padStart(2, "0");
    var dd = String(now.getDate()).padStart(2, "0");
    dateInput.value = yyyy + "-" + mm + "-" + dd;
  }

  /* ─── Load venue data from CSV ─── */
  function loadVenueData(callback) {
    if (venueData) return callback(venueData);

    var city = Cities ? Cities.getCurrentCity() : null;
    var csvPath = city ? city.csv : "data/seattle.csv";

    fetch(csvPath)
      .then(function (res) { return res.text(); })
      .then(function (text) {
        venueData = Core.loadDataFromCSV(text);
        callback(venueData);
      })
      .catch(function () {
        venueData = [];
        callback(venueData);
      });
  }

  /* ─── Find venue data by name ─── */
  function findVenue(venues, name) {
    var lower = name.toLowerCase();
    for (var i = 0; i < venues.length; i++) {
      if ((venues[i].Name || "").toLowerCase() === lower) return venues[i];
    }
    return null;
  }

  /* ─── Check if a date string matches a given YYYY-MM-DD ─── */
  function matchesDate(isoString, dateStr) {
    if (!isoString || !dateStr) return false;
    // The visitedAt is a full ISO string; extract the date portion.
    // For nightlife, a visit at 1 AM on 2025-03-14 belongs to the night of 2025-03-13.
    var d = new Date(isoString);
    var hour = d.getHours();

    // If visit was between midnight and 6 AM, count it as the previous calendar day's night
    var visitDate = new Date(d);
    if (hour < 6) {
      visitDate.setDate(visitDate.getDate() - 1);
    }

    var yyyy = visitDate.getFullYear();
    var mm = String(visitDate.getMonth() + 1).padStart(2, "0");
    var dd = String(visitDate.getDate()).padStart(2, "0");
    return (yyyy + "-" + mm + "-" + dd) === dateStr;
  }

  /* ─── Generate replay data ─── */
  function generateReplay(date, venues) {
    var history = Crawl.loadHistory();
    var names = Object.keys(history);
    var matched = [];

    names.forEach(function (name) {
      var entry = history[name];
      var visitedAt = entry.visitedAt || null;
      // If no date filter or date matches, include
      if (matchesDate(visitedAt, date)) {
        var venueInfo = findVenue(venues, name);
        matched.push({
          name: name,
          rating: entry.rating || 0,
          visitedAt: visitedAt,
          area: venueInfo ? (venueInfo.Area || "") : "",
          category: venueInfo ? (venueInfo.Category || "") : "",
          vibes: venueInfo ? (venueInfo["Vibe Tags"] || "") : "",
          closingTime: venueInfo ? (venueInfo["Typical Closing Time"] || "") : "",
        });
      }
    });

    if (matched.length === 0) return null;

    // Sort by visit time
    matched.sort(function (a, b) {
      return new Date(a.visitedAt) - new Date(b.visitedAt);
    });

    // Compute stats
    var areas = {};
    var vibeCloud = {};
    var totalRating = 0;

    matched.forEach(function (v) {
      if (v.area) areas[v.area] = true;
      if (v.rating === 1) totalRating++;

      var tags = v.vibes.split(",").map(function (t) { return t.trim(); }).filter(Boolean);
      tags.forEach(function (tag) {
        vibeCloud[tag] = (vibeCloud[tag] || 0) + 1;
      });
    });

    // Longest streak in same area
    var longestStreak = 1;
    var currentStreak = 1;
    for (var i = 1; i < matched.length; i++) {
      if (matched[i].area && matched[i].area === matched[i - 1].area) {
        currentStreak++;
        if (currentStreak > longestStreak) longestStreak = currentStreak;
      } else {
        currentStreak = 1;
      }
    }

    // Night score (0-100)
    var varietyScore = Math.min(Object.keys(areas).length / 3, 1) * 25;
    var ratingScore = matched.length > 0 ? (totalRating / matched.length) * 30 : 0;
    var countScore = Math.min(matched.length / 5, 1) * 25;
    var vibeScore = Math.min(Object.keys(vibeCloud).length / 6, 1) * 20;
    var nightScore = Math.round(varietyScore + ratingScore + countScore + vibeScore);

    return {
      venues: matched,
      stats: {
        totalVenues: matched.length,
        neighborhoods: Object.keys(areas).length,
        vibesExplored: Object.keys(vibeCloud).length,
        totalRating: totalRating,
        longestStreak: longestStreak,
      },
      timeline: matched,
      vibeCloud: vibeCloud,
      nightScore: nightScore,
    };
  }

  /* ─── Format time from ISO string ─── */
  function formatTime(isoString) {
    if (!isoString) return "";
    var d = new Date(isoString);
    var h = d.getHours();
    var m = d.getMinutes();
    var ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return h + ":" + String(m).padStart(2, "0") + " " + ampm;
  }

  /* ─── Format date for display ─── */
  function formatDisplayDate(dateStr) {
    var parts = dateStr.split("-");
    var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    var days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return days[d.getDay()] + ", " + months[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
  }

  /* ─── Rating icon ─── */
  function ratingHTML(rating) {
    if (rating === 1) return '<span class="replay-stop-rating up" aria-label="Thumbs up">&#x1F44D;</span>';
    if (rating === -1) return '<span class="replay-stop-rating down" aria-label="Thumbs down">&#x1F44E;</span>';
    return "";
  }

  /* ─── Night score SVG ring ─── */
  function scoreRingHTML(score) {
    var radius = 42;
    var circumference = 2 * Math.PI * radius;
    var offset = circumference - (score / 100) * circumference;
    return '<div class="replay-night-score">' +
      '<div class="replay-score-ring">' +
        '<svg width="100" height="100" viewBox="0 0 100 100">' +
          '<circle cx="50" cy="50" r="' + radius + '" fill="none" stroke="#2a334d" stroke-width="6"/>' +
          '<circle cx="50" cy="50" r="' + radius + '" fill="none" stroke="#2bff86" stroke-width="6" ' +
            'stroke-dasharray="' + circumference + '" stroke-dashoffset="' + offset + '" stroke-linecap="round"/>' +
        '</svg>' +
        '<span class="replay-score-value">' + score + '</span>' +
      '</div>' +
      '<div class="replay-score-label">Night Score</div>' +
    '</div>';
  }

  /* ─── Vibe cloud HTML ─── */
  function vibeCloudHTML(vibeCloud) {
    var entries = Object.entries(vibeCloud).sort(function (a, b) { return b[1] - a[1]; });
    if (!entries.length) return "";

    var maxCount = entries[0][1];
    var html = '<div class="replay-section-title">Vibe Cloud</div><div class="replay-vibe-cloud">';

    entries.forEach(function (entry) {
      var tag = entry[0];
      var count = entry[1];
      var ratio = count / maxCount;
      var sizeClass = "size-1";
      if (ratio > 0.75) sizeClass = "size-4";
      else if (ratio > 0.5) sizeClass = "size-3";
      else if (ratio > 0.25) sizeClass = "size-2";
      html += '<span class="replay-vibe-tag ' + sizeClass + '">' + escapeHTML(tag) + '</span>';
    });

    html += '</div>';
    return html;
  }

  /* ─── Escape HTML ─── */
  function escapeHTML(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  /* ─── Render replay ─── */
  function renderReplay(data, dateStr) {
    var html = '';

    // Main replay card
    html += '<div class="replay-card">';
    html += '<div class="replay-card-header">';
    html += '<h2 class="replay-card-title">Your Night Out</h2>';
    html += '<span class="replay-card-date">' + formatDisplayDate(dateStr) + '</span>';
    html += '</div>';

    // Stats grid
    html += '<div class="replay-stats-grid">';
    html += '<div class="replay-stat"><div class="replay-stat-number">' + data.stats.totalVenues + '</div><div class="replay-stat-label">Venues</div></div>';
    html += '<div class="replay-stat"><div class="replay-stat-number">' + data.stats.neighborhoods + '</div><div class="replay-stat-label">Neighborhoods</div></div>';
    html += '<div class="replay-stat"><div class="replay-stat-number">' + data.stats.vibesExplored + '</div><div class="replay-stat-label">Vibes</div></div>';
    html += '<div class="replay-stat"><div class="replay-stat-number">' + data.stats.totalRating + '</div><div class="replay-stat-label">Liked</div></div>';
    html += '</div>';

    // Night score
    html += scoreRingHTML(data.nightScore);

    // Timeline
    html += '<div class="replay-section-title">Timeline</div>';
    html += '<div class="replay-timeline">';
    data.timeline.forEach(function (stop) {
      var ratingClass = stop.rating === 1 ? "" : (stop.rating === -1 ? " negative" : " neutral");
      html += '<div class="replay-timeline-stop' + ratingClass + '">';
      html += '<div class="replay-stop-time">' + formatTime(stop.visitedAt) + '</div>';
      html += '<div class="replay-stop-name">' + escapeHTML(stop.name) + ratingHTML(stop.rating) + '</div>';
      var meta = [];
      if (stop.area) meta.push(escapeHTML(stop.area));
      if (stop.category) meta.push(escapeHTML(stop.category));
      if (meta.length) html += '<div class="replay-stop-meta">' + meta.join(" &middot; ") + '</div>';
      html += '</div>';
    });
    html += '</div>';

    // Vibe cloud
    html += vibeCloudHTML(data.vibeCloud);

    html += '</div>'; // close replay-card

    // Share card
    html += renderShareCard(data, dateStr);

    // Action buttons
    html += '<div class="replay-actions">';
    html += '<button class="replay-btn replay-btn-primary" id="replayShare" type="button">';
    html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>';
    html += 'Share';
    html += '</button>';
    html += '<button class="replay-btn" id="replayDownload" type="button">';
    html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
    html += 'Download Card';
    html += '</button>';
    html += '</div>';

    contentEl.innerHTML = html;

    // Bind action buttons
    var shareBtn = document.getElementById("replayShare");
    var downloadBtn = document.getElementById("replayDownload");

    if (shareBtn) shareBtn.addEventListener("click", function () { handleShare(data, dateStr); });
    if (downloadBtn) downloadBtn.addEventListener("click", function () { handleDownload(data, dateStr); });
  }

  /* ─── Render shareable Night Card ─── */
  function renderShareCard(data, dateStr) {
    var topVibes = Object.entries(data.vibeCloud)
      .sort(function (a, b) { return b[1] - a[1]; })
      .slice(0, 4)
      .map(function (e) { return e[0]; });

    var html = '<div class="replay-share-card">';
    html += '<div class="replay-share-card-brand">Late Night Vibes</div>';
    html += '<h3 class="replay-share-card-title">Night Card &mdash; ' + formatDisplayDate(dateStr) + '</h3>';
    html += '<div class="replay-share-stats">';
    html += '<div class="replay-share-stat"><div class="replay-share-stat-number">' + data.stats.totalVenues + '</div><div class="replay-share-stat-label">Stops</div></div>';
    html += '<div class="replay-share-stat"><div class="replay-share-stat-number">' + data.nightScore + '</div><div class="replay-share-stat-label">Score</div></div>';
    html += '<div class="replay-share-stat"><div class="replay-share-stat-number">' + data.stats.neighborhoods + '</div><div class="replay-share-stat-label">Areas</div></div>';
    html += '</div>';
    if (topVibes.length) {
      html += '<p class="replay-share-vibes">' + topVibes.map(escapeHTML).join(" &middot; ") + '</p>';
    }
    html += '</div>';
    return html;
  }

  /* ─── Build text summary ─── */
  function buildTextSummary(data, dateStr) {
    var lines = [];
    lines.push("Night Replay - " + formatDisplayDate(dateStr));
    lines.push("Night Score: " + data.nightScore + "/100");
    lines.push("");
    lines.push("Stats: " + data.stats.totalVenues + " venues, " + data.stats.neighborhoods + " neighborhoods, " + data.stats.vibesExplored + " vibes explored");
    lines.push("");
    lines.push("Timeline:");
    data.timeline.forEach(function (stop, i) {
      var rating = stop.rating === 1 ? " [liked]" : (stop.rating === -1 ? " [disliked]" : "");
      var area = stop.area ? " (" + stop.area + ")" : "";
      lines.push((i + 1) + ". " + formatTime(stop.visitedAt) + " - " + stop.name + area + rating);
    });

    var topVibes = Object.entries(data.vibeCloud)
      .sort(function (a, b) { return b[1] - a[1]; })
      .slice(0, 6)
      .map(function (e) { return e[0]; });

    if (topVibes.length) {
      lines.push("");
      lines.push("Top vibes: " + topVibes.join(", "));
    }

    lines.push("");
    lines.push("- Late Night Vibes");
    return lines.join("\n");
  }

  /* ─── Share handler ─── */
  function handleShare(data, dateStr) {
    var text = buildTextSummary(data, dateStr);

    if (navigator.share) {
      navigator.share({
        title: "Night Replay - " + formatDisplayDate(dateStr),
        text: text,
      }).catch(function () {
        // User cancelled or error — fall back to clipboard
        copyToClipboard(text);
      });
    } else {
      copyToClipboard(text);
    }
  }

  /* ─── Download handler ─── */
  function handleDownload(data, dateStr) {
    var text = buildTextSummary(data, dateStr);
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

  /* ─── Toast notification ─── */
  function showToast(msg) {
    var existing = document.querySelector(".replay-toast");
    if (existing) existing.remove();

    var toast = document.createElement("div");
    toast.className = "replay-toast";
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

  /* ─── Main generate handler ─── */
  function onGenerate() {
    var date = dateInput.value;
    if (!date) {
      showToast("Please select a date");
      return;
    }

    loadVenueData(function (venues) {
      var data = generateReplay(date, venues);
      if (!data) {
        contentEl.innerHTML = '';
        contentEl.appendChild(emptyEl);
        emptyEl.style.display = "";
        emptyEl.querySelector(".replay-empty-desc").textContent =
          'No venues found for ' + formatDisplayDate(date) + '. Make sure you mark venues as "Been There" while you\'re out!';
        return;
      }
      renderReplay(data, date);
    });
  }

  /* ─── Wire up ─── */
  initDate();
  generateBtn.addEventListener("click", onGenerate);

})();
