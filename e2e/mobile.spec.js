// @ts-check
const { test, expect } = require("@playwright/test");
const { skipOnboarding, waitForBrowseReady } = require("./fixtures");

test.describe("Mobile viewport", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("bottom nav is visible and navigable", async ({ page }) => {
    skipOnboarding(page);
    await page.goto("/index.html");
    await waitForBrowseReady(page);

    const bottomNav = page.getByRole("navigation", { name: /main navigation/i }).last();
    await expect(bottomNav).toBeVisible();
    await expect(bottomNav.getByRole("link", { name: /browse/i })).toBeVisible();
    await expect(bottomNav.getByRole("link", { name: /for you/i })).toBeVisible();
    await expect(bottomNav.getByRole("link", { name: /plan/i })).toBeVisible();
    await expect(bottomNav.getByRole("link", { name: /saved/i })).toBeVisible();
    await expect(bottomNav.getByRole("link", { name: /compare/i })).toBeVisible();
  });

  test("bottom nav Browse links to index", async ({ page }) => {
    await page.goto("/recommend.html");
    await page.locator("#venueSelect").waitFor({ state: "visible", timeout: 10000 });
    await page.locator(".bottom-nav").getByRole("link", { name: /browse/i }).click();
    await page.waitForURL((url) => url.pathname === "/" || url.pathname.endsWith("index.html"), { timeout: 10000 });
  });

  test("filter drawer opens on mobile", async ({ page }) => {
    skipOnboarding(page);
    await page.goto("/index.html");
    await waitForBrowseReady(page);

    const filterBtn = page.locator("#filterToggle");
    await filterBtn.click();

    const drawer = page.locator("#filterDrawer");
    await expect(drawer).toHaveClass(/open/);
    await expect(page.locator("#filterDrawerTitle")).toContainText(/filters.*vibes/i);
  });

  test("filter drawer can be closed", async ({ page }) => {
    skipOnboarding(page);
    await page.goto("/index.html");
    await waitForBrowseReady(page);

    await page.locator("#filterToggle").click();
    await expect(page.locator("#filterDrawer")).toHaveClass(/open/);

    await page.locator("#filterClose").click();
    await expect(page.locator("#filterDrawer")).not.toHaveClass(/open/);
  });

  test("recommend page has mobile controls", async ({ page }) => {
    await page.goto("/recommend.html");
    await page.locator("#venueSelect").waitFor({ state: "visible", timeout: 10000 });
    await expect(page.locator("#venueSelect")).toBeVisible();
    await expect(page.locator("#surpriseMeBtn")).toBeVisible();
  });

  test("planner has mobile build button", async ({ page }) => {
    await page.goto("/planner.html");
    await expect(page.locator("#buildPlan")).toBeVisible();
  });
});
