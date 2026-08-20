import { expect, test } from "@playwright/test";

const graph = {
  owner: "example",
  generatedAt: "2026-08-20T00:00:00Z",
  repositoryCount: 4,
  groupCount: 2,
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:robotics", label: "Robotics / ROS 2", type: "group", repositoryCount: 2 },
    { id: "group:web-apps", label: "Web / Apps", type: "group", repositoryCount: 2 },
    { id: "repository:robot-alpha", label: "robot-alpha", type: "repository", url: "https://github.com/example/robot-alpha", description: "ROS2 robot", language: "Python", topics: ["robotics"], stars: 3, forks: 0, fork: false, archived: false, updatedAt: "2026-08-20T00:00:00Z", groupId: "robotics", groupLabel: "Robotics / ROS 2" },
    { id: "repository:robot-beta", label: "robot-beta", type: "repository", url: "https://github.com/example/robot-beta", description: "Gazebo manipulation", language: "C++", topics: ["robotics"], stars: 2, forks: 0, fork: false, archived: false, updatedAt: "2026-08-20T00:00:00Z", groupId: "robotics", groupLabel: "Robotics / ROS 2" },
    { id: "repository:web-alpha", label: "web-alpha", type: "repository", url: "https://github.com/example/web-alpha", description: "React app", language: "TypeScript", topics: ["web"], stars: 1, forks: 0, fork: false, archived: false, updatedAt: "2026-08-20T00:00:00Z", groupId: "web-apps", groupLabel: "Web / Apps" },
    { id: "repository:web-beta", label: "web-beta", type: "repository", url: "https://github.com/example/web-beta", description: "Svelte app", language: "TypeScript", topics: ["web"], stars: 1, forks: 0, fork: false, archived: false, updatedAt: "2026-08-20T00:00:00Z", groupId: "web-apps", groupLabel: "Web / Apps" },
  ],
  edges: [
    { source: "user:example", target: "group:robotics", type: "ownership" },
    { source: "user:example", target: "group:web-apps", type: "ownership" },
    { source: "group:robotics", target: "repository:robot-alpha", type: "membership" },
    { source: "group:robotics", target: "repository:robot-beta", type: "membership" },
    { source: "group:web-apps", target: "repository:web-alpha", type: "membership" },
    { source: "group:web-apps", target: "repository:web-beta", type: "membership" },
  ],
  semanticEdges: [
    { source: "repository:robot-alpha", target: "repository:robot-beta", type: "semantic", score: 0.96 },
    { source: "repository:web-alpha", target: "repository:web-beta", type: "semantic", score: 0.91 },
    { source: "repository:robot-alpha", target: "group:robotics", type: "semantic", score: 1 },
  ],
};

async function installFixture(page) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });
}

function browserErrors(page) {
  const failures = [];
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console: ${message.text()}`);
  });
  return failures;
}

for (const style of ["galaxy-systems", "galaxy-hybrid", "obsidian"]) {
  test(`${style} consumes sanitized sparse semantic edges as an exploratory layer`, async ({ page }) => {
    await installFixture(page);
    const failures = browserErrors(page);
    await page.goto(`/u/?username=example&style=${style}`);
    await expect(page.locator("#status")).toBeHidden();
    await expect.poll(async () => page.evaluate(() => window.ProjectMapSemanticEdges?.count?.() ?? -1)).toBe(2);
    const edges = await page.evaluate(() => window.ProjectMapSemanticEdges.edges());
    expect(edges).toEqual([
      { source: "repository:robot-alpha", target: "repository:robot-beta", type: "semantic", score: 0.96 },
      { source: "repository:web-alpha", target: "repository:web-beta", type: "semantic", score: 0.91 },
    ]);
    expect(failures).toEqual([]);
  });
}

test("Tree keeps semantic links out of its dedicated hierarchy runtime", async ({ page }) => {
  await installFixture(page);
  const failures = browserErrors(page);
  await page.goto("/tree/?username=example&style=tree");
  await expect(page.locator("#status")).toBeHidden();
  expect(await page.evaluate(() => typeof window.ProjectMapSemanticEdges)).toBe("undefined");
  expect(failures).toEqual([]);
});
