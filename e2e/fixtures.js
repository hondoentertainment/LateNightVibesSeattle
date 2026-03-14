/**
 * Shared Playwright fixtures and helpers for Late Night Vibes E2E tests.
 */
const { test: base } = require("@playwright/test");

/**
 * Skip onboarding for browse tests so we land directly on the venue grid.
 * Call before navigating to index.html.
 */
async function skipOnboarding(page) {
  await page.addInitScript(() => {
    localStorage.setItem("lnv_onboarding_done", "1");
  });
}

/**
 * Wait for venues to load on the browse page (index.html).
 * Handles onboarding (clicks Skip if shown).
 * Waits for either venue cards or result summary (for empty saved view).
 */
async function waitForBrowseReady(page) {
  // If onboarding appears, dismiss it via JS (reliable across viewports)
  const overlay = page.locator("#onboardingOverlay");
  await overlay.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  if (await overlay.isVisible()) {
    await page.evaluate(() => {
      const el = document.getElementById("onboardingOverlay");
      if (el) el.style.display = "none";
      try {
        localStorage.setItem("lnv_onboarding_done", "1");
      } catch (_) {}
    });
    await overlay.waitFor({ state: "hidden", timeout: 3000 });
  }

  // Wait for data to load: either venue cards or result summary (empty saved)
  await Promise.race([
    page.locator(".venue-card").first().waitFor({ state: "visible", timeout: 15000 }),
    page.locator("#resultSummary").filter({ hasText: /venue/ }).waitFor({ state: "visible", timeout: 15000 }),
  ]);
}

/**
 * Extended test with browse helpers.
 */
exports.test = base.extend({
  skipOnboarding: async ({ page }, use) => {
    await skipOnboarding(page);
    await use();
  },
});

exports.skipOnboarding = skipOnboarding;
exports.waitForBrowseReady = waitForBrowseReady;
