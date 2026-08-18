import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
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
    updated_at: "2026-08-18T00:00:00Z",
    ...overrides,
  };
}

test("action config reads INPUT variables, normalizes and clamps inputs", () => {
  const config = actionConfigFromEnv({
    INPUT_USERNAME: " OctoCat ",
    INPUT_THEME: "light",
    INPUT_MAX_REPOS: "999",
    INPUT_FORKS: "false",
    INPUT_ARCHIVED: "yes",
    INPUT_WIDTH: "200",
    INPUT_HEIGHT: "9999",
    INPUT_OUTPUT_DIR: "./project-map/custom",
  });
  assert.equal(config.username, "octocat");
  assert.equal(config.theme, "light");
  assert.equal(config.maxRepos, 300);
  assert.equal(config.includeForks, false);
  assert.equal(config.includeArchived, true);
  assert.equal(config.width, 420);
  assert.equal(config.height, 1000);
  assert.equal(config.outputDir, "project-map/custom");
});

test("action username falls back to the caller repository owner", () => {
  assert.equal(actionConfigFromEnv({ GITHUB_REPOSITORY_OWNER: "OctoCat" }).username, "octocat");
});

test("output directory rejects traversal and absolute paths", () => {
  assert.throws(() => safeOutputDir("../outside"));
  assert.throws(() => safeOutputDir("project-map/../outside"));
  assert.throws(() => safeOutputDir("/tmp/project-map"));
  assert.throws(() => safeOutputDir("C:/tmp/project-map"));
});

test("static action writes graph.json and galaxy.svg without needing write access", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "project-map-action-"));
  let received;
  try {
    const config = actionConfigFromEnv({
      INPUT_USERNAME: "example",
      INPUT_FORKS: "false",
      INPUT_ARCHIVED: "false",
      INPUT_OUTPUT_DIR: "project-map",
    });
    const fetchRepos = async (username, token, maxRepos, options) => {
      received = { username, token, maxRepos, options };
      return [repo(1, "alpha"), repo(2, "beta")];
    };
    const result = await generateStaticMap(config, { cwd, token: "read-token", fetchRepos });
    assert.deepEqual(received, {
      username: "example",
      token: "read-token",
      maxRepos: 100,
      options: { includeForks: false, includeArchived: false },
    });
    assert.equal(result.svgPath, "project-map/galaxy.svg");
    assert.equal(result.graphPath, "project-map/graph.json");
    const graph = JSON.parse(await readFile(join(cwd, result.graphPath), "utf8"));
    const svg = await readFile(join(cwd, result.svgPath), "utf8");
    assert.equal(graph.owner, "example");
    assert.equal(graph.repositoryCount, 2);
    assert.match(svg, /<svg/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
