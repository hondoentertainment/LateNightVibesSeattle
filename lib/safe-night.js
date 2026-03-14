/**
 * Safe Night — integrated safety toolkit for nightlife users.
 * UMD module → window.LNVSafeNight
 *
 * Features: emergency contacts, fake call, buddy system, rideshare links,
 * walking safety tips, late-hour detection.
 */
(function (exports) {
  "use strict";

  var CONTACTS_KEY = "lnv_emergency_contacts";
  var BUDDY_KEY = "lnv_buddy_mode";
  var CHECKIN_KEY = "lnv_buddy_checkins";
  var MAX_CONTACTS = 3;

  /* ─── Emergency Contacts ─── */

  function saveEmergencyContacts(contacts) {
    if (!Array.isArray(contacts)) return;
    var trimmed = contacts.slice(0, MAX_CONTACTS).map(function (c) {
      return { name: String(c.name || "").trim(), phone: String(c.phone || "").trim() };
    }).filter(function (c) { return c.name && c.phone; });
    try { localStorage.setItem(CONTACTS_KEY, JSON.stringify(trimmed)); } catch (_e) { /* quota */ }
    return trimmed;
  }

  function getEmergencyContacts() {
    try {
      var raw = localStorage.getItem(CONTACTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_e) { return []; }
  }

  function generateEmergencyMessage(location) {
    var loc = location || "an unknown location";
    return "Hey, I need help. I'm at " + loc + ". Can you come get me? Sent from Late Night Vibes Safety";
  }

  /* ─── Fake Call ─── */

  var _fakeCallTimer = null;
  var _fakeCallOverlay = null;

  function _buildFakeCallUI() {
    if (_fakeCallOverlay) return _fakeCallOverlay;

    var overlay = document.createElement("div");
    overlay.className = "safety-fake-call";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Incoming call");
    overlay.innerHTML =
      '<div class="fake-call-inner">' +
        '<div class="fake-call-icon">' +
          '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#2bff86" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 10-16 0"/></svg>' +
        '</div>' +
        '<div class="fake-call-label">Incoming Call</div>' +
        '<div class="fake-call-name">Mom</div>' +
        '<div class="fake-call-status">mobile</div>' +
        '<div class="fake-call-actions">' +
          '<button class="fake-call-btn fake-call-decline" type="button" aria-label="Decline call">' +
            '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45 11.6 11.6 0 003.63.59 2 2 0 012 2v3a2 2 0 01-2.18 2A19.79 19.79 0 013.07 4.18 2 2 0 015 2h3a2 2 0 012 1.72 11.6 11.6 0 00.59 3.63 2 2 0 01-.45 2.11z"/></svg>' +
            '<span>Decline</span>' +
          '</button>' +
          '<button class="fake-call-btn fake-call-answer" type="button" aria-label="Answer call">' +
            '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2A19.79 19.79 0 013.07 4.18 2 2 0 015 2h3a2 2 0 012 1.72 11.6 11.6 0 00.59 3.63 2 2 0 01-.45 2.11L8.09 11.5a16 16 0 006.41 6.41l2.04-2.04a2 2 0 012.11-.45 11.6 11.6 0 003.63.59 2 2 0 011.72 2z"/></svg>' +
            '<span>Answer</span>' +
          '</button>' +
        '</div>' +
      '</div>';

    overlay.querySelector(".fake-call-answer").addEventListener("click", stopFakeCall);
    overlay.querySelector(".fake-call-decline").addEventListener("click", stopFakeCall);

    _fakeCallOverlay = overlay;
    return overlay;
  }

  function triggerFakeCall(delaySeconds) {
    var delay = (typeof delaySeconds === "number" && delaySeconds > 0) ? delaySeconds : 15;
    if (_fakeCallTimer) clearTimeout(_fakeCallTimer);

    _fakeCallTimer = setTimeout(function () {
      var overlay = _buildFakeCallUI();
      if (!overlay.parentNode) document.body.appendChild(overlay);
      overlay.classList.add("active");
      // Vibration pattern
      if (navigator.vibrate) {
        navigator.vibrate([300, 200, 300, 200, 300, 200, 300, 200, 300]);
      }
    }, delay * 1000);
  }

  function stopFakeCall() {
    if (_fakeCallTimer) { clearTimeout(_fakeCallTimer); _fakeCallTimer = null; }
    if (navigator.vibrate) navigator.vibrate(0);
    if (_fakeCallOverlay) {
      _fakeCallOverlay.classList.remove("active");
    }
  }

  /* ─── Buddy System ─── */

  function enableBuddyMode(buddyName) {
    var data = { buddyName: String(buddyName || "").trim(), enabledAt: Date.now(), active: true };
    try { localStorage.setItem(BUDDY_KEY, JSON.stringify(data)); } catch (_e) { /* quota */ }
    // Record initial check-in
    checkIn();
    return data;
  }

  function disableBuddyMode() {
    try { localStorage.removeItem(BUDDY_KEY); } catch (_e) { /* noop */ }
  }

  function checkBuddyStatus() {
    try {
      var raw = localStorage.getItem(BUDDY_KEY);
      if (!raw) return { active: false, buddyName: "" };
      return JSON.parse(raw);
    } catch (_e) { return { active: false, buddyName: "" }; }
  }

  function checkIn() {
    var ts = Date.now();
    try { localStorage.setItem(CHECKIN_KEY, JSON.stringify(ts)); } catch (_e) { /* quota */ }
    return ts;
  }

  function getLastCheckIn() {
    try {
      var raw = localStorage.getItem(CHECKIN_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_e) { return null; }
  }

  function isCheckInOverdue(intervalMinutes) {
    var interval = (typeof intervalMinutes === "number" && intervalMinutes > 0) ? intervalMinutes : 30;
    var last = getLastCheckIn();
    if (!last) return true;
    return (Date.now() - last) > interval * 60 * 1000;
  }

  /* ─── Rideshare Links ─── */

  function getRideshareLinks(lat, lng, destLat, destLng) {
    var links = [
      {
        name: "Uber",
        url: "https://m.uber.com/ul/?pickup[latitude]=" + lat + "&pickup[longitude]=" + lng,
        icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H8v-3h3v3zm5-5h-3V8h3v3z"/></svg>'
      },
      {
        name: "Lyft",
        url: "https://www.lyft.com/ride?start[latitude]=" + lat + "&start[longitude]=" + lng,
        icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14h-2V8h2v8z"/></svg>'
      }
    ];

    if (destLat != null && destLng != null) {
      links[0].url += "&dropoff[latitude]=" + destLat + "&dropoff[longitude]=" + destLng;
      links[1].url += "&destination[latitude]=" + destLat + "&destination[longitude]=" + destLng;
    }

    return links;
  }

  /* ─── Walking Safety ─── */

  function getWalkingSafetyTips() {
    return [
      "Stay on well-lit streets and main roads whenever possible.",
      "Keep your phone charged — carry a portable battery if you can.",
      "Share your live location with a trusted friend before you head out.",
      "Walk confidently and stay aware of your surroundings — avoid headphones.",
      "Stick to areas you know, especially late at night.",
      "Trust your instincts — if something feels off, change your route.",
      "Walk with a buddy whenever possible; there's safety in numbers.",
      "Keep your belongings secure and close to your body.",
      "If you feel followed, head to the nearest open business or well-lit area.",
      "Have your rideshare app ready as a backup plan."
    ];
  }

  function isLateHour() {
    var hour = new Date().getHours();
    return hour >= 23 || hour < 5;
  }

  /* ─── Safety Tips ─── */

  function getNightlifeSafetyTips() {
    return [
      { category: "Drinks", tips: [
        "Never leave your drink unattended — get a new one if you do.",
        "Watch your drink being made and carried to you.",
        "Pace yourself and alternate alcoholic drinks with water.",
        "Know your limits and stick to them.",
        "Use a drink cover or test strip if available."
      ]},
      { category: "Transportation", tips: [
        "Plan your ride home before you go out.",
        "Never get in an unmarked car — verify the license plate and driver.",
        "Share your ride details with a friend.",
        "Keep cash for a cab as backup.",
        "Avoid walking alone in unfamiliar areas late at night."
      ]},
      { category: "Awareness", tips: [
        "Stay with your group and check in with each other regularly.",
        "Keep your phone charged and accessible.",
        "Know where the exits are when you enter a venue.",
        "Trust your gut — if something feels wrong, leave.",
        "Ask bar staff for help if you feel unsafe — they are trained to assist."
      ]},
      { category: "Planning", tips: [
        "Tell someone your plans for the night and expected return time.",
        "Set a budget and bring limited cash to avoid overspending.",
        "Eat a solid meal before heading out.",
        "Charge your phone fully and bring a portable charger.",
        "Identify a safe meeting point in case you get separated from friends."
      ]}
    ];
  }

  /* ─── Public API ─── */

  exports.saveEmergencyContacts = saveEmergencyContacts;
  exports.getEmergencyContacts = getEmergencyContacts;
  exports.generateEmergencyMessage = generateEmergencyMessage;
  exports.triggerFakeCall = triggerFakeCall;
  exports.stopFakeCall = stopFakeCall;
  exports.enableBuddyMode = enableBuddyMode;
  exports.disableBuddyMode = disableBuddyMode;
  exports.checkBuddyStatus = checkBuddyStatus;
  exports.checkIn = checkIn;
  exports.getLastCheckIn = getLastCheckIn;
  exports.isCheckInOverdue = isCheckInOverdue;
  exports.getRideshareLinks = getRideshareLinks;
  exports.getWalkingSafetyTips = getWalkingSafetyTips;
  exports.isLateHour = isLateHour;
  exports.getNightlifeSafetyTips = getNightlifeSafetyTips;
  exports.MAX_CONTACTS = MAX_CONTACTS;

})(typeof module !== "undefined" ? module.exports : (window.LNVSafeNight = window.LNVSafeNight || {}));
