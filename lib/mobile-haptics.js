/**
 * Late Night Vibes — Mobile haptics polyfill and bottom nav wiring.
 * Provides LNV_HAPTICS when not already defined (recommend, planner, neighborhoods)
 * and wires light haptic feedback to bottom nav taps.
 */
(function () {
  if (!window.LNV_HAPTICS) {
    window.LNV_HAPTICS = {
      light: function () {
        try {
          (window.navigator.vibrate || window.navigator.webkitVibrate || window.navigator.mozVibrate || function () {})(3);
        } catch (_) {}
      },
      medium: function () {
        try {
          (window.navigator.vibrate || window.navigator.webkitVibrate || window.navigator.mozVibrate || function () {})(20);
        } catch (_) {}
      },
      confirm: function () {
        try {
          (window.navigator.vibrate || window.navigator.webkitVibrate || window.navigator.mozVibrate || function () {})([10, 50, 10]);
        } catch (_) {}
      },
    };
  }

  function wireBottomNavHaptics() {
    document.querySelectorAll(".bottom-nav-item").forEach(function (el) {
      el.addEventListener("click", function () {
        if (window.LNV_HAPTICS) window.LNV_HAPTICS.light();
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireBottomNavHaptics);
  } else {
    wireBottomNavHaptics();
  }
})();
