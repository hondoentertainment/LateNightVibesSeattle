// @ts-check
const { test, expect } = require("@playwright/test");
const { skipOnboarding, waitForBrowseReady } = require("./fixtures");

test.describe("Navigation", () => {
  test("index page loads", async ({ page }) => {
    const res = await page.goto("/index.html", { waitUntil: "load", timeout: 15000 });
    expect(res?.status()).toBe(200);
    await expect(page).toHaveTitle(/Late Night Vibes|Seattle/i);
  });

  test("recommend page loads", async ({ page }) => {
    const res = await page.goto("/recommend.html", { waitUntil: "load", timeout: 15000 });
    expect(res?.status()).toBe(200);
    await expect(page).toHaveTitle(/Recommendations/i);
  });

  test("planner page loads", async ({ page }) => {
    const res = await page.goto("/planner.html", { waitUntil: "load", timeout: 15000 });
    expect(res?.status()).toBe(200);
    await expect(page).toHaveTitle(/Night Plan/i);
  });

  test("neighborhoods page loads", async ({ page }) => {
    const res = await page.goto("/neighborhoods.html", { waitUntil: "load", timeout: 15000 });
    expect(res?.status()).toBe(200);
    await expect(page).toHaveTitle(/Compare Neighborhoods/i);
  });

  test.skip("cross-navigation between pages works [flaky under load]", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    skipOnboarding(page);
    await page.goto("/index.html");
    await waitForBrowseReady(page);

    await page.getByRole("link", { name: "Night Plan" }).first().click();
    await page.waitForURL((url) => url.pathname.includes("planner"), { timeout: 10000 });
    await expect(page.getByRole("button", { name: /build my night/i })).toBeVisible();

    await page.getByRole("link", { name: "Compare" }).first().click();
    await page.waitForURL((url) => url.pathname.includes("neighborhoods"), { timeout: 10000 });
    await expect(page.getByRole("heading", { name: /compare neighborhoods/i })).toBeVisible();

    await page.getByRole("link", { name: "Browse Venues" }).first().click();
    await page.waitForURL((url) => url.pathname === "/" || url.pathname.endsWith("index.html"), { timeout: 10000 });
    await waitForBrowseReady(page);
  });

  test("404 page renders and has nav links", async ({ page }) => {
    await page.goto("/404.html");
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /page not found/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Browse venues" })).toHaveAttribute(
      "href",
      "index.html"
    );
  });

  test("Saved view loads with ?view=saved", async ({ page }) => {
    skipOnboarding(page);
    await page.goto("/index.html?view=saved");
    await waitForBrowseReady(page);
    // Page should show saved-only state (result summary or empty state)
    const summary = page.locator("#resultSummary");
    await expect(summary).toBeVisible();
    await expect(summary).toContainText(/saved|venue/);
  });
});
