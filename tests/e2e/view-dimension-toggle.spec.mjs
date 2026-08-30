import { expect, test } from "@playwright/test";

const graph = {
  owner: "example",
  generatedAt: "2026-08-26T00:00:00Z",
  repositoryCount: 1,
  groupCount: 1,
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:apps", label: "Apps", type: "group", repositoryCount: 1 },
    {
      id: "repository:alpha",
      label: "alpha",
      repositoryName: "alpha",
      type: "repository",
      url: "https://github.com/example/alpha",
      description: "Alpha app",
      language: "JavaScript",
      topics: ["demo"],
      stars: 1,
      forks: 0,
      fork: false,
      archived: false,
      relation: "owned",
      groupId: "apps",
      groupLabel: "Apps",
      updatedAt: "2026-08-25T00:00:00Z",
    },
  ],
  edges: [
    { source: "user:example", target: "group:apps", type: "ownership" },
    { source: "group:apps", target: "repository:alpha", type: "membership" },
  ],
};

async function installGraph(page) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });
}

async function waitForThreeReady(page) {
  await expect(page.locator("#status")).toHaveClass(/ready/, { timeout: 20_000 });
}

test("View is a separate 2D/3D axis, exposes real 3D styles, and restores the previous 2D style", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Real Three.js renderer switching is exercised once in Chromium.");
  await installGraph(page);

  await page.goto("/u/?username=example&style=galaxy-hybrid&q=alpha&status=original&motion=off");
  await expect(page.locator("#status")).toBeHidden();
  await expect(page.locator('body[data-view-dimension="2d"]')).toHaveCount(1);
  await expect(page.locator('.view-mode-option[aria-current="page"]')).toHaveText("2D");
  await expect(page.locator("#style option")).toHaveCount(12);
  expect(await page.locator("#style").evaluate((select) => [...select.options].map((option) => option.value))).not.toContain("threejs");

  const threeTarget = await page.evaluate(() => {
    const link = new URL(document.getElementById("view3D").href);
    return {
      pathname: link.pathname,
      style: link.searchParams.get("style"),
      style2d: link.searchParams.get("style2d"),
      state: window.ProjectMapTransferableState.parse(link),
    };
  });
  expect(threeTarget.pathname).toMatch(/\/three\/$/);
  expect(threeTarget.style).toBeNull();
  expect(threeTarget.style2d).toBe("galaxy-hybrid");
  expect(threeTarget.state.username).toBe("example");
  expect(threeTarget.state.q).toBe("alpha");
  expect(threeTarget.state.motionOff).toBe(true);
  expect(threeTarget.state.statuses).toContain("original");

  await page.goto(await page.locator("#view3D").getAttribute("href"));
  await waitForThreeReady(page);
  await expect(page.locator('body[data-view-dimension="3d"]')).toHaveCount(1);
  await expect(page.locator('.view-mode-option[aria-current="page"]')).toContainText("3D");
  await expect(page.locator(".view-style-field")).toBeVisible();
  await expect(page.locator(".view-style-field > span")).toHaveText("Style");
  await expect(page.locator("#threeStyle")).toBeVisible();
  await expect(page.locator("#threeStyle option")).toHaveCount(3);
  expect(await page.locator("#threeStyle").evaluate((select) => [...select.options].map((option) => option.value))).toEqual(["cosmic", "aurora", "wireframe"]);
  await expect(page.locator("#threeStyle")).toHaveValue("cosmic");
  await expect(page.locator('body[data-map-style="threejs-cosmic"]')).toHaveCount(1);
  const cosmicCanvas = await page.locator("#galaxy3d").screenshot();

  await Promise.all([
    page.waitForURL(/style3d=aurora/),
    page.locator("#threeStyle").selectOption("aurora"),
  ]);
  await waitForThreeReady(page);
  await expect(page.locator("#threeStyle")).toHaveValue("aurora");
  await expect(page.locator('body[data-map-style="threejs-aurora"]')).toHaveCount(1);
  const auroraSnapshot = await page.evaluate(() => window.ProjectMapThreejsLab.snapshot());
  expect(auroraSnapshot.style).toBe("aurora");
  expect(auroraSnapshot.renderer).toBe("threejs-aurora");
  const auroraCanvas = await page.locator("#galaxy3d").screenshot();
  expect(Buffer.compare(cosmicCanvas, auroraCanvas)).not.toBe(0);

  await Promise.all([
    page.waitForURL(/style3d=wireframe/),
    page.locator("#threeStyle").selectOption("wireframe"),
  ]);
  await waitForThreeReady(page);
  await expect(page.locator("#threeStyle")).toHaveValue("wireframe");
  await expect(page.locator('body[data-map-style="threejs-wireframe"]')).toHaveCount(1);
  const wireframeSnapshot = await page.evaluate(() => window.ProjectMapThreejsLab.snapshot());
  expect(wireframeSnapshot.style).toBe("wireframe");
  expect(wireframeSnapshot.renderer).toBe("threejs-wireframe");

  const controlOrder = await page.evaluate(() => {
    const view = document.querySelector(".view-mode-cluster");
    const style = document.querySelector(".view-style-field");
    return {
      view: Number.parseInt(getComputedStyle(view).order, 10),
      style: Number.parseInt(getComputedStyle(style).order, 10),
    };
  });
  expect(controlOrder.view).toBeLessThan(controlOrder.style);
  expect(controlOrder.style).toBeLessThan(0);

  const twoTarget = await page.evaluate(() => {
    const link = new URL(document.getElementById("twoDLink").href);
    return {
      pathname: link.pathname,
      style: link.searchParams.get("style"),
      style2d: link.searchParams.get("style2d"),
      style3d: link.searchParams.get("style3d"),
      render: link.searchParams.get("render"),
      state: window.ProjectMapTransferableState.parse(link),
      snapshot: window.ProjectMapViewDimension.snapshot(),
    };
  });
  expect(twoTarget.pathname).toMatch(/\/u\/$/);
  expect(twoTarget.style).toBe("galaxy-hybrid");
  expect(twoTarget.style2d).toBeNull();
  expect(twoTarget.style3d).toBeNull();
  expect(twoTarget.render).toBeNull();
  expect(twoTarget.state.username).toBe("example");
  expect(twoTarget.state.q).toBe("alpha");
  expect(twoTarget.state.motionOff).toBe(true);
  expect(twoTarget.snapshot.dimension).toBe("3d");
  expect(twoTarget.snapshot.twoDStyle).toBe("galaxy-hybrid");
  expect(twoTarget.snapshot.threeDStyle).toBe("wireframe");
});

test("dedicated 2D routes also expose 3D without treating it as a Style option", async ({ page }) => {
  await installGraph(page);
  await page.goto("/radial/?username=example");
  await expect(page.locator("#status")).toBeHidden();
  await expect(page.locator('body[data-view-dimension="2d"]')).toHaveCount(1);
  await expect(page.locator("#style option")).toHaveCount(12);
  const url = new URL(await page.locator("#view3D").getAttribute("href"));
  expect(url.pathname).toMatch(/\/three\/$/);
  expect(url.searchParams.get("style2d")).toBe("radial");
});
