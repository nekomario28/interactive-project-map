import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

import { PROJECT_MAP_ACTION_REF } from "../src/action-ref.ts";
import { renderInstallWorkflow } from "../src/install.ts";

const PINNED_REF = "151b9cabd5968cdfb602115fc440795c14f88745";

function element(id) {
  return {
    id,
    value: id === "maxRepos" ? "100" : id === "theme" ? "dark" : id === "mapStyle" ? "radial" : "",
    checked: id === "forks",
    textContent: "",
    href: "",
    src: "",
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {},
    setAttribute() {},
    select() {},
  };
}

async function publicWorkflowFor(options) {
  const raw = await readFile(new URL("../scripts/public-home.js", import.meta.url), "utf8");
  const source = raw.replaceAll("__PROJECT_MAP_ACTION_REF__", PROJECT_MAP_ACTION_REF);
  const elements = new Map();
  const actions = { querySelector() { return null; }, insertBefore() {} };
  const context = {
    URL,
    Set,
    console,
    setTimeout() {},
    location: { href: "https://maps.example/" },
    history: { replaceState() {} },
    navigator: { clipboard: { async writeText() {} } },
    document: {
      getElementById(id) { if (!elements.has(id)) elements.set(id, element(id)); return elements.get(id); },
      querySelector(selector) { return selector === ".actions" ? actions : null; },
      querySelectorAll() { return []; },
      createElement(tag) { return element(tag); },
      execCommand() { return true; },
    },
  };
  vm.createContext(context);
  new vm.Script(source, { filename: "scripts/public-home.js" }).runInContext(context);
  context.__workflowOptions = options;
  return vm.runInContext("workflowFor(__workflowOptions)", context);
}

for (const scenario of [
  {
    name: "stable default",
    browser: { theme: "dark", style: "radial", maxRepos: 100, forks: true, archived: false, contributed: false, generatorRef: "v1" },
    worker: { username: "octocat", theme: "dark", style: "radial", maxRepos: 100, includeForks: true, includeArchived: false, includeContributed: false, generatorRef: "v1" },
  },
  {
    name: "stable contributed galaxy",
    browser: { theme: "light", style: "galaxy-systems", maxRepos: 300, forks: false, archived: true, contributed: true, generatorRef: "v1" },
    worker: { username: "octocat", theme: "light", style: "galaxy-systems", maxRepos: 300, includeForks: false, includeArchived: true, includeContributed: true, generatorRef: "v1" },
  },
  {
    name: "pinned generator",
    browser: { theme: "dark", style: "matrix", maxRepos: 42, forks: true, archived: true, contributed: false, generatorRef: PINNED_REF },
    worker: { username: "octocat", theme: "dark", style: "matrix", maxRepos: 42, includeForks: true, includeArchived: true, includeContributed: false, generatorRef: PINNED_REF },
  },
]) {
  test(`public Pages and dormant Worker workflow serializers stay byte-identical: ${scenario.name}`, async () => {
    assert.equal(await publicWorkflowFor(scenario.browser), renderInstallWorkflow(scenario.worker));
  });
}
