/**
 * Late Night Vibes — Squad Sync: group night coordination.
 *
 * Create voting sessions, share via URL-encoded state, cast votes,
 * and tally results. All data lives in localStorage + URL hash.
 *
 * UMD export: window.LNVSquadSync in browser, module.exports in Node.
 */
(function (exports) {
  "use strict";

  var STORAGE_KEY = "lnv_squad_sessions";

  /* ─── City-scoped key helpers ─── */

  function _cities() {
    if (typeof module !== "undefined") return require("./cities");
    return (typeof window !== "undefined" && window.LNVCities) || null;
  }

  function _scopedKey() {
    var c = _cities();
    return c && c.getCityKey ? c.getCityKey(STORAGE_KEY) : STORAGE_KEY;
  }

  function _migrate() {
    var c = _cities();
    if (c && c.migrateKeyIfNeeded) c.migrateKeyIfNeeded(STORAGE_KEY);
  }

  /* ─── Helpers ─── */

  function generateId() {
    var chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    var id = "";
    for (var i = 0; i < 6; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }

  function getAllSessions() {
    try {
      _migrate();
      return JSON.parse(localStorage.getItem(_scopedKey())) || {};
    } catch (e) {
      return {};
    }
  }

  function saveSession(session) {
    var sessions = getAllSessions();
    sessions[session.sessionId] = session;
    localStorage.setItem(_scopedKey(), JSON.stringify(sessions));
  }

  function getSession(sessionId) {
    return getAllSessions()[sessionId] || null;
  }

  /* ─── Create session ─── */

  function createSession(hostName, filters, allVenues) {
    var f = filters || {};
    var area = (f.area || "").toLowerCase();
    var category = (f.category || "").toLowerCase();
    var vibes = (f.vibes || []).map(function (v) { return v.toLowerCase(); });
    var maxVenues = f.maxVenues || 10;

    /* Filter venues */
    var candidates = allVenues.filter(function (v) {
      if (!v.Name) return false;
      if (area && (v.Area || "").toLowerCase().indexOf(area) === -1) return false;
      if (category && (v.Category || "").toLowerCase().indexOf(category) === -1) return false;
      if (vibes.length) {
        var venueTags = (v["Vibe Tags"] || "").toLowerCase();
        var hasAny = vibes.some(function (vb) { return venueTags.indexOf(vb) !== -1; });
        if (!hasAny) return false;
      }
      return true;
    });

    /* Shuffle and limit */
    candidates = shuffle(candidates).slice(0, maxVenues);

    var session = {
      sessionId: generateId(),
      host: hostName,
      filters: { area: f.area || "", category: f.category || "", vibes: vibes, maxVenues: maxVenues },
      candidates: candidates.map(function (v) {
        return {
          Name: v.Name,
          Area: v.Area || "",
          Category: v.Category || "",
          "Vibe Tags": v["Vibe Tags"] || "",
          "Typical Closing Time": v["Typical Closing Time"] || "",
          Address: v.Address || ""
        };
      }),
      votes: {},
      created: Date.now(),
      status: "voting"
    };

    /* Host is first member */
    session.votes[hostName] = {};

    saveSession(session);
    return session;
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  /* ─── Join session ─── */

  function joinSession(sessionId) {
    return getSession(sessionId);
  }

  /* ─── Cast vote ─── */

  function castVote(sessionId, memberName, venueName, vote) {
    var session = getSession(sessionId);
    if (!session) return null;
    if (!session.votes[memberName]) {
      session.votes[memberName] = {};
    }
    session.votes[memberName][venueName] = vote;
    saveSession(session);
    return session;
  }

  /* ─── Results ─── */

  function getResults(sessionId) {
    var session = typeof sessionId === "object" ? sessionId : getSession(sessionId);
    if (!session) return [];

    var members = Object.keys(session.votes);
    return session.candidates.map(function (venue) {
      var yesCount = 0, maybeCount = 0, noCount = 0;
      var memberVotes = {};
      members.forEach(function (m) {
        var v = (session.votes[m] || {})[venue.Name] || "no-vote";
        memberVotes[m] = v;
        if (v === "yes") yesCount++;
        else if (v === "maybe") maybeCount++;
        else if (v === "no") noCount++;
      });
      var score = yesCount * 3 + maybeCount * 1 - noCount * 1;
      return {
        venueName: venue.Name,
        venue: venue,
        yesCount: yesCount,
        maybeCount: maybeCount,
        noCount: noCount,
        score: score,
        memberVotes: memberVotes
      };
    }).sort(function (a, b) { return b.score - a.score; });
  }

  /* ─── Matches (everyone said yes) ─── */

  function getMatches(sessionId) {
    var session = typeof sessionId === "object" ? sessionId : getSession(sessionId);
    if (!session) return [];

    var members = Object.keys(session.votes);
    if (members.length === 0) return [];

    var results = getResults(session);
    return results.filter(function (r) {
      return r.yesCount === members.length;
    });
  }

  /* ─── URL encoding / decoding ─── */

  function encodeSessionURL(session) {
    var base = window.location.origin + window.location.pathname.replace(/[^/]*$/, "") + "squad.html";
    var json = JSON.stringify(session);
    var encoded = btoa(unescape(encodeURIComponent(json)));
    return base + "#session=" + encoded;
  }

  function decodeSessionURL(url) {
    try {
      var hashPart = (url || window.location.hash || "");
      var idx = hashPart.indexOf("#session=");
      if (idx === -1) return null;
      var encoded = hashPart.substring(idx + 9);
      var json = decodeURIComponent(escape(atob(encoded)));
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }

  /* ─── Set session status ─── */

  function setStatus(sessionId, status) {
    var session = getSession(sessionId);
    if (!session) return null;
    session.status = status;
    saveSession(session);
    return session;
  }

  /* ─── Add member ─── */

  function addMember(sessionId, memberName) {
    var session = getSession(sessionId);
    if (!session) return null;
    if (!session.votes[memberName]) {
      session.votes[memberName] = {};
    }
    saveSession(session);
    return session;
  }

  /* ─── Export text summary ─── */

  function exportSessionText(session, results) {
    var lines = [];
    lines.push("Squad Sync Results");
    lines.push("Session: " + session.sessionId);
    lines.push("Host: " + session.host);
    lines.push("Members: " + Object.keys(session.votes).join(", "));
    lines.push("");

    var matches = getMatches(session);
    if (matches.length) {
      lines.push("GROUP MATCHES (everyone said yes):");
      matches.forEach(function (m) {
        lines.push("  " + m.venueName + " (" + m.venue.Area + ")");
      });
      lines.push("");
    }

    lines.push("ALL VENUES (ranked by score):");
    (results || getResults(session)).forEach(function (r, i) {
      lines.push("  " + (i + 1) + ". " + r.venueName + " — Yes: " + r.yesCount + ", Maybe: " + r.maybeCount + ", Nope: " + r.noCount);
    });

    return lines.join("\n");
  }

  /* ─── Exports ─── */

  exports.createSession = createSession;
  exports.joinSession = joinSession;
  exports.castVote = castVote;
  exports.getResults = getResults;
  exports.getMatches = getMatches;
  exports.encodeSessionURL = encodeSessionURL;
  exports.decodeSessionURL = decodeSessionURL;
  exports.setStatus = setStatus;
  exports.addMember = addMember;
  exports.exportSessionText = exportSessionText;
  exports.getSession = getSession;
  exports.saveSession = saveSession;

})(typeof module !== "undefined" ? module.exports : (window.LNVSquadSync = {}));
