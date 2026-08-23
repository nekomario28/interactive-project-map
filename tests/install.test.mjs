import test from "node:test";
import assert from "node:assert/strict";
import { PROJECT_MAP_ACTION_REF } from "../src/action-ref.ts";
import { installOptionsFromUrl, normalizeGeneratorRef, normalizeStyle, renderInstallWorkflow, staticAssetUrls, supportsOneClickInstall } from "../src/install.ts";

const PINNED_REF = "151b9cabd5968cdfb602115fc440795c14f88745";

test("install options preserve generator choices and default Contributed off on stable v1", () => {
  const url = new URL("https://maps.example/api/install-workflow?username=OctoCat&theme=light&style=sankey&max_repos=75&forks=false&archived=true");
  assert.deepEqual(installOptionsFromUrl(url), {
    username: "octocat",
    theme: "light",
    style: "sankey",
    maxRepos: 75,
    includeForks: false,
    includeArchived: true,
    includeContributed: false,
    generatorRef: "v1",
  });
});

test("install options accept an explicit Contributed opt-in", () => {
  const url = new URL("https://maps.example/api/install-workflow?username=OctoCat&contributed=true");
  assert.equal(installOptionsFromUrl(url).includeContributed, true);
});

test("one-click installer remains available by default but fails closed for Contributed opt-in", () => {
  const defaults = installOptionsFromUrl(new URL("https://maps.example/api/install-workflow?username=octocat"));
  const contributed = installOptionsFromUrl(new URL("https://maps.example/api/install-workflow?username=octocat&contributed=true"));
  assert.equal(supportsOneClickInstall(defaults), true);
  assert.equal(supportsOneClickInstall(contributed), false);
});

test("style accepts the twelve public presets and preserves legacy galaxy alias", () => {
  const styles = ["radial", "galaxy-classic", "galaxy-systems", "galaxy-hybrid", "obsidian", "tree", "treemap", "timeline", "cluster", "sunburst", "matrix", "sankey"];
  for (const style of styles) assert.equal(normalizeStyle(style), style);
  assert.equal(normalizeStyle("galaxy"), "galaxy-systems");
  assert.equal(normalizeStyle(null), "radial");
  assert.throws(() => normalizeStyle("unknown"), /Invalid style/);
});

test("advanced generator ref accepts only v1 or a commit SHA", () => {
  assert.equal(normalizeGeneratorRef(null), "v1");
  assert.equal(normalizeGeneratorRef(" V1 "), "v1");
  assert.equal(normalizeGeneratorRef(PINNED_REF.toUpperCase()), PINNED_REF);
  assert.throws(() => normalizeGeneratorRef("main"), /Invalid generator_ref/);
  assert.throws(() => normalizeGeneratorRef("deadbeef"), /Invalid generator_ref/);
});

test("static asset URLs use the profile repository default branch and preserve style in viewer state", () => {
  const options = {
    username: "octocat",
    theme: "dark",
    style: "matrix",
    maxRepos: 80,
    includeForks: false,
    includeArchived: true,
  };
  const urls = staticAssetUrls("https://maps.example", options);
  assert.equal(urls.svg, "https://raw.githubusercontent.com/octocat/octocat/HEAD/project-map/galaxy.svg");
  assert.equal(urls.graph, "https://raw.githubusercontent.com/octocat/octocat/HEAD/project-map/graph.json");
  assert.equal(urls.viewer, "https://maps.example/u/octocat?style=matrix&max_repos=80&forks=false&archived=true");
});

test("generated workflow follows stable v1 generation, emits default-off Contributed, and keeps write publishing local", () => {
  const workflow = renderInstallWorkflow({
    username: "octocat",
    theme: "dark",
    style: "galaxy-hybrid",
    maxRepos: 100,
    includeForks: true,
    includeArchived: false,
  });

  assert.match(workflow, /generate:\n[\s\S]*permissions:\n      contents: read/);
  assert.match(workflow, /uses: nekomario28\/interactive-project-map\/\.github\/workflows\/generate-project-map\.yml@v1/);
  assert.match(workflow, /# Project Map generator policy: stable-v1/);
  assert.match(workflow, new RegExp(`# Reviewed immutable inner Action baseline: nekomario28\\/interactive-project-map@${PROJECT_MAP_ACTION_REF}`));
  assert.match(workflow, /style: galaxy-hybrid/);
  assert.match(workflow, /max_repos: "100"/);
  assert.match(workflow, /contributed: false/);
  assert.doesNotMatch(workflow, /actions\/upload-artifact@/);

  assert.match(workflow, /publish:\n[\s\S]*permissions:\n      actions: read\n      contents: write/);
  assert.match(workflow, /actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1/);
  assert.match(workflow, /actions\/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c/);
  assert.match(workflow, /if git diff --cached --quiet/);

  const generateBlock = workflow.slice(workflow.indexOf("  generate:"), workflow.indexOf("  publish:"));
  assert.doesNotMatch(generateBlock, /contents: write/);
});

test("generated workflow forwards explicit Contributed opt-in", () => {
  const workflow = renderInstallWorkflow({
    username: "octocat",
    theme: "dark",
    style: "radial",
    maxRepos: 100,
    includeForks: true,
    includeArchived: false,
    includeContributed: true,
  });
  assert.match(workflow, /contributed: true/);
});

test("generated workflow can pin the reusable generator to an immutable SHA", () => {
  const workflow = renderInstallWorkflow({
    username: "octocat",
    theme: "dark",
    style: "radial",
    maxRepos: 100,
    includeForks: true,
    includeArchived: false,
    generatorRef: PINNED_REF,
  });
  assert.match(workflow, new RegExp(`generate-project-map\\.yml@${PINNED_REF}`));
  assert.match(workflow, new RegExp(`# Project Map generator policy: pinned-${PINNED_REF}`));
  assert.match(workflow, /contributed: false/);
  assert.doesNotMatch(workflow, /generate-project-map\.yml@v1/);
});