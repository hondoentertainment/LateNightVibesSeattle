// @ts-check
const { test, expect } = require("@playwright/test");

test.describe("Night Plan page", () => {
  test("loads with build button and form controls", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/planner.html");

    const buildBtn = page.getByRole("button", { name: /build my night/i });
    await expect(buildBtn).toBeVisible();

    const startTime = page.locator("#startTimeDesktop");
    const endTime = page.locator("#endTimeDesktop");
    await expect(startTime).toBeVisible();
    await expect(endTime).toBeVisible();
  });

  test("Build my night generates itinerary", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/planner.html");

    const buildBtn = page.getByRole("button", { name: /build my night/i });
    await buildBtn.click();

    const itinerary = page.locator("#itinerary");
    await expect(itinerary.locator(".stop-card").first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("vibe arc options are available", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/planner.html");

    const vibeArc = page.locator("#vibeArcDesktop");
    await expect(vibeArc).toContainText("Chill");
    await expect(vibeArc).toContainText("Date night");
    await expect(vibeArc).toContainText("Party mode");
  });

  test("Shuffle and Share plan appear after building", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/planner.html");

    await page.getByRole("button", { name: /build my night/i }).click();

    const shuffleBtn = page.getByRole("button", { name: /shuffle/i });
    const shareBtn = page.getByRole("button", { name: /share plan/i });
    await expect(shuffleBtn).toBeVisible({ timeout: 15000 });
    await expect(shareBtn).toBeVisible({ timeout: 15000 });
  });

  test("area filter populates with neighborhoods", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/planner.html");

    const areaFilter = page.locator("#areaFilterDesktop");
    await areaFilter.waitFor({ state: "visible", timeout: 10000 });
    const options = areaFilter.locator("option");
    const count = await options.count();
    expect(count).toBeGreaterThan(1);
  });

  test("mobile bottom nav shows Plan as active", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/planner.html");

    const planNav = page.getByRole("link", { name: /night plan builder/i });
    await expect(planNav).toHaveAttribute("aria-current", "page");
  });
});
