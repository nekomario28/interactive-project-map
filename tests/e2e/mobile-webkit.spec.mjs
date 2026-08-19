import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const graph = {
  owner: "example", generatedAt: "2026-08-18T00:00:00Z", repositoryCount: 3, groupCount: 2,
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:robotics", label: "Robotics / ROS 2", type: "group", repositoryCount: 2 },
    { id: "group:web", label: "Web / Apps", type: "group", repositoryCount: 1 },
    { id: "repository:robot-one", label: "robot-one", type: "repository", url: "https://github.com/example/robot-one", description: "Robot fixture", language: "Python", topics: ["robotics"], stars: 3, forks: 1, fork: false, archived: false, createdAt: "2025-01-01T00:00:00Z", updatedAt: "2026-08-18T00:00:00Z", groupId: "robotics", groupLabel: "Robotics / ROS 2" },
    { id: "repository:robot-two", label: "robot-two", type: "repository", url: "https://github.com/example/robot-two", description: "Robot fixture", language: "C++", topics: ["ros2"], stars: 1, forks: 0, fork: true, archived: false, createdAt: "2025-05-01T00:00:00Z", updatedAt: "2026-08-18T00:00:00Z", groupId: "robotics", groupLabel: "Robotics / ROS 2" },
    { id: "repository:web-map", label: "web-map", type: "repository", url: "https://github.com/example/web-map", description: "Web fixture", language: "JavaScript", topics: ["visualization"], stars: 5, forks: 1, fork: false, archived: false, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-08-18T00:00:00Z", groupId: "web", groupLabel: "Web / Apps" },
  ],
  edges: [
    { source: "user:example", target: "group:robotics", type: "ownership" }, { source: "user:example", target: "group:web", type: "ownership" },
    { source: "group:robotics", target: "repository:robot-one", type: "membership" }, { source: "group:robotics", target: "repository:robot-two", type: "membership" },
    { source: "group:web", target: "repository:web-map", type: "membership" },
  ],
};

async function installFixture(page) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });
}
function watchErrors(page) { const failures = []; page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`)); page.on("console", (message) => { if (message.type() === "error") failures.push(`console: ${message.text()}`); }); return failures; }
async function expectNoHorizontalOverflow(page) { const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); expect(overflow).toBeLessThanOrEqual(1); }

test.beforeAll(async () => { await mkdir(".tmp/playwright-visual/webkit", { recursive: true }); });

test("iPhone-sized WebKit keeps generator and Galaxy family route navigation usable", async ({ page }) => {
  await installFixture(page); const failures = watchErrors(page);
  await page.goto("/");
  await expect(page.locator("[data-style-preset]")).toHaveCount(12);
  await expectNoHorizontalOverflow(page);
  await page.locator('[data-style-preset="galaxy-hybrid"]').click();
  await expect(page.locator("#mapStyle")).toHaveValue("galaxy-hybrid");
  await page.screenshot({ path: ".tmp/playwright-visual/webkit/generator.png", fullPage: true });

  await page.goto("/tree/?username=example&style=tree");
  await expect(page.locator("#status")).toBeHidden(); await expectNoHorizontalOverflow(page);
  await page.locator("#galaxy").tap({ position: { x: 100, y: 120 } });
  await page.screenshot({ path: ".tmp/playwright-visual/webkit/tree.png", fullPage: true });

  await page.locator("#style").selectOption("galaxy-hybrid");
  await page.waitForURL(/\/u\/\?username=example&style=galaxy-hybrid/);
  await expect(page.locator("#status")).toBeHidden(); await expectNoHorizontalOverflow(page);
  await page.locator("#search").fill("robot"); await page.getByRole("button", { name: "Fit" }).click();
  await page.screenshot({ path: ".tmp/playwright-visual/webkit/galaxy-hybrid.png", fullPage: true });
  expect(failures).toEqual([]);
});
