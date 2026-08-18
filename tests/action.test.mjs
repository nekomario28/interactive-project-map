import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { actionConfigFromEnv, generateStaticMap, safeOutputDir } from "../scripts/action.mjs";

function repo(id, name, overrides = {}) {
  return {
    id,
    name,
    html_url: `https://github.com/example/${name}`,
    description: null,
    language: "TypeScript",
    topics: [],
    stargazers_count: 0,
    forks_count: 0,
    fork: false,
    archived: false,
    created_at: "2025-08-18T00:00:00Z",
    updated_at: "2026-08-18T00:00:00Z",
    ...overrides,
  };
}

test("action config reads INPUT variables, normalizes and clamps inputs", () => {
  const config = actionConfigFromEnv({
    INPUT_USERNAME: " OctoCat ", INPUT_THEME: "light", INPUT_STYLE: "obsidian", INPUT_MAX_REPOS: "999",
    INPUT_FORKS: "false", INPUT_ARCHIVED: "yes", INPUT_WIDTH: "200", INPUT_HEIGHT: "9999", INPUT_OUTPUT_DIR: "./project-map/custom",
  });
  assert.equal(config.username, "octocat");
  assert.equal(config.theme, "light");
  assert.equal(config.style, "obsidian");
  assert.equal(config.maxRepos, 300);
  assert.equal(config.includeForks, false);
  assert.equal(config.includeArchived, true);
  assert.equal(config.width, 420);
  assert.equal(config.height, 1000);
  assert.equal(config.outputDir, "project-map/custom");
});

test("action username and style preserve classic radial default while accepting all presets", () => {
  const fallback = actionConfigFromEnv({ GITHUB_REPOSITORY_OWNER: "OctoCat", INPUT_STYLE: "unknown" });
  assert.equal(fallback.username, "octocat");
  assert.equal(fallback.style, "radial");
  for (const style of ["radial", "galaxy", "obsidian", "tree", "treemap", "timeline", "cluster"]) {
    assert.equal(actionConfigFromEnv({ GITHUB_REPOSITORY_OWNER: "OctoCat", INPUT_STYLE: style }).style, style);
  }
});

test("output directory rejects traversal and absolute paths", () => {
  assert.throws(() => safeOutputDir("../outside"));
  assert.throws(() => safeOutputDir("project-map/../outside"));
  assert.throws(() => safeOutputDir("/tmp/project-map"));
  assert.throws(() => safeOutputDir("C:/tmp/project-map"));
});

test("static action writes graph.json and tree SVG without needing write access", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "project-map-action-"));
  let received;
  try {
    const config = actionConfigFromEnv({ INPUT_USERNAME: "example", INPUT_STYLE: "tree", INPUT_FORKS: "false", INPUT_ARCHIVED: "false", INPUT_OUTPUT_DIR: "project-map" });
    const fetchRepos = async (username, token, maxRepos, options) => {
      received = { username, token, maxRepos, options };
      return [repo(1, "alpha"), repo(2, "beta", { fork: true })];
    };
    const result = await generateStaticMap(config, { cwd, token: "read-token", fetchRepos });
    assert.deepEqual(received, { username: "example", token: "read-token", maxRepos: 100, options: { includeForks: false, includeArchived: false } });
    assert.equal(result.svgPath, "project-map/galaxy.svg");
    assert.equal(result.graphPath, "project-map/graph.json");
    const graph = JSON.parse(await readFile(join(cwd, result.graphPath), "utf8"));
    const svg = await readFile(join(cwd, result.svgPath), "utf8");
    assert.equal(graph.owner, "example");
    assert.equal(graph.repositoryCount, 2);
    assert.equal(graph.nodes.find((node) => node.type === "repository")?.createdAt, "2025-08-18T00:00:00Z");
    assert.match(svg, /Tree-style map/);
    assert.match(svg, />Original<\/text>/);
    assert.match(svg, />Fork<\/text>/);
    assert.match(svg, />Archived<\/text>/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("unchanged repository data preserves generatedAt so scheduled runs are commit-free", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "project-map-stable-"));
  try {
    const config = actionConfigFromEnv({ INPUT_USERNAME: "example", INPUT_OUTPUT_DIR: "project-map" });
    const fetchRepos = async () => [repo(1, "alpha")];
    const first = await generateStaticMap(config, { cwd, token: "read-token", fetchRepos });
    const graphPath = join(cwd, first.graphPath);
    const previous = JSON.parse(await readFile(graphPath, "utf8"));
    previous.generatedAt = "2026-01-01T00:00:00.000Z";
    await writeFile(graphPath, JSON.stringify(previous, null, 2) + "\n");
    await generateStaticMap(config, { cwd, token: "read-token", fetchRepos });
    const second = JSON.parse(await readFile(graphPath, "utf8"));
    assert.equal(second.generatedAt, "2026-01-01T00:00:00.000Z");
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
