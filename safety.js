/**
 * Safety page controller.
 * Wires up the Safe Night dashboard: emergency contacts, fake call,
 * buddy system, rideshare links, and safety tips.
 */
(function () {
  "use strict";

  var SN = window.LNVSafeNight;
  if (!SN) { console.warn("LNVSafeNight not loaded"); return; }

  /* ═══════════════════════════════════════════
     State
     ═══════════════════════════════════════════ */

  var currentLat = null;
  var currentLng = null;
  var currentAddress = "my current location";
  var buddyTimerInterval = null;
  var fakeCallCountdownTimer = null;
  var editingContactIndex = -1;

  /* ═══════════════════════════════════════════
     Geolocation
     ═══════════════════════════════════════════ */

  function requestLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        currentLat = pos.coords.latitude;
        currentLng = pos.coords.longitude;
        currentAddress = currentLat.toFixed(5) + ", " + currentLng.toFixed(5);
        updateRideshareLinks();
      },
      function () { /* user denied — features still work with fallback text */ },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  /* ═══════════════════════════════════════════
     Emergency Contacts
     ═══════════════════════════════════════════ */

  function renderContacts() {
    var list = document.getElementById("contactsList");
    var contacts = SN.getEmergencyContacts();
    var addForm = document.getElementById("addContactForm");

    if (!contacts.length) {
      list.innerHTML = '<div class="safety-contacts-empty">No emergency contacts yet. Add up to 3 below.</div>';
      addForm.style.display = "";
      return;
    }

    var html = "";
    contacts.forEach(function (c, i) {
      var msg = encodeURIComponent(SN.generateEmergencyMessage(currentAddress));
      var phone = encodeURIComponent(c.phone);
      html +=
        '<div class="safety-contact-card" data-index="' + i + '">' +
          '<div class="safety-contact-info">' +
            '<div class="safety-contact-name">' + escapeHtml(c.name) + '</div>' +
            '<div class="safety-contact-phone">' + escapeHtml(c.phone) + '</div>' +
          '</div>' +
          '<div class="safety-contact-actions">' +
            '<a href="sms:' + phone + '?body=' + msg + '" class="safety-alert-btn" aria-label="Send emergency alert to ' + escapeHtml(c.name) + '">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>' +
              ' Alert' +
            '</a>' +
            '<button type="button" class="safety-contact-edit-btn" data-action="edit" data-index="' + i + '" aria-label="Edit ' + escapeHtml(c.name) + '">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
            '</button>' +
            '<button type="button" class="safety-contact-delete-btn" data-action="delete" data-index="' + i + '" aria-label="Delete ' + escapeHtml(c.name) + '">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m5 0V4a1 1 0 011-1h2a1 1 0 011 1v2"/></svg>' +
            '</button>' +
          '</div>' +
        '</div>';
    });

    list.innerHTML = html;
    addForm.style.display = contacts.length >= SN.MAX_CONTACTS ? "none" : "";

    // delegate contact actions
    list.querySelectorAll("[data-action]").forEach(function (btn) {
      btn.addEventListener("click", handleContactAction);
    });
  }

  function handleContactAction(e) {
    var btn = e.currentTarget;
    var action = btn.getAttribute("data-action");
    var index = parseInt(btn.getAttribute("data-index"), 10);
    var contacts = SN.getEmergencyContacts();

    if (action === "delete") {
      contacts.splice(index, 1);
      SN.saveEmergencyContacts(contacts);
      renderContacts();
    } else if (action === "edit") {
      var c = contacts[index];
      document.getElementById("contactNameInput").value = c.name;
      document.getElementById("contactPhoneInput").value = c.phone;
      editingContactIndex = index;
      document.getElementById("addContactBtn").textContent = "Save";
      document.getElementById("contactNameInput").focus();
    }
  }

  function initContactForm() {
    var form = document.getElementById("addContactForm");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = document.getElementById("contactNameInput").value.trim();
      var phone = document.getElementById("contactPhoneInput").value.trim();
      if (!name || !phone) return;

      var contacts = SN.getEmergencyContacts();
      if (editingContactIndex >= 0 && editingContactIndex < contacts.length) {
        contacts[editingContactIndex] = { name: name, phone: phone };
        editingContactIndex = -1;
        document.getElementById("addContactBtn").textContent = "Add";
      } else {
        if (contacts.length >= SN.MAX_CONTACTS) return;
        contacts.push({ name: name, phone: phone });
      }
      SN.saveEmergencyContacts(contacts);
      document.getElementById("contactNameInput").value = "";
      document.getElementById("contactPhoneInput").value = "";
      renderContacts();
    });
  }

  /* ═══════════════════════════════════════════
     Fake Call
     ═══════════════════════════════════════════ */

  function initFakeCall() {
    var fakeCallBtn = document.getElementById("fakeCallBtn");
    var picker = document.getElementById("fakeCallDelayPicker");
    var pending = document.getElementById("fakeCallPending");
    var pendingText = document.getElementById("fakeCallPendingText");
    var cancelBtn = document.getElementById("cancelFakeCallBtn");

    fakeCallBtn.addEventListener("click", function () {
      var isOpen = picker.classList.toggle("active");
      fakeCallBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    picker.querySelectorAll(".safety-delay-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var delay = parseInt(btn.getAttribute("data-delay"), 10);
        SN.triggerFakeCall(delay);

        picker.classList.remove("active");
        pending.classList.add("active");
        fakeCallBtn.disabled = true;

        // countdown
        var remaining = delay;
        pendingText.textContent = "Fake call in " + remaining + "s...";
        fakeCallCountdownTimer = setInterval(function () {
          remaining--;
          if (remaining <= 0) {
            clearInterval(fakeCallCountdownTimer);
            fakeCallCountdownTimer = null;
            pending.classList.remove("active");
            fakeCallBtn.disabled = false;
          } else {
            pendingText.textContent = "Fake call in " + remaining + "s...";
          }
        }, 1000);
      });
    });

    cancelBtn.addEventListener("click", function () {
      SN.stopFakeCall();
      if (fakeCallCountdownTimer) { clearInterval(fakeCallCountdownTimer); fakeCallCountdownTimer = null; }
      pending.classList.remove("active");
      fakeCallBtn.disabled = false;
    });
  }

  /* ═══════════════════════════════════════════
     Share Location
     ═══════════════════════════════════════════ */

  function initShareLocation() {
    document.getElementById("shareLocationBtn").addEventListener("click", function () {
      if (!currentLat || !currentLng) {
        // try to get location first
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(function (pos) {
            currentLat = pos.coords.latitude;
            currentLng = pos.coords.longitude;
            doShareLocation();
          }, function () {
            alert("Could not access your location. Please enable location services.");
          }, { enableHighAccuracy: true, timeout: 8000 });
        } else {
          alert("Geolocation is not supported by your browser.");
        }
        return;
      }
      doShareLocation();
    });
  }

  function doShareLocation() {
    var mapsUrl = "https://www.google.com/maps?q=" + currentLat + "," + currentLng;
    var text = "I'm here: " + mapsUrl + " (" + currentLat.toFixed(5) + ", " + currentLng.toFixed(5) + ")";

    if (navigator.share) {
      navigator.share({ title: "My Location", text: text, url: mapsUrl }).catch(function () {});
    } else {
      // fallback: copy to clipboard
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          showToast("Location copied to clipboard");
        });
      } else {
        window.prompt("Copy your location:", text);
      }
    }
  }

  /* ═══════════════════════════════════════════
     Rideshare Links
     ═══════════════════════════════════════════ */

  function updateRideshareLinks() {
    if (!currentLat || !currentLng) return;
    var links = SN.getRideshareLinks(currentLat, currentLng);
    links.forEach(function (link) {
      if (link.name === "Uber") {
        document.getElementById("uberLink").href = link.url;
      } else if (link.name === "Lyft") {
        document.getElementById("lyftLink").href = link.url;
      }
    });
  }

  /* ═══════════════════════════════════════════
     Buddy System
     ═══════════════════════════════════════════ */

  function initBuddySystem() {
    var toggle = document.getElementById("buddyToggle");
    var config = document.getElementById("buddyConfig");
    var nameInput = document.getElementById("buddyNameInput");
    var intervalSelect = document.getElementById("buddyIntervalSelect");
    var checkinBtn = document.getElementById("buddyCheckinBtn");
    var quickCheckinBtn = document.getElementById("quickCheckinBtn");
    var statusDot = document.getElementById("buddyStatusDot");
    var label = document.getElementById("buddyToggleLabel");
    var timerContainer = document.getElementById("buddyCheckinTimer");

    // Restore state
    var status = SN.checkBuddyStatus();
    if (status && status.active) {
      toggle.checked = true;
      config.classList.add("active");
      nameInput.value = status.buddyName || "";
      timerContainer.style.display = "";
      quickCheckinBtn.style.display = "";
      statusDot.style.display = "";
      label.textContent = "Buddy Mode: " + (status.buddyName || "Active");
      startBuddyTimer();
      requestNotificationPermission();
    }

    toggle.addEventListener("change", function () {
      if (toggle.checked) {
        config.classList.add("active");
        var buddyName = nameInput.value.trim() || "My Buddy";
        SN.enableBuddyMode(buddyName);
        timerContainer.style.display = "";
        quickCheckinBtn.style.display = "";
        statusDot.style.display = "";
        label.textContent = "Buddy Mode: " + buddyName;
        startBuddyTimer();
        requestNotificationPermission();
      } else {
        config.classList.remove("active");
        SN.disableBuddyMode();
        stopBuddyTimer();
        timerContainer.style.display = "none";
        quickCheckinBtn.style.display = "none";
        statusDot.style.display = "none";
        label.textContent = "Enable Buddy Mode";
      }
    });

    nameInput.addEventListener("change", function () {
      if (toggle.checked) {
        var name = nameInput.value.trim() || "My Buddy";
        SN.enableBuddyMode(name);
        label.textContent = "Buddy Mode: " + name;
      }
    });

    intervalSelect.addEventListener("change", function () {
      if (toggle.checked) {
        startBuddyTimer(); // restart with new interval
      }
    });

    checkinBtn.addEventListener("click", function () {
      doCheckIn();
    });

    quickCheckinBtn.addEventListener("click", function () {
      doCheckIn();
    });
  }

  function doCheckIn() {
    SN.checkIn();
    updateBuddyDisplay();
    showToast("Checked in!");
  }

  function startBuddyTimer() {
    stopBuddyTimer();
    updateBuddyDisplay();
    buddyTimerInterval = setInterval(updateBuddyDisplay, 1000);
  }

  function stopBuddyTimer() {
    if (buddyTimerInterval) { clearInterval(buddyTimerInterval); buddyTimerInterval = null; }
  }

  function updateBuddyDisplay() {
    var intervalSelect = document.getElementById("buddyIntervalSelect");
    var countdownEl = document.getElementById("checkinCountdown");
    var statusDot = document.getElementById("buddyStatusDot");
    var intervalMins = parseInt(intervalSelect.value, 10) || 30;
    var last = SN.getLastCheckIn();

    if (!last) {
      countdownEl.textContent = "00:00";
      countdownEl.className = "safety-checkin-countdown overdue";
      statusDot.className = "safety-buddy-status safety-buddy-status--red";
      return;
    }

    var elapsed = Date.now() - last;
    var total = intervalMins * 60 * 1000;
    var remaining = total - elapsed;

    if (remaining <= 0) {
      // overdue
      countdownEl.textContent = "OVERDUE";
      countdownEl.className = "safety-checkin-countdown overdue";
      statusDot.className = "safety-buddy-status safety-buddy-status--red";
      sendOverdueNotification();
    } else if (remaining < 5 * 60 * 1000) {
      // warning: less than 5 minutes
      countdownEl.textContent = formatTime(remaining);
      countdownEl.className = "safety-checkin-countdown warning";
      statusDot.className = "safety-buddy-status safety-buddy-status--yellow";
    } else {
      // green
      countdownEl.textContent = formatTime(remaining);
      countdownEl.className = "safety-checkin-countdown";
      statusDot.className = "safety-buddy-status safety-buddy-status--green";
    }
  }

  function formatTime(ms) {
    var totalSec = Math.max(0, Math.ceil(ms / 1000));
    var m = Math.floor(totalSec / 60);
    var s = totalSec % 60;
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }

  var _lastNotificationTime = 0;

  function sendOverdueNotification() {
    // throttle: at most once every 60 seconds
    var now = Date.now();
    if (now - _lastNotificationTime < 60000) return;

    if ("Notification" in window && Notification.permission === "granted") {
      _lastNotificationTime = now;
      try {
        new Notification("Check In Overdue", {
          body: "Your buddy check-in is overdue. Tap to check in.",
          icon: "favicon-512.png",
          tag: "buddy-checkin-overdue",
          requireInteraction: true
        });
      } catch (_e) { /* notification API not available */ }
    }
  }

  function requestNotificationPermission() {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }

  /* ═══════════════════════════════════════════
     Walking Tips & Safety Tips
     ═══════════════════════════════════════════ */

  function renderWalkingTips() {
    var tips = SN.getWalkingSafetyTips();
    var ul = document.getElementById("walkingTipsList");
    ul.innerHTML = tips.map(function (t) { return "<li>" + escapeHtml(t) + "</li>"; }).join("");

    var container = document.getElementById("walkingTips");
    var header = container.querySelector(".safety-walking-tips-header");
    header.addEventListener("click", function () {
      var open = container.classList.toggle("open");
      header.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  function renderSafetyTips() {
    var categories = SN.getNightlifeSafetyTips ? SN.getNightlifeSafetyTips() : [];
    var list = document.getElementById("safetyTipsList");
    if (!categories.length) { list.innerHTML = ""; return; }

    var html = "";
    categories.forEach(function (cat) {
      var tipsHtml = cat.tips.map(function (t) { return "<li>" + escapeHtml(t) + "</li>"; }).join("");
      html +=
        '<div class="safety-tips-category">' +
          '<button type="button" class="safety-tips-category-header" aria-expanded="false">' +
            escapeHtml(cat.category) +
            '<svg class="safety-tips-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>' +
          '</button>' +
          '<div class="safety-tips-body"><ul>' + tipsHtml + '</ul></div>' +
        '</div>';
    });

    list.innerHTML = html;

    // toggle each category
    list.querySelectorAll(".safety-tips-category-header").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var cat = btn.parentElement;
        var open = cat.classList.toggle("open");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
      });
    });
  }

  /* ═══════════════════════════════════════════
     Late Hour Banner
     ═══════════════════════════════════════════ */

  function checkLateHour() {
    var banner = document.getElementById("lateHourBanner");
    if (SN.isLateHour()) {
      banner.style.display = "";
    } else {
      banner.style.display = "none";
    }
  }

  /* ═══════════════════════════════════════════
     Utilities
     ═══════════════════════════════════════════ */

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function showToast(message) {
    var toast = document.createElement("div");
    toast.textContent = message;
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.style.cssText =
      "position:fixed;bottom:100px;left:50%;transform:translateX(-50%);" +
      "background:#1a2235;color:#e8e8e8;padding:10px 20px;border-radius:10px;" +
      "font-size:14px;font-weight:500;z-index:99999;border:1px solid #2a334d;" +
      "box-shadow:0 4px 16px rgba(0,0,0,0.4);opacity:0;transition:opacity 0.3s ease;";
    document.body.appendChild(toast);
    requestAnimationFrame(function () { toast.style.opacity = "1"; });
    setTimeout(function () {
      toast.style.opacity = "0";
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 2000);
  }

  /* ═══════════════════════════════════════════
     Init
     ═══════════════════════════════════════════ */

  function init() {
    requestLocation();
    initContactForm();
    renderContacts();
    initFakeCall();
    initShareLocation();
    initBuddySystem();
    renderWalkingTips();
    renderSafetyTips();
    checkLateHour();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
