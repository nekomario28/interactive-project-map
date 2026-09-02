import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

import { PROJECT_MAP_ACTION_REF } from "../src/action-ref.ts";
import { renderInstallWorkflow } from "../src/install.ts";

function element(id) {
  return {
    id,
    value: id === "maxRepos" ? "100" : id === "theme" ? "dark" : id === "mapStyle" ? "radial" : "",
    checked: id === "forks",
    textContent: "",
    href: "",
    src: "",
    dataset: {},
    hidden: false,
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {},
    setAttribute() {},
    select() {},
    click() {},
  };
}

async function pagesWorkflowContext() {
  const source = (await readFile(new URL("../scripts/public-home.js", import.meta.url), "utf8"))
    .replaceAll("__PROJECT_MAP_ACTION_REF__", PROJECT_MAP_ACTION_REF);
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
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, element(id));
        return elements.get(id);
      },
      querySelector(selector) { return selector === ".actions" ? actions : null; },
      querySelectorAll() { return []; },
      createElement(tag) { return element(tag); },
      execCommand() { return true; },
    },
  };
  vm.createContext(context);
  new vm.Script(source, { filename: "scripts/public-home.js" }).runInContext(context);
  return context;
}

function pagesWorkflow(context, options) {
  context.__workflowOptions = options;
  return vm.runInContext("workflowFor(__workflowOptions)", context);
}

test("Pages and dormant Worker serialize the same managed workflow", async () => {
  const context = await pagesWorkflowContext();
  const pinnedRef = "151B9CABD5968CDFB602115FC440795C14F88745";
  const cases = [
    {
      username: "octocat",
      theme: "dark",
      style: "radial",
      maxRepos: 100,
      includeForks: true,
      includeArchived: false,
    },
    {
      username: "octocat",
      theme: "light",
      style: "galaxy-systems",
      maxRepos: 37,
      includeForks: false,
      includeArchived: true,
      includeContributed: true,
      generatorRef: pinnedRef,
    },
    {
      username: "octocat",
      theme: "dark",
      style: "matrix",
      maxRepos: 300,
      includeForks: true,
      includeArchived: true,
      includeContributed: false,
      generatorRef: "v1",
    },
  ];

  for (const options of cases) {
    const worker = renderInstallWorkflow(options);
    const pages = pagesWorkflow(context, {
      theme: options.theme,
      style: options.style,
      maxRepos: options.maxRepos,
      forks: options.includeForks,
      archived: options.includeArchived,
      contributed: options.includeContributed,
      generatorRef: options.generatorRef,
    });
    assert.equal(pages, worker);
  }
});

test("Pages build source uses the reviewed Action ref directly", async () => {
  const source = await readFile(new URL("../scripts/build-public-pages.mjs", import.meta.url), "utf8");
  assert.match(source, /import \{ PROJECT_MAP_ACTION_REF \} from "\.\.\/src\/action-ref\.ts"/);
  assert.match(source, /export const PUBLIC_ACTION_REF = PROJECT_MAP_ACTION_REF/);
  assert.doesNotMatch(source, /30c33c76008b282de8990333c879ae8c1da853d7/);
});
