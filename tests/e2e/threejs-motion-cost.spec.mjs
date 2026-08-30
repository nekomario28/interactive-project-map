import { mkdir, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

function buildGraph(repositoryCount = 480, groupCount = 8) {
  const groups = Array.from({ length: groupCount }, (_, index) => ({ id: `group:g${index}`, label: `Group ${index + 1}`, type: "group", repositoryCount: Math.ceil(repositoryCount / groupCount) }));
  const repositories = Array.from({ length: repositoryCount }, (_, index) => {
    const groupIndex = index % groupCount;
    return { id: `repository:repo-${index}`, label: `repo-${index}`, type: "repository", url: `https://github.com/example/repo-${index}`, description: `Synthetic motion-cost fixture ${index}`, language: index % 3 === 0 ? "Rust" : index % 3 === 1 ? "JavaScript" : "Python", stars: index % 37, forks: index % 11, fork: false, archived: false, relation: "owned", repositoryName: `repo-${index}`, groupId: `g${groupIndex}`, groupLabel: `Group ${groupIndex + 1}`, topics: ["performance"] };
  });
  return { owner: "example", generatedAt: "2026-08-30T00:00:00Z", nodes: [{ id: "user:example", label: "example", type: "owner", url: "https://github.com/example" }, ...groups, ...repositories], edges: [...groups.map((group) => ({ source: "user:example", target: group.id, type: "ownership" })), ...repositories.map((repository, index) => ({ source: groups[index % groupCount].id, target: repository.id, type: "membership" }))] };
}

async function sampleFrames(page, windowMs = 5000) {
  const samples = await page.evaluate((duration) => new Promise((resolve) => {
    const values = []; let previous = null; let frame = 0; let done = false;
    const finish = () => { if (done) return; done = true; if (frame) cancelAnimationFrame(frame); resolve(values); };
    setTimeout(finish, duration);
    const step = (now) => { if (done) return; if (previous !== null) values.push(now - previous); previous = now; frame = requestAnimationFrame(step); };
    frame = requestAnimationFrame(step);
  }), windowMs);
  const sorted = [...samples].sort((a, b) => a - b);
  return { windowMs, count: samples.length, observedFps: samples.length / (windowMs / 1000), p50Ms: sorted[Math.floor(sorted.length * 0.5)] ?? null, p95Ms: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? null };
}

async function measure(page, motionOff) {
  await page.goto(`/three/?username=example${motionOff ? "&motion=off" : ""}`);
  await expect(page.locator("#status")).toHaveClass(/ready/, { timeout: 20000 });
  await expect.poll(() => page.evaluate(() => window.ProjectMapRenderer?.snapshot()?.semantic.repositories)).toBe(480);
  const motionPressed = await page.locator("#motionToggle").getAttribute("aria-pressed");
  expect(motionPressed).toBe(motionOff ? "false" : "true");
  return { motionOff, renderer: await page.evaluate(() => window.ProjectMapRenderer.snapshot()), frames: await sampleFrames(page) };
}

test("480-repository Three.js motion on/off cost discriminator", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Performance evidence is Chromium-only.");
  test.setTimeout(45000);
  const fixture = buildGraph();
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture) }));
  const motionOn = await measure(page, false);
  const motionOff = await measure(page, true);
  expect(motionOn.frames.count).toBeGreaterThan(0);
  expect(motionOff.frames.count).toBeGreaterThan(0);
  await mkdir(".tmp/playwright-visual", { recursive: true });
  await writeFile(".tmp/playwright-visual/threejs-motion-cost-480.json", `${JSON.stringify({ repositoryCount: 480, motionOn, motionOff }, null, 2)}\n`, "utf8");
});
