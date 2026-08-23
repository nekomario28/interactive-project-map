import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const PINNED_REF = "151b9cabd5968cdfb602115fc440795c14f88745";

function element(id) {
  const parentLabel = { after() {} };
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
    append() {},
    closest(selector) { return selector === "label" ? parentLabel : null; },
    select() {},
  };
}

test("Pages setup keeps stable v1 hidden by default and accepts only immutable SHA pins", async () => {
  const source = await readFile(new URL("../scripts/public-home.js", import.meta.url), "utf8");
  const elements = new Map();
  const actions = { querySelector() { return null; }, insertBefore() {} };
  const context = {
    URL,
    Set,
    console,
    setTimeout() {},
    location: { href: `https://maps.example/?generator_ref=${PINNED_REF}` },
    history: { replaceState() {} },
    navigator: { clipboard: { async writeText() {} } },
    document: {
      getElementById(id) { if (!elements.has(id)) elements.set(id, element(id)); return elements.get(id); },
      querySelector(selector) { return selector === ".actions" ? actions : null; },
      querySelectorAll() { return []; },
      createElement(tag) { return element(tag); },
      createTextNode(text) { return { textContent: text }; },
      execCommand() { return true; },
    },
  };
  vm.createContext(context);
  new vm.Script(source, { filename: "scripts/public-home.js" }).runInContext(context);

  assert.equal(vm.runInContext("normalizeGeneratorRef(null)", context), "v1");
  assert.equal(vm.runInContext(`normalizeGeneratorRef('${PINNED_REF.toUpperCase()}')`, context), PINNED_REF);
  assert.equal(vm.runInContext("normalizeGeneratorRef('main')", context), null);

  const pinned = vm.runInContext(`workflowFor({theme:'dark',style:'radial',maxRepos:100,forks:true,archived:false,contributed:false,generatorRef:'${PINNED_REF}'})`, context);
  assert.match(pinned, new RegExp(`generate-project-map\\.yml@${PINNED_REF}`));
  assert.match(pinned, new RegExp(`Project Map generator policy: pinned-${PINNED_REF}`));
  assert.match(pinned, /contributed: false/);

  const stable = vm.runInContext("workflowFor({theme:'dark',style:'radial',maxRepos:100,forks:true,archived:false,contributed:true,generatorRef:'v1'})", context);
  assert.match(stable, /generate-project-map\.yml@v1/);
  assert.match(stable, /Project Map generator policy: stable-v1/);
  assert.match(stable, /contributed: true/);
});