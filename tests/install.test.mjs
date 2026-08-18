import test from "node:test";
import assert from "node:assert/strict";
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

test("generated workflow isolates custom action from write permission", () => {
  const workflow = renderInstallWorkflow({
    username: "octocat",
    theme: "dark",
    maxRepos: 100,
    includeForks: true,
    includeArchived: false,
  });

  assert.match(workflow, /generate:\n[\s\S]*permissions:\n      contents: read/);
  assert.match(workflow, /publish:\n[\s\S]*permissions:\n      actions: read\n      contents: write/);
  assert.match(workflow, /uses: nekomario28\/interactive-project-map@v1/);
  assert.match(workflow, /github_token: \$\{\{ github\.token \}\}/);
  assert.match(workflow, /username: \$\{\{ github\.repository_owner \}\}/);
  assert.match(workflow, /actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1/);
  assert.match(workflow, /actions\/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a/);
  assert.match(workflow, /actions\/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c/);
  assert.match(workflow, /if git diff --cached --quiet/);

  const generateBlock = workflow.slice(workflow.indexOf("  generate:"), workflow.indexOf("  publish:"));
  assert.doesNotMatch(generateBlock, /contents: write/);
});
