import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { actionConfigFromEnv, generateStaticMap, safeOutputDir } from "../scripts/action.mjs";

function repo(id, name, overrides = {}) {
  return {
    id, name, html_url: `https://github.com/example/${name}`, description: null, language: "TypeScript", topics: [],
    stargazers_count: 0, forks_count: 0, fork: false, archived: false,
    created_at: "2025-08-18T00:00:00Z", updated_at: "2026-08-18T00:00:00Z", ...overrides,
  };
}

test("action config reads INPUT variables, normalizes and clamps inputs", () => {
  const config = actionConfigFromEnv({ INPUT_USERNAME: " OctoCat ", INPUT_THEME: "light", INPUT_STYLE: "obsidian", INPUT_MAX_REPOS: "999", INPUT_FORKS: "false", INPUT_ARCHIVED: "yes", INPUT_CONTRIBUTED: "true", INPUT_WIDTH: "200", INPUT_HEIGHT: "9999", INPUT_OUTPUT_DIR: "./project-map/custom" });
  assert.equal(config.username, "octocat"); assert.equal(config.theme, "light"); assert.equal(config.style, "obsidian"); assert.equal(config.maxRepos, 300); assert.equal(config.includeForks, false); assert.equal(config.includeArchived, true); assert.equal(config.includeContributed, true); assert.equal(config.width, 420); assert.equal(config.height, 1000); assert.equal(config.outputDir, "project-map/custom");
  assert.equal(actionConfigFromEnv({ GITHUB_REPOSITORY_OWNER: "octocat" }).includeContributed, false);
});

test("action accepts twelve visible presets and maps legacy galaxy to systems", () => {
  const fallback = actionConfigFromEnv({ GITHUB_REPOSITORY_OWNER: "OctoCat", INPUT_STYLE: "unknown" });
  assert.equal(fallback.username, "octocat"); assert.equal(fallback.style, "radial");
  const visible = ["radial", "galaxy-classic", "galaxy-systems", "galaxy-hybrid", "obsidian", "tree", "treemap", "timeline", "cluster", "sunburst", "matrix", "sankey"];
  for (const style of visible) assert.equal(actionConfigFromEnv({ GITHUB_REPOSITORY_OWNER: "OctoCat", INPUT_STYLE: style }).style, style);
  assert.equal(actionConfigFromEnv({ GITHUB_REPOSITORY_OWNER: "OctoCat", INPUT_STYLE: "galaxy" }).style, "galaxy-systems");
});

test("output directory rejects traversal and absolute paths", () => {
  assert.throws(() => safeOutputDir("../outside")); assert.throws(() => safeOutputDir("project-map/../outside")); assert.throws(() => safeOutputDir("/tmp/project-map")); assert.throws(() => safeOutputDir("C:/tmp/project-map"));
});

test("static action writes graph.json and tree SVG without needing write access", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "project-map-action-")); let received;
  try {
    const config = actionConfigFromEnv({ INPUT_USERNAME: "example", INPUT_STYLE: "tree", INPUT_FORKS: "false", INPUT_ARCHIVED: "false", INPUT_OUTPUT_DIR: "project-map" });
    const fetchRepos = async (username, token, maxRepos, options) => { received = { username, token, maxRepos, options }; return [repo(1, "alpha"), repo(2, "beta", { fork: true })]; };
    const result = await generateStaticMap(config, { cwd, token: "read-token", fetchRepos });
    assert.deepEqual(received, { username: "example", token: "read-token", maxRepos: 100, options: { includeForks: false, includeArchived: false } });
    assert.equal(result.svgPath, "project-map/galaxy.svg"); assert.equal(result.graphPath, "project-map/graph.json");
    const graph = JSON.parse(await readFile(join(cwd, result.graphPath), "utf8")); const svg = await readFile(join(cwd, result.svgPath), "utf8");
    assert.equal(graph.owner, "example"); assert.equal(graph.repositoryCount, 2); assert.equal(graph.contributedRepositoryCount, undefined); assert.equal(graph.nodes.find((node) => node.type === "repository")?.createdAt, "2025-08-18T00:00:00Z");
    assert.match(svg, /Tree-style map/); assert.match(svg, />Original<\/text>/); assert.match(svg, />Fork<\/text>/); assert.match(svg, />Archived<\/text>/);
  } finally { await rm(cwd, { recursive: true, force: true }); }
});

