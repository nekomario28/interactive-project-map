import test from "node:test";
import assert from "node:assert/strict";
import { PROJECT_MAP_ACTION_REF } from "../src/action-ref.ts";
import { installOptionsFromUrl, renderInstallWorkflow, staticAssetUrls } from "../src/install.ts";

test("install options preserve generator choices", () => {
  const url = new URL("https://maps.example/api/install-workflow?username=OctoCat&theme=light&max_repos=75&forks=false&archived=true");
  assert.deepEqual(installOptionsFromUrl(url), {
    username: "octocat",
    theme: "light",
    maxRepos: 75,
    includeForks: false,
    includeArchived: true,
  });
});

test("static asset URLs use the profile repository default branch and per-user viewer", () => {
  const options = {
    username: "octocat",
    theme: "dark",
    maxRepos: 80,
    includeForks: false,
    includeArchived: true,
  };
  const urls = staticAssetUrls("https://maps.example", options);
  assert.equal(urls.svg, "https://raw.githubusercontent.com/octocat/octocat/HEAD/project-map/galaxy.svg");
  assert.equal(urls.graph, "https://raw.githubusercontent.com/octocat/octocat/HEAD/project-map/graph.json");
  assert.equal(urls.viewer, "https://maps.example/u/octocat?max_repos=80&forks=false&archived=true");
});

test("generated workflow follows stable v1 generation and keeps write publishing local", () => {
  const workflow = renderInstallWorkflow({
    username: "octocat",
    theme: "dark",
    maxRepos: 100,
    includeForks: true,
    includeArchived: false,
  });

  assert.match(workflow, /generate:\n[\s\S]*permissions:\n      contents: read/);
  assert.match(workflow, /uses: nekomario28\/interactive-project-map\/\.github\/workflows\/generate-project-map\.yml@v1/);
  assert.match(workflow, new RegExp(`# Stable generator baseline: nekomario28\\/interactive-project-map@${PROJECT_MAP_ACTION_REF}`));
  assert.match(workflow, /style: radial/);
  assert.match(workflow, /max_repos: "100"/);
  assert.doesNotMatch(workflow, /actions\/upload-artifact@/);

  assert.match(workflow, /publish:\n[\s\S]*permissions:\n      actions: read\n      contents: write/);
  assert.match(workflow, /actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1/);
  assert.match(workflow, /actions\/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c/);
  assert.match(workflow, /if git diff --cached --quiet/);

  const generateBlock = workflow.slice(workflow.indexOf("  generate:"), workflow.indexOf("  publish:"));
  assert.doesNotMatch(generateBlock, /contents: write/);
});
