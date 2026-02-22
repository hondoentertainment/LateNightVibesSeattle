// @ts-check
const { test, expect } = require("@playwright/test");
const { skipOnboarding, waitForBrowseReady } = require("./fixtures");

test.describe("Browse page (index)", () => {
  test.beforeEach(async ({ page }) => {
    skipOnboarding(page);
  });

  test("loads and displays venue grid", async ({ page }) => {
    await page.goto("/index.html");
    await waitForBrowseReady(page);

    const cards = page.locator(".venue-card");
    await expect(cards.first()).toBeVisible();
    await expect(cards).toHaveCount(40, { timeout: 5000 }); // PAGE_SIZE
  });

  test("shows result summary with venue count", async ({ page }) => {
    await page.goto("/index.html");
    await waitForBrowseReady(page);

    const summary = page.locator("#resultSummary");
    await expect(summary).toBeVisible();
    await expect(summary).toContainText(/\d+ venues?/i);
  });

  test("search filters venues", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/index.html");
    await waitForBrowseReady(page);

    const searchInput = page.locator("#searchInput");
    await searchInput.fill("capitol hill");
    await page.keyboard.press("Enter");

    await expect(page.locator(".venue-card").first()).toBeVisible({ timeout: 5000 });
    const count = await page.locator(".venue-card").count();
    expect(count).toBeGreaterThan(0);
  });

  test("quick filter chip applies filter", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // mobile for quick chips
    await page.goto("/index.html");
    await waitForBrowseReady(page);

    const chillChip = page.getByRole("button", { name: /chill/i }).first();
    await chillChip.click();

    await expect(page.locator(".venue-card").first()).toBeVisible({ timeout: 5000 });
  });

  test("area filter in sidebar filters venues", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 }); // desktop for sidebar
    await page.goto("/index.html");
    await waitForBrowseReady(page);

    const areaSelect = page.locator("#areaSelectDesktop");
    await areaSelect.selectOption({ index: 1 }); // first non-empty option
    const areaValue = await areaSelect.inputValue();
    expect(areaValue).toBeTruthy();
  });

  test("view toggle switches between grid and map", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/index.html");
    await waitForBrowseReady(page);

    const mapBtn = page.getByRole("button", { name: "Map" });
    await mapBtn.click();

    const mapContainer = page.locator("#mapContainer");
    await expect(mapContainer).toBeVisible({ timeout: 5000 });

    const gridBtn = page.getByRole("button", { name: "Grid" });
    await gridBtn.click();
    await expect(page.locator(".venue-grid").first()).toBeVisible();
  });

  test("clicking venue card opens detail drawer", async ({ page }) => {
    await page.goto("/index.html");
    await waitForBrowseReady(page);

    const firstCard = page.locator(".venue-card").first();
    await firstCard.click();

    const drawer = page.locator("#detailDrawer");
    await expect(drawer).toBeVisible();
    const title = page.locator("#detailTitle");
    await expect(title).not.toBeEmpty();
  });

  test("detail drawer can be closed", async ({ page }) => {
    await page.goto("/index.html");
    await waitForBrowseReady(page);

    await page.locator(".venue-card").first().click();
    await expect(page.locator("#detailDrawer")).toBeVisible();

    await page.locator("#detailClose").click();
    await expect(page.locator("#detailDrawer")).not.toHaveClass(/open/);
  });

  test("skip link scrolls to main content", async ({ page }) => {
    await page.goto("/index.html");
    await waitForBrowseReady(page);

    await page.locator('a[href="#main"]').evaluate((el) => el.click());
    await expect(page.locator("#main")).toBeInViewport();
  });

  test("header logo and nav pills are visible on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/index.html");
    await waitForBrowseReady(page);

    await expect(page.getByAltText("Late Night Vibes")).toBeVisible();
    await expect(page.getByRole("link", { name: "Recommendations" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Night Plan" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Compare" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Saved" })).toBeVisible();
  });
});
