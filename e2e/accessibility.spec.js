// @ts-check
const { test, expect } = require("@playwright/test");
const { skipOnboarding, waitForBrowseReady } = require("./fixtures");

test.describe("Accessibility", () => {
  test("skip link navigates to main content", async ({ page }) => {
    skipOnboarding(page);
    await page.goto("/index.html");
    await waitForBrowseReady(page);

    await page.locator('a[href="#main"]').evaluate((el) => el.click());
    await expect(page).toHaveURL(/#main/);
    await expect(page.locator("#main")).toBeInViewport();
  });

  test("main content has accessible landmark", async ({ page }) => {
    skipOnboarding(page);
    await page.goto("/index.html");
    await waitForBrowseReady(page);

    const main = page.locator("main#main").or(page.locator("#main[role='main']")).first();
    await expect(main).toBeVisible();
  });

  test("header has banner role", async ({ page }) => {
    await page.goto("/index.html");
    const header = page.getByRole("banner");
    await expect(header).toBeVisible();
  });

  test("search has accessible label", async ({ page }) => {
    skipOnboarding(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/index.html");
    await waitForBrowseReady(page);

    const search = page.locator("#searchInput");
    await expect(search).toHaveAttribute("aria-label", /search venues/i);
  });

  test("recommend page has accessible form controls", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/recommend.html");
    await page.locator("#venueSelectDesktop").waitFor({ state: "visible", timeout: 10000 });

    const venueSelect = page.locator("#venueSelectDesktop");
    await expect(venueSelect).toBeVisible();
  });

  test("planner build button is focusable", async ({ page }) => {
    await page.goto("/planner.html");
    const buildBtn = page.getByRole("button", { name: /build my night/i });
    await buildBtn.focus();
    await expect(buildBtn).toBeFocused();
  });
});
