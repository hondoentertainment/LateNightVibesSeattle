// @ts-check
const { test, expect } = require("@playwright/test");

test.describe("Compare Neighborhoods page", () => {
  test("loads with area selects and heading", async ({ page }) => {
    await page.goto("/neighborhoods.html");

    await expect(page.getByRole("heading", { name: /compare neighborhoods/i })).toBeVisible();
    await expect(page.locator("#area1")).toBeVisible();
    await expect(page.locator("#area2")).toBeVisible();
    await expect(page.locator("#area3")).toBeVisible();
  });

  test("area selects populate with neighborhoods", async ({ page }) => {
    await page.goto("/neighborhoods.html");

    const area1 = page.locator("#area1");
    await area1.waitFor({ state: "attached", timeout: 10000 });
    const options = area1.locator("option");
    const count = await options.count();
    expect(count).toBeGreaterThan(1);
  });

  test("selecting two areas shows comparison", async ({ page }) => {
    await page.goto("/neighborhoods.html");

    const area1 = page.locator("#area1");
    const area2 = page.locator("#area2");
    await area1.waitFor({ state: "attached", timeout: 10000 });

    await area1.selectOption({ index: 1 });
    await area2.selectOption({ index: 2 });

    const comparisonGrid = page.locator("#comparisonGrid");
    await expect(comparisonGrid).not.toBeEmpty({ timeout: 10000 });
  });

  test("comparison shows venue counts or stats", async ({ page }) => {
    await page.goto("/neighborhoods.html");

    const area1 = page.locator("#area1");
    const area2 = page.locator("#area2");
    await area1.waitFor({ state: "attached", timeout: 10000 });
    await area1.selectOption({ index: 1 });
    await area2.selectOption({ index: 2 });

    const grid = page.locator("#comparisonGrid");
    await expect(grid).toBeVisible({ timeout: 10000 });
    await expect(grid).toContainText(/\d+/); // at least one number (venue count)
  });

  test("desktop nav links are present", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/neighborhoods.html");

    await expect(page.getByRole("link", { name: "Browse Venues" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Recommendations" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Night Plan" })).toBeVisible();
  });
});