test("C3 opt-in generator fetches once, ranks after owned graph creation, and serializes Contributed", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "project-map-contributed-"));
  try {
    const config = actionConfigFromEnv({ INPUT_USERNAME: "example", INPUT_CONTRIBUTED: "true", INPUT_STYLE: "radial", INPUT_OUTPUT_DIR: "project-map" });
    const fetchRepos = async () => [repo(1, "alpha"), repo(2, "beta"), repo(3, "example")];
    let calls = 0;
    const fetchContributions = async (username, token) => {
      calls += 1;
      assert.equal(username, "example");
      assert.equal(token, "read-token");
      return {
        window: { from: "2025-08-22T00:00:00.000Z", to: "2026-08-22T00:00:00.000Z" },
        repositories: [
          { nameWithOwner: "upstream/core", owner: "upstream", name: "core", url: "https://github.com/upstream/core", description: "robotics runtime", language: "C++", topics: ["robotics"], stars: 10, forks: 2, fork: false, archived: false, createdAt: "2020-01-01T00:00:00Z", updatedAt: "2026-08-20T00:00:00Z", commits: 0, pullRequests: 1, mergedPullRequests: 1, commitsTruncated: false, pullRequestsTruncated: false },
          { nameWithOwner: "upstream/second", owner: "upstream", name: "second", url: "https://github.com/upstream/second", description: "second contribution", language: "Rust", topics: [], stars: 0, forks: 0, fork: false, archived: false, createdAt: "2020-01-01T00:00:00Z", updatedAt: "2026-08-19T00:00:00Z", commits: 2, pullRequests: 0, mergedPullRequests: 0, commitsTruncated: false, pullRequestsTruncated: false },
        ],
        diagnostics: { maxRepositories: 100, returnedRepositories: 2, truncatedRepositories: 0 },
      };
    };
    const result = await generateStaticMap(config, { cwd, token: "read-token", fetchRepos, contributionOptions: { fetchContributions } });
    assert.equal(calls, 1);
    assert.equal(result.graph.repositoryCount, 2, "profile repository remains excluded from owned count");
    assert.equal(result.graph.contributedRepositoryCount, 2);
    assert.equal(result.graph.externalContributions.cap, 4, "C1 cap uses the built owned repository count");
    assert.equal(result.graph.nodes.filter((node) => node.relation === "contributed").length, 2);
    assert.deepEqual(result.graph.edges.filter((edge) => edge.type === "contribution").map((edge) => edge.target).sort(), ["repository:upstream/core", "repository:upstream/second"]);
    const serialized = JSON.parse(await readFile(join(cwd, result.graphPath), "utf8"));
    assert.equal(serialized.contributedRepositoryCount, 2);
    assert.equal(serialized.nodes.find((node) => node.id === "repository:upstream/core")?.contribution.mergedPullRequests, 1);
  } finally { await rm(cwd, { recursive: true, force: true }); }
});

test("static action dispatches all three Galaxy renderers", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "project-map-galaxy-family-"));
  try {
    const fetchRepos = async () => [repo(1, "alpha"), repo(2, "beta"), repo(3, "gamma")];
    for (const [style, marker] of [["galaxy-classic", 'data-galaxy-preset="classic"'], ["galaxy-systems", 'data-galaxy-preset="systems"'], ["galaxy-hybrid", 'data-galaxy-preset="hybrid"']]) {
      const config = actionConfigFromEnv({ INPUT_USERNAME: "example", INPUT_STYLE: style, INPUT_OUTPUT_DIR: `project-map-${style}` });
      const result = await generateStaticMap(config, { cwd, token: "read-token", fetchRepos });
      const svg = await readFile(join(cwd, result.svgPath), "utf8");
      assert.match(svg, new RegExp(marker));
      assert.equal(result.graph.repositoryCount, 3);
    }
  } finally { await rm(cwd, { recursive: true, force: true }); }
});

test("static action renders Matrix and Sankey through the same immutable output contract", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "project-map-analytics-"));
  try {
    const fetchRepos = async () => [repo(1, "alpha"), repo(2, "beta", { language: "Python", fork: true }), repo(3, "gamma", { archived: true })];
    for (const [style, marker] of [["matrix", "Matrix / Heatmap"], ["sankey", "Sankey"]]) {
      const config = actionConfigFromEnv({ INPUT_USERNAME: "example", INPUT_STYLE: style, INPUT_ARCHIVED: "true", INPUT_OUTPUT_DIR: `project-map-${style}` });
      const result = await generateStaticMap(config, { cwd, token: "read-token", fetchRepos });
      const svg = await readFile(join(cwd, result.svgPath), "utf8");
      assert.match(svg, new RegExp(marker.replace("/", "\\/")));
      assert.equal(result.graph.repositoryCount, 3);
    }
  } finally { await rm(cwd, { recursive: true, force: true }); }
});

