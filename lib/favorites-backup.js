/**
 * Late Night Vibes — Favorites backup (export/import)
 *
 * Provides export to JSON file and import from backup for cloud-safe backup
 * (e.g. save file to Google Drive, Dropbox, or local storage).
 */
(function (global) {
  const STORAGE_KEY = "lnv_favorites";
  const BACKUP_VERSION = 1;

  function getFavorites() {
    try {
      const raw = (typeof localStorage !== "undefined") ? localStorage.getItem(STORAGE_KEY) : null;
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function setFavorites(list) {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }
  }

  /**
   * Export favorites to a downloadable JSON file.
   * @returns {boolean} Success
   */
  function exportFavorites() {
    const list = getFavorites();
    const payload = {
      version: BACKUP_VERSION,
      app: "Late Night Vibes " + ((typeof window !== "undefined" && window.LNVCities && window.LNVCities.getCurrentCity()) ? window.LNVCities.getCurrentCity().name : "Seattle"),
      exportedAt: new Date().toISOString(),
      favorites: list,
    };
    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lnv-favorites-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      return true;
    } catch (_) {
      return false;
    }
  }

  /**
   * Import favorites from a backup file (replace or merge).
   * @param {File} file - JSON backup file
   * @param {Object} opts - { merge: boolean } — if true, merge with existing; else replace
   * @returns {{ success: boolean, imported: number, total: number, error?: string }}
   */
  function importFavorites(file, opts) {
    const options = opts || { merge: false };
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          const list = Array.isArray(data.favorites) ? data.favorites : (Array.isArray(data) ? data : []);
          if (!list.length) {
            resolve({ success: false, imported: 0, total: 0, error: "No valid favorites in file" });
            return;
          }
          let final = list;
          if (options.merge) {
            const existing = new Set(getFavorites());
            list.forEach((n) => existing.add(String(n).trim()));
            final = Array.from(existing);
          }
          setFavorites(final);
          resolve({ success: true, imported: list.length, total: final.length });
        } catch (e) {
          resolve({ success: false, imported: 0, total: 0, error: "Invalid backup file" });
        }
      };
      reader.onerror = () => resolve({ success: false, imported: 0, total: 0, error: "Could not read file" });
      reader.readAsText(file);
    });
  }

  const api = {
    exportFavorites,
    importFavorites,
    getFavorites,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    global.LNVFavoritesBackup = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
