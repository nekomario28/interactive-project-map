import { expect, test } from "@playwright/test";

function repository({ id, label, description, groupId = "robotics", groupLabel = "Robotics" }) {
  return {
    id,
    label,
    repositoryName: label,
    type: "repository",
    url: `https://github.com/example/${label}`,
    description,
    language: "JavaScript",
    topics: ["visualization"],
    stars: 1,
    forks: 0,
    fork: false,
    archived: false,
    relation: "owned",
    updatedAt: "2026-08-25T00:00:00Z",
    groupId,
    groupLabel,
  };
}

const graph = {
  owner: "example",
  generatedAt: "2026-08-26T00:00:00Z",
  repositoryCount: 3,
  groupCount: 2,
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:robotics", label: "Robotics", type: "group", repositoryCount: 2 },
    { id: "group:ai", label: "AI", type: "group", repositoryCount: 1 },
    repository({ id: "repository:alpha", label: "alpha", description: "Robot navigation application" }),
    repository({ id: "repository:gamma", label: "gamma", description: "Robot controller and visualization" }),
    repository({ id: "repository:delta", label: "delta", description: "Language model experiment", groupId: "ai", groupLabel: "AI" }),
  ],
  edges: [
    { source: "user:example", target: "group:robotics", type: "ownership" },
    { source: "user:example", target: "group:ai", type: "ownership" },
    { source: "group:robotics", target: "repository:alpha", type: "membership" },
    { source: "group:robotics", target: "repository:gamma", type: "membership" },
    { source: "group:ai", target: "repository:delta", type: "membership" },
  ],
};

function denseSearchGraph() {
  const repos = Array.from({ length: 12 }, (_, index) => repository({
    id: `repository:match-${index}`,
    label: `match-${index}`,
    description: `bounded-label-evidence repository ${index}`,
  }));
  return {
    owner: "example",
    generatedAt: "2026-08-26T00:00:00Z",
    repositoryCount: repos.length,
    groupCount: 1,
    nodes: [
      { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
      { id: "group:robotics", label: "Robotics", type: "group", repositoryCount: repos.length },
      ...repos,
    ],
    edges: [
      { source: "user:example", target: "group:robotics", type: "ownership" },
      ...repos.map((repo) => ({ source: "group:robotics", target: repo.id, type: "membership" })),
    ],
  };
}

async function installGraph(page, value = graph) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(value) });
  });
}

async function openNavigator(page) {
  await expect(page.locator("#categoryNavigatorToggle")).toBeVisible({ timeout: 20_000 });
  await page.locator("#categoryNavigatorToggle").click();
  await expect(page.locator("#categoryNavigator")).toHaveClass(/is-open/);
}

test("Three.js repository labels stay lazy and prioritize selection over direct search", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Real projected repository labels are exercised once in Chromium.");
  await installGraph(page);
  await page.goto("/three/?username=example");
  await expect(page.locator("#status")).toHaveClass(/ready/, { timeout: 20_000 });

  const labels = page.locator(".three-label-repository");
  await expect(labels).toHaveCount(0);

  await page.locator("#search").fill("robot");
  await expect(labels).toHaveCount(2);
  await expect(page.locator('[data-repository-label-id="repository:alpha"]')).toHaveClass(/is-search-match/);
  await expect(page.locator('[data-repository-label-id="repository:gamma"]')).toHaveClass(/is-search-match/);

  await page.locator("#search").fill("");
  await expect(labels).toHaveCount(0);

  await openNavigator(page);
  await page.getByRole("button", { name: "Expand Robotics repositories" }).click();
  await page.locator('[data-repository-id="repository:alpha"]').click();
  const alphaLabel = page.locator('[data-repository-label-id="repository:alpha"]');
  await expect(alphaLabel).toHaveCount(1);
  await expect(alphaLabel).toHaveClass(/is-selected/);
  await expect(alphaLabel).not.toHaveClass(/is-search-match/);

  await page.locator("#search").fill("robot");
  await expect(labels).toHaveCount(2);
  await expect(alphaLabel).toHaveClass(/is-selected/);
  await expect(page.locator('[data-repository-label-id="repository:gamma"]')).toHaveClass(/is-search-match/);

  await page.locator("#detailsClose").click();
  await expect(labels).toHaveCount(2);
  await expect(alphaLabel).not.toHaveClass(/is-selected/);
  await expect(alphaLabel).toHaveClass(/is-search-match/);

  await page.locator("#search").fill("");
  await expect(labels).toHaveCount(0);
});

test("Three.js direct-search repository labels keep an explicit eight-label budget", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "The bounded DOM label budget is measured once in Chromium.");
  await installGraph(page, denseSearchGraph());
  await page.goto("/three/?username=example");
  await expect(page.locator("#status")).toHaveClass(/ready/, { timeout: 20_000 });

  await page.locator("#search").fill("bounded-label-evidence");
  const labels = page.locator(".three-label-repository");
  await expect(labels).toHaveCount(8);
  const ids = await labels.evaluateAll((elements) => elements.map((element) => element.dataset.repositoryLabelId));
  expect(new Set(ids).size).toBe(8);
  await expect(page.locator("#resultCount")).toHaveText("12 / 12 projects");
});
