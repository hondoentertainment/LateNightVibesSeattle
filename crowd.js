/**
 * Crowd Predictions — page controller.
 * Drives venue selection, chart rendering, crowd reports, and quiet-venues list.
 */
(function () {
  "use strict";

  var DEFAULT_CSV = (window.LNVCities && window.LNVCities.getCurrentCity().csv) || "data/seattle.csv";
  var allVenues = [];

  var $ = function (id) { return document.getElementById(id); };

  var CP = window.LNVCrowdPredictor;
  var Core = window.LNVCore;

  var HOUR_LABELS = {
    18: "6p", 19: "7p", 20: "8p", 21: "9p", 22: "10p",
    23: "11p", 0: "12a", 1: "1a", 2: "2a", 3: "3a",
  };

  var LEVEL_EMOJIS = ["", "\uD83D\uDE34", "\uD83D\uDE0C", "\uD83D\uDE42", "\uD83D\uDE04", "\uD83E\uDD29"];
  var HOURS = [18, 19, 20, 21, 22, 23, 0, 1, 2, 3];

  /* ─── Load venue data ─── */
  function loadVenues() {
    fetch(DEFAULT_CSV)
      .then(function (res) { return res.text(); })
      .then(function (text) {
        allVenues = Core.loadDataFromCSV(text);
        populateSelect();
        renderQuietVenues();
      })
      .catch(function () {
        allVenues = [];
      });
  }

  /* ─── Populate venue selector ─── */
  function populateSelect() {
    var select = $("venueSelect");
    if (!select) return;

    var names = allVenues
      .map(function (v) { return v.Name; })
      .filter(Boolean)
      .sort();

    names.forEach(function (name) {
      var opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    });
  }

  /* ─── Get category for venue ─── */
  function getCategory(venueName) {
    for (var i = 0; i < allVenues.length; i++) {
      if (allVenues[i].Name === venueName) {
        return allVenues[i].Category || null;
      }
    }
    return null;
  }

  /* ─── Render current prediction card ─── */
  function renderCurrentPrediction(venueName) {
    var el = $("currentPrediction");
    if (!el) return;

    var cat = getCategory(venueName);
    var current = CP.getCurrentPrediction(venueName, cat);
    if (!current) { el.style.display = "none"; return; }

    var wait = CP.estimateWaitTime(venueName, current.dayOfWeek, current.hour, cat);
    var best = CP.getBestTimeToVisit(venueName, cat);

    var liveHTML = current.hasLiveData
      ? '<span class="live-badge">Live</span>'
      : '';

    var bestHTML = best
      ? '<div class="crowd-best-time"><strong>Best time to visit:</strong> ' + best.label + '</div>'
      : '';

    el.innerHTML =
      '<div class="crowd-current-header">' +
        '<span class="crowd-current-title">Right Now</span>' +
        liveHTML +
      '</div>' +
      '<div class="crowd-level-display">' +
        '<span class="crowd-level-number">' + current.level + '/5</span>' +
        '<div class="crowd-level-info">' +
          '<span class="crowd-level-label">' + current.label + '</span>' +
          '<span class="crowd-wait-label">Est. wait: ' + wait.label + '</span>' +
        '</div>' +
      '</div>' +
      (current.hasLiveData ? '<div class="crowd-wait-label" style="font-size:12px;">' + current.reportCount + ' recent report' + (current.reportCount !== 1 ? 's' : '') + '</div>' : '') +
      bestHTML;

    el.style.display = "block";
  }

  /* ─── Render popular times bar chart ─── */
  function renderChart(venueName) {
    var section = $("chartSection");
    var chart = $("crowdChart");
    if (!section || !chart) return;

    var cat = getCategory(venueName);
    var now = new Date();
    var currentHour = now.getHours();

    chart.innerHTML = "";

    HOURS.forEach(function (hour) {
      var prediction = CP.predictCrowdLevel(venueName, now.getDay(), hour, cat);
      var wrapper = document.createElement("div");
      wrapper.className = "crowd-bar-wrapper";

      var bar = document.createElement("div");
      bar.className = "crowd-bar level-" + prediction.level;
      if (hour === currentHour) bar.className += " current-hour";
      bar.title = prediction.label + " at " + HOUR_LABELS[hour];
      bar.setAttribute("aria-label", prediction.label + " at " + HOUR_LABELS[hour]);

      var label = document.createElement("span");
      label.className = "crowd-bar-label";
      label.textContent = HOUR_LABELS[hour];

      wrapper.appendChild(bar);
      wrapper.appendChild(label);
      chart.appendChild(wrapper);
    });

    section.style.display = "block";
  }

  /* ─── Render report buttons ─── */
  function renderReportButtons(venueName) {
    var section = $("reportSection");
    var container = $("reportButtons");
    if (!section || !container) return;

    var levels = CP.LEVELS;
    container.innerHTML = "";

    levels.forEach(function (label, idx) {
      var lvl = idx + 1;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "crowd-report-btn";
      btn.setAttribute("aria-label", "Report crowd level: " + label);
      btn.innerHTML = '<span class="crowd-report-emoji" aria-hidden="true">' + LEVEL_EMOJIS[lvl] + '</span>' + label;
      btn.addEventListener("click", function () {
        var result = CP.reportCrowdLevel(venueName, lvl);
        if (result) {
          Core.showToast("Thanks! Reported as " + label);
          onVenueChange(venueName);
        } else {
          Core.showToast("Please wait before reporting again", "error");
        }
      });
      container.appendChild(btn);
    });

    section.style.display = "block";
  }

  /* ─── Render quiet venues ─── */
  function renderQuietVenues() {
    var section = $("quietSection");
    var list = $("quietList");
    if (!section || !list) return;

    var quiet = CP.getQuietVenuesNow(allVenues);
    var top = quiet.slice(0, 8);

    if (top.length === 0) {
      section.style.display = "none";
      return;
    }

    list.innerHTML = "";
    top.forEach(function (v) {
      if (v.level > 3) return; // Only show quiet-ish venues
      var li = document.createElement("li");
      li.className = "crowd-quiet-item";
      li.innerHTML =
        '<span class="crowd-quiet-name">' + v.venueName + '</span>' +
        '<span class="crowd-quiet-badge level-' + v.level + '">' + v.label + '</span>';
      list.appendChild(li);
    });

    section.style.display = list.children.length > 0 ? "block" : "none";
  }

  /* ─── Venue change handler ─── */
  function onVenueChange(venueName) {
    var empty = $("emptyState");
    if (!venueName) {
      $("currentPrediction").style.display = "none";
      $("chartSection").style.display = "none";
      $("reportSection").style.display = "none";
      if (empty) empty.style.display = "block";
      return;
    }

    if (empty) empty.style.display = "none";
    renderCurrentPrediction(venueName);
    renderChart(venueName);
    renderReportButtons(venueName);
  }

  /* ─── Init ─── */
  function init() {
    loadVenues();

    var select = $("venueSelect");
    if (select) {
      select.addEventListener("change", function () {
        onVenueChange(this.value);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
