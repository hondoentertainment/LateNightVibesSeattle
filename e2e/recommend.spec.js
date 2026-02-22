// @ts-check
const { test, expect } = require("@playwright/test");

test.describe("Recommendations page", () => {
  test("loads and populates venue select", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/recommend.html");

    const venueSelect = page.locator("#venueSelectDesktop");
    await venueSelect.waitFor({ state: "visible", timeout: 10000 });
    const options = venueSelect.locator("option");
    const count = await options.count();
    expect(count).toBeGreaterThan(1); // "Pick a venue" + at least one real venue
  });

  test("selecting venue shows recommendations", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/recommend.html");

    const venueSelect = page.locator("#venueSelectDesktop");
    await venueSelect.waitFor({ state: "attached", timeout: 10000 });
    await venueSelect.selectOption({ index: 1 }); // first venue

    const grid = page.locator("#recommendationGrid");
    await expect(grid.locator(".rec-card").first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("Surprise me button generates recommendations", async ({ page }) => {
    await page.goto("/recommend.html");

    const surpriseBtn = page.getByRole("button", { name: /surprise me/i });
    await surpriseBtn.waitFor({ state: "visible", timeout: 5000 });
    await surpriseBtn.click();

    const grid = page.locator("#recommendationGrid");
    await expect(grid.locator(".rec-card").first()).toBeVisible({ timeout: 10000 });
  });

  test("max distance and result count inputs are present", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/recommend.html");
    await page.locator("#venueSelectDesktop").waitFor({ state: "visible", timeout: 10000 });

    const maxMiles = page.locator("#maxDistanceInputDesktop");
    const resultCount = page.locator("#resultCountInputDesktop");
    await expect(maxMiles).toHaveValue("6");
    await expect(resultCount).toHaveValue("8");
  });

  test("context mode select has options", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/recommend.html");
    await page.locator("#contextMode").waitFor({ state: "visible", timeout: 10000 });

    const contextSelect = page.locator("#contextMode");
    await expect(contextSelect).toContainText("General");
    await expect(contextSelect).toContainText("Date night");
    await expect(contextSelect).toContainText("Friends");
  });

  test("desktop nav links to Browse, Planner, Compare", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/recommend.html");
    await page.locator("#venueSelectDesktop").waitFor({ state: "visible", timeout: 10000 });

    await expect(page.getByRole("link", { name: "Browse Venues" }).first()).toHaveAttribute(
      "href",
      "index.html"
    );
    await expect(page.getByRole("link", { name: "Night Plan" }).first()).toHaveAttribute(
      "href",
      "planner.html"
    );
    await expect(page.getByRole("link", { name: "Compare" }).first()).toHaveAttribute(
      "href",
      "neighborhoods.html"
    );
  });
});
