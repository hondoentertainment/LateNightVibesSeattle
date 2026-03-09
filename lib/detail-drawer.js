/* ─── Shared Detail Drawer ───
 * Reusable venue detail drawer for all pages.
 * Usage: LNVDetailDrawer.init({ overlay, drawer, close, title, body, onClose })
 *        LNVDetailDrawer.open(venue)
 *        LNVDetailDrawer.close()
 */
(function () {
  "use strict";

  const { normalizeValue } = window.LNVCore;

  let _overlay, _drawer, _closeBtn, _titleEl, _bodyEl, _onClose, _trigger;

  /* ─── Deep-link URL helpers ─── */
  function addVenueParam(name) {
    var url = new URL(window.location);
    url.searchParams.set("venue", name);
    return url.toString();
  }

  function removeVenueParam() {
    var url = new URL(window.location);
    url.searchParams.delete("venue");
    return url.toString();
  }

  function parseTimeToMinutes(str) {
    if (!str) return null;
    const m = str.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const pm = m[3].toLowerCase() === "pm";
    if (pm && h < 12) h += 12;
    if (!pm && h === 12) h = 0;
    return h * 60 + min;
  }

  function getStatusPill(closingTimeStr) {
    const minutes = parseTimeToMinutes(closingTimeStr);
    if (minutes === null) return '<span class="pill">Hours unknown</span>';
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const closingAdj = minutes <= 360 ? minutes + 1440 : minutes;
    const nowAdj = nowMinutes < 540 ? nowMinutes + 1440 : nowMinutes;
    if (nowAdj >= 17 * 60 && nowAdj < closingAdj) return '<span class="pill pill-open">Open now</span>';
    return '<span class="pill pill-closed">Likely closed</span>';
  }

  function open(venue) {
    if (!_drawer || !_overlay) return;
    _trigger = document.activeElement;
    const venueName = normalizeValue(venue.Name);
    _overlay.classList.add("open");
    _drawer.classList.add("open");
    document.body.style.overflow = "hidden";
    _titleEl.textContent = venueName;

    // Deep-link: update URL with venue param
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, "", addVenueParam(venueName));
    }

    const mapLink = normalizeValue(venue["Google Maps Driving Link"]);
    const address = normalizeValue(venue.Address);
    const phone = normalizeValue(venue.Phone);
    const website = normalizeValue(venue.Website);
    const closingTime = normalizeValue(venue["Typical Closing Time"]);
    const distance = normalizeValue(venue["Driving Distance"]);
    const area = normalizeValue(venue.Area);
    const category = normalizeValue(venue.Category);
    const tags = normalizeValue(venue["Vibe Tags"]).split(",").map((t) => normalizeValue(t)).filter(Boolean);
    const primaryTag = (tags[0] || "general").toLowerCase().replace(/[^a-z0-9-]/g, "") || "general";
    const posterClass = "poster-general poster-" + primaryTag;
    const statusPill = getStatusPill(closingTime);
    const googleSearch = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(venueName + " " + area + " Seattle");
    const yelpSearch = "https://www.yelp.com/search?find_desc=" + encodeURIComponent(venueName) + "&find_loc=" + encodeURIComponent(area + ", Seattle");

    var websiteLink = "";
    if (website) {
      try { websiteLink = '<a href="' + website + '" target="_blank" rel="noopener" style="color:#9fd6ff;text-decoration:none">' + new URL(website).hostname + "</a>"; }
      catch (_) { websiteLink = '<a href="' + website + '" target="_blank" rel="noopener" style="color:#9fd6ff;text-decoration:none">' + website + "</a>"; }
    }

    var favs = JSON.parse(localStorage.getItem("lnv_favorites") || "[]");
    var isFav = favs.includes(venueName);

    _bodyEl.innerHTML =
      '<div class="detail-poster ' + posterClass + '" id="sharedDetailPoster"></div>' +
      '<div class="detail-name">' + venueName + "</div>" +
      '<div class="detail-meta">' + area + " · " + category + "</div>" +
      '<div class="detail-row"><span class="label">Status</span>' + statusPill + "</div>" +
      (closingTime ? '<div class="detail-row"><span class="label">Closes</span>' + closingTime + "</div>" : "") +
      (distance ? '<div class="detail-row"><span class="label">Distance</span>' + (mapLink ? '<a href="' + mapLink + '" target="_blank" rel="noopener" style="color:#9fd6ff;text-decoration:none">' + distance + " ↗</a>" : distance) + "</div>" : "") +
      (address && address.toLowerCase() !== "click link" ? '<div class="detail-row"><span class="label">Address</span>' + address + "</div>" : "") +
      (phone ? '<div class="detail-row"><span class="label">Phone</span><a href="tel:' + phone + '" style="color:#9fd6ff;text-decoration:none">' + phone + "</a></div>" : "") +
      (website ? '<div class="detail-row"><span class="label">Website</span>' + websiteLink + "</div>" : "") +
      '<div class="detail-vibes">' + tags.map(function (t) { return '<span class="pill">' + t + "</span>"; }).join("") + "</div>" +
      '<div class="detail-actions">' +
        (mapLink ? '<a class="btn-primary" href="' + mapLink + '" target="_blank" rel="noopener">Directions</a>' : "") +
        '<a class="btn-secondary" href="' + googleSearch + '" target="_blank" rel="noopener">Google</a>' +
        '<a class="btn-secondary" href="' + yelpSearch + '" target="_blank" rel="noopener">Yelp</a>' +
        '<button class="btn-secondary ' + (isFav ? "favorited" : "") + '" id="sharedDetailFavBtn" type="button">' + (isFav ? "♥ Saved" : "♡ Save") + "</button>" +
      "</div>";

    // Venue photos integration
    if (window.venuePhotos && window.venuePhotos.isEnabled()) {
      var posterEl = document.getElementById("sharedDetailPoster");
      if (posterEl) window.venuePhotos.applyVenuePhoto(posterEl, venueName, area);
    }

    var favBtn = document.getElementById("sharedDetailFavBtn");
    if (favBtn) {
      favBtn.addEventListener("click", function () {
        var currentFavs = JSON.parse(localStorage.getItem("lnv_favorites") || "[]");
        var idx = currentFavs.indexOf(venueName);
        if (idx >= 0) currentFavs.splice(idx, 1);
        else currentFavs.push(venueName);
        localStorage.setItem("lnv_favorites", JSON.stringify(currentFavs));
        var nowFav = currentFavs.includes(venueName);
        favBtn.textContent = nowFav ? "♥ Saved" : "♡ Save";
        favBtn.classList.toggle("favorited", nowFav);
        if (window.LNV_HAPTICS) window.LNV_HAPTICS.medium();
      });
    }

    if (_closeBtn) setTimeout(function () { _closeBtn.focus(); }, 100);
  }

  function close() {
    if (!_drawer || !_overlay) return;
    _overlay.classList.remove("open");
    _drawer.classList.remove("open");
    document.body.style.overflow = "";
    if (_trigger && _trigger.focus) {
      _trigger.focus();
      _trigger = null;
    }
    // Deep-link: remove venue param from URL
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, "", removeVenueParam());
    }
    if (_onClose) _onClose();
  }

  function initSwipeToDismiss() {
    if (!_drawer) return;
    var startY = 0, currentY = 0, isDragging = false;
    _drawer.addEventListener("touchstart", function (e) {
      var touch = e.touches[0];
      var rect = _drawer.getBoundingClientRect();
      if (touch.clientY - rect.top > 60) return;
      startY = touch.clientY;
      currentY = startY;
      isDragging = true;
      _drawer.style.transition = "none";
    }, { passive: true });
    _drawer.addEventListener("touchmove", function (e) {
      if (!isDragging) return;
      currentY = e.touches[0].clientY;
      var dy = Math.max(0, currentY - startY);
      _drawer.style.transform = "translateY(" + dy + "px)";
      if (_overlay) _overlay.style.opacity = Math.max(0, 1 - dy / 300);
    }, { passive: true });
    _drawer.addEventListener("touchend", function () {
      if (!isDragging) return;
      isDragging = false;
      _drawer.style.transition = "";
      if (_overlay) _overlay.style.opacity = "";
      if (currentY - startY > 80) {
        close();
      } else {
        _drawer.style.transform = "";
      }
    }, { passive: true });
  }

  function init(opts) {
    _overlay = opts.overlay;
    _drawer = opts.drawer;
    _closeBtn = opts.close;
    _titleEl = opts.title;
    _bodyEl = opts.body;
    _onClose = opts.onClose || null;

    if (_overlay) _overlay.addEventListener("click", close);
    if (_closeBtn) _closeBtn.addEventListener("click", close);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && _drawer && _drawer.classList.contains("open")) close();
    });

    initSwipeToDismiss();
  }

  /**
   * openFromURL(venues) — call after venue data is loaded.
   * If the URL contains ?venue=Name, automatically open that venue's drawer.
   */
  function openFromURL(venues) {
    var param = new URLSearchParams(window.location.search).get("venue");
    if (!param) return;
    var decoded = decodeURIComponent(param).trim();
    var match = venues.find(function (v) {
      return normalizeValue(v.Name).toLowerCase() === decoded.toLowerCase();
    });
    if (match) {
      requestAnimationFrame(function () { open(match); });
    }
  }

  window.LNVDetailDrawer = {
    init: init,
    open: open,
    close: close,
    openFromURL: openFromURL,
  };
})();