test("unchanged repository data preserves generatedAt so scheduled runs are commit-free", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "project-map-stable-"));
  try {
    const config = actionConfigFromEnv({ INPUT_USERNAME: "example", INPUT_OUTPUT_DIR: "project-map" }); const fetchRepos = async () => [repo(1, "alpha")];
    const first = await generateStaticMap(config, { cwd, token: "read-token", fetchRepos }); const graphPath = join(cwd, first.graphPath); const previous = JSON.parse(await readFile(graphPath, "utf8")); previous.generatedAt = "2026-01-01T00:00:00.000Z"; await writeFile(graphPath, JSON.stringify(previous, null, 2) + "\n");
    await generateStaticMap(config, { cwd, token: "read-token", fetchRepos }); const second = JSON.parse(await readFile(graphPath, "utf8")); assert.equal(second.generatedAt, "2026-01-01T00:00:00.000Z");
  } finally { await rm(cwd, { recursive: true, force: true }); }
});

// Verified Fork/Contributed identity collapse is source-grounded, not a label comparison.
test("generation suppresses an exact upstream fork, preserves linked-fork evidence, and emits owner stats", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "project-map-owner-stats-"));
  try {
    const config = actionConfigFromEnv({ INPUT_USERNAME: "example", INPUT_CONTRIBUTED: "true", INPUT_STYLE: "galaxy-systems", INPUT_OUTPUT_DIR: "project-map" });
    const fetchedRepos = async () => [
      repo(1, "ruff", { fork: true, stargazers_count: 999 }),
      repo(2, "my-original", { fork: false, stargazers_count: 7 }),
    ];
    const fetchContributions = async () => ({
      window: { from: "2025-11-01T00:00:00.000Z", to: "2026-11-01T00:00:00.000Z" },
      repositories: [{
        nameWithOwner: "astral-sh/ruff", owner: "astral-sh", name: "ruff",
        url: "https://github.com/astral-sh/ruff", description: "", language: "Rust",
        commits: 4, pullRequests: 2, mergedPullRequests: 1, stars: 9999,
      }],
      diagnostics: { truncatedRepositories: 0 },
    });
    const forkFetchImpl = async (url) => {
      assert.equal(url, "https://api.github.com/repos/example/ruff");
      return { ok: true, json: async () => ({ fork: true, parent: { full_name: "astral-sh/ruff" } }) };
    };
    const result = await generateStaticMap(config, {
      cwd, token: "read-token", fetchRepos: fetchedRepos, fetchFollowers: async () => 42,
      contributionOptions: { fetchContributions, forkFetchImpl },
    });
    const graph = JSON.parse(await readFile(join(cwd, result.graphPath), "utf8"));
    assert.deepEqual(graph.nodes.filter((n) => n.type === "repository").map((n) => n.label).sort(), ["astral-sh/ruff", "my-original"]);
    assert.equal(graph.repositoryCount, 1);
    assert.equal(graph.contributedRepositoryCount, 1);
    assert.equal(graph.nodes.find((n) => n.relation === "contributed").forkUrl, "https://github.com/example/ruff");
    assert.deepEqual(graph.nodes.find((n) => n.type === "owner").profileStats, {
      ownedStars: 7, originalRepositories: 1, followers: 42, contributedRepositories: 1,
      mergedPullRequests: 1, commits: 4, limitedRepositories: false, limitedContributions: false,
    });
    const svg = await readFile(join(cwd, result.svgPath), "utf8");
    assert.match(svg, /★7/);
    assert.match(svg, /42 followers/);
    // The generated SVG itself must contain the upstream node, never the duplicate Fork.
    assert.match(svg, /<title>astral-sh\/ruff<\/title>/);
    assert.doesNotMatch(svg, /<title>ruff<\/title>/);
  } finally { await rm(cwd, { recursive: true, force: true }); }
});

test("generation never collapses an unrelated same-name fork", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "project-map-nonmatch-"));
  try {
    const config = actionConfigFromEnv({ INPUT_USERNAME: "example", INPUT_CONTRIBUTED: "true", INPUT_STYLE: "radial", INPUT_OUTPUT_DIR: "project-map" });
    const result = await generateStaticMap(config, {
      cwd, token: "read-token",
      fetchRepos: async () => [repo(1, "ruff", { fork: true })],
      contributionOptions: {
        fetchContributions: async () => ({
          window: { from: "2025-11-01T00:00:00.000Z", to: "2026-11-01T00:00:00.000Z" },
          repositories: [{ nameWithOwner: "astral-sh/ruff", owner: "astral-sh", name: "ruff",
            url: "https://github.com/astral-sh/ruff", commits: 1, pullRequests: 0, mergedPullRequests: 0 }],
          diagnostics: { truncatedRepositories: 0 },
        }),
        forkFetchImpl: async () => ({ ok: true, json: async () => ({ fork: true, parent: { full_name: "other/ruff" } }) }),
      },
    });
    const graph = JSON.parse(await readFile(join(cwd, result.graphPath), "utf8"));
    assert.equal(graph.nodes.filter((n) => n.type === "repository").length, 2);
    assert.equal(graph.nodes.find((n) => n.relation === "contributed").forkUrl, undefined);
  } finally { await rm(cwd, { recursive: true, force: true }); }
});
