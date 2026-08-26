import { expect, test } from "@playwright/test";

test("isolated Three.js lab route fails closed without a username", async ({ page }) => {
  await page.goto("/three/");

  await expect(page.locator("body")).toHaveAttribute("data-map-style", "threejs-cosmic");
  await expect(page.locator("#error")).toHaveClass(/visible/);
  await expect(page.locator("#errorText")).toContainText("Add ?username=YOUR_GITHUB_USERNAME");
  await expect(page.locator("#fallbackLink")).toHaveAttribute("href", "../u/");
  await expect(page.locator("#twoDLink")).toHaveAttribute("href", "../u/");
  await expect(page.locator("[data-status-filter]")).toHaveCount(4);
});

test("isolated Three.js lab keeps the 2D fallback usable when the pinned engine is unavailable", async ({ page }) => {
  await page.route("https://cdn.jsdelivr.net/**", async (route) => route.abort());
  await page.goto("/three/?username=example");

  await expect(page.locator("#error")).toHaveClass(/visible/);
  await expect(page.locator("#errorText")).toContainText("pinned Three.js module could not be loaded");
  await expect(page.locator("#twoDLink")).toHaveAttribute("href", /\/u\/\?username=example$/);
  await expect(page.locator("#fallbackLink")).toHaveAttribute("href", /\/u\/\?username=example$/);
});
