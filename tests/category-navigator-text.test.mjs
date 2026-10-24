import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const PAYLOAD = "<img src=x onerror=alert(1)>";

function matches(element, selector) {
  if (!element?.tagName) return false;
  if (selector.startsWith("#")) return element.id === selector.slice(1);
  if (selector.startsWith(".")) return element.classes.has(selector.slice(1));
  if (selector.startsWith("[") && selector.endsWith("]")) return element.attributes.has(selector.slice(1, -1).split("=")[0]);
  return element.tagName === selector.toUpperCase();
}

function queryAll(element, selector) {
  const found = [];
  for (const child of element.children || []) {
    if (matches(child, selector)) found.push(child);
    found.push(...queryAll(child, selector));
  }
  return found;
}

function createElement(tag) {
  const element = {
    tagName: String(tag).toUpperCase(),
    id: "",
    type: "",
    hidden: false,
    title: "",
    children: [],
    parentElement: null,
    attributes: new Map(),
    classes: new Set(),
    dataset: {},
    nodeType: "element",
  };
  let className = "";
  let text = "";
  Object.defineProperty(element, "className", {
    get() { return className; },
    set(value) {
      className = String(value);
      element.classes = new Set(className.split(/\s+/).filter(Boolean));
    },
  });
  Object.defineProperty(element, "textContent", {
    get() {
      if (element.children.length) {
        return element.children.map((child) => child.nodeType === "text" ? child.text : child.textContent).join("");
      }
      return text;
    },
    set(value) {
      element.children = [];
      text = value == null ? "" : String(value);
    },
  });
  Object.defineProperty(element, "innerHTML", {
    set(value) {
      element.children = [];
      text = "";
      parseHtml(String(value), element);
    },
  });
  element.classList = {
    add(...names) {
      for (const name of names) element.classes.add(name);
      className = [...element.classes].join(" ");
    },
    toggle(name, force) {
      const on = force == null ? !element.classes.has(name) : Boolean(force);
      if (on) element.classes.add(name);
      else element.classes.delete(name);
      className = [...element.classes].join(" ");
    },
  };
  element.setAttribute = (name, value) => {
    element.attributes.set(name, String(value));
    if (name === "id") element.id = String(value);
  };
  element.getAttribute = (name) => element.attributes.get(name) ?? null;
  element.addEventListener = () => {};
  element.focus = () => {};
  element.append = (...nodes) => {
    for (const node of nodes) {
      node.parentElement = element;
      element.children.push(node);
    }
  };
  element.prepend = (...nodes) => {
    const copy = [...nodes];
    for (const node of copy.reverse()) {
      node.parentElement = element;
      element.children.unshift(node);
    }
  };
  element.replaceChildren = (...nodes) => {
    element.children = [];
    text = "";
    element.append(...nodes);
  };
  element.querySelector = (selector) => queryAll(element, selector)[0] || null;
  element.querySelectorAll = (selector) => queryAll(element, selector);
  element.closest = (selector) => {
    let node = element;
    while (node) {
      if (matches(node, selector)) return node;
      node = node.parentElement;
    }
    return null;
  };
  return element;
}

function parseHtml(html, parent) {
  const pattern = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w:-]*)([^>]*)>|([^<]+)/g;
  const stack = [parent];
  for (const match of html.matchAll(pattern)) {
    if (match[0].startsWith("<!--")) continue;
    if (match[4] != null) {
      if (!match[4].trim()) continue;
      const text = { nodeType: "text", text: match[4], children: [] };
      stack.at(-1).children.push(text);
      continue;
    }
    const closing = match[1] === "/";
    const tag = match[2].toLowerCase();
    if (closing) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    const child = createElement(tag);
    const attrs = match[3] || "";
    for (const attr of attrs.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
      const name = attr[1].toLowerCase();
      const value = attr[2] ?? attr[3] ?? attr[4] ?? "";
      if (name === "class") child.className = value;
      else if (name === "id") child.id = value;
      else child.setAttribute(name, value);
    }
    child.parentElement = stack.at(-1);
    stack.at(-1).children.push(child);
    const voidTag = tag === "img" || tag === "br" || tag === "input" || /\/\s*$/.test(attrs);
    if (!voidTag) stack.push(child);
  }
}

function findById(element, id) {
  if (element.id === id) return element;
  for (const child of element.children || []) {
    const found = findById(child, id);
    if (found) return found;
  }
  return null;
}

function countTag(element, tagName) {
  let count = element.tagName === tagName ? 1 : 0;
  for (const child of element.children || []) count += countTag(child, tagName);
  return count;
}

function createDocument() {
  const document = createElement("#document");
  const workspace = createElement("section");
  workspace.className = "workspace";
  const controls = createElement("div");
  controls.className = "controls";
  document.append(workspace, controls);
  document.readyState = "complete";
  document.createElement = (tag) => createElement(tag);
  document.getElementById = (id) => findById(document, id);
  return document;
}

function maliciousGraph() {
  return {
    nodes: [
      { id: "group:g", label: PAYLOAD, type: "group" },
      { id: "repository:r", label: PAYLOAD, type: "repository", language: PAYLOAD, groupId: "g", stars: 1, archived: false, fork: false },
      { id: "repository:ext", label: PAYLOAD, type: "repository", language: PAYLOAD, relation: "contributed", stars: 0 },
    ],
  };
}

function runNavigator(source, sandbox) {
  vm.runInNewContext(source, sandbox, { filename: "category-navigator.js" });
}

test("category navigator label and language render as text, not HTML", async () => {
  const [categorySource, threeSource] = await Promise.all([
    readFile(new URL("../scripts/public-category-navigator.js", import.meta.url), "utf8"),
    readFile(new URL("../scripts/public-threejs-category-navigator.js", import.meta.url), "utf8"),
  ]);
  const graph = maliciousGraph();

  const categoryDocument = createDocument();
  const categoryWindow = { innerWidth: 1200, addEventListener() {} };
  runNavigator(categorySource, {
    document: categoryDocument,
    window: categoryWindow,
    state: { graph, byId: new Map(), nodes: [], selected: null, query: "" },
    updateDetails() {},
    canvas: { focus() {} },
    searchInput: null,
  });
  const categoryList = categoryDocument.getElementById("categoryNavigatorList");
  assert.ok(categoryList);
  assert.equal(countTag(categoryList, "IMG"), 0);
  assert.equal(categoryList.textContent.includes(PAYLOAD), true);
  assert.ok(queryAll(categoryList, "span").some((span) => span.textContent === PAYLOAD));
  assert.ok(queryAll(categoryList, "small").some((small) => small.textContent === PAYLOAD));

  const threeDocument = createDocument();
  const threeWindow = {
    innerWidth: 1200,
    addEventListener() {},
    ProjectMapThreejsNavigatorAdapter: {
      graph: () => graph,
      node: (id) => graph.nodes.find((node) => node.id === id) || null,
      selectedId: () => "",
      isVisible: () => true,
      clearSelection() {},
      selectNode() {},
    },
  };
  runNavigator(threeSource, { document: threeDocument, window: threeWindow });
  const threeList = threeDocument.getElementById("categoryNavigatorList");
  assert.ok(threeList);
  assert.equal(countTag(threeList, "IMG"), 0);
  assert.equal(threeList.textContent.includes(PAYLOAD), true);
  assert.ok(queryAll(threeList, "span").some((span) => span.textContent === PAYLOAD));
  assert.ok(queryAll(threeList, "small").some((small) => small.textContent === PAYLOAD));
  assert.equal(threeList.textContent.includes("External contributions"), true);
});
