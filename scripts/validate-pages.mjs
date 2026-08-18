import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import vm from "node:vm";
import stylelint from "stylelint";

const root = process.cwd();
const siteDir = join(root, "site");
const validatorDir = join(root, ".tmp", "validator");

const cssRules = {
  "at-rule-no-unknown": true,
  "block-no-empty": true,
  "color-no-invalid-hex": true,
  "declaration-block-no-duplicate-properties": true,
  "declaration-property-value-no-unknown": true,
  "function-calc-no-unspaced-operator": true,
  "function-linear-gradient-no-nonstandard-direction": true,
  "media-feature-name-no-unknown": true,
  "no-duplicate-selectors": true,
  "property-no-unknown": true,
  "selector-pseudo-class-no-unknown": true,
  "selector-pseudo-element-no-unknown": true,
  "selector-type-no-unknown": true,
  "string-no-newline": true,
  "unit-no-unknown": true
};

async function lintCss(code, label) {
  const result = await stylelint.lint({
    code,
    config: { rules: cssRules },
    formatter: "string"
  });
  if (result.errored) throw new Error(`${label} failed Stylelint:\n${result.report}`);
}

async function validateEmbeddedCss(filePath) {
  const html = await readFile(filePath, "utf8");
  const blocks = [...html.matchAll(/<style>([\s\S]*?)<\/style>/gi)];
  if (!blocks.length) throw new Error(`${filePath}: expected at least one <style> block`);
  for (let index = 0; index < blocks.length; index += 1) {
    await lintCss(blocks[index][1], `${filePath} <style> #${index + 1}`);
  }
}

async function validateExternalCss(filePath) {
  await lintCss(await readFile(filePath, "utf8"), filePath);
}

async function validateDynamicMarkup() {
  const home = await readFile(join(siteDir, "index.html"), "utf8");
  const viewer = await readFile(join(siteDir, "u", "index.html"), "utf8");
  const radialViewer = await readFile(join(siteDir, "radial", "index.html"), "utf8");
  const treeViewer = await readFile(join(siteDir, "tree", "index.html"), "utf8");

  if (!/<input id="username" type="text"(?:\s|>)/.test(home)) {
    throw new Error("Generator username input must declare type=text");
  }
  if (!/<select id="mapStyle">[\s\S]*?value="radial"[\s\S]*?value="galaxy"[\s\S]*?value="obsidian"[\s\S]*?value="tree"/.test(home)) {
    throw new Error("Generator must expose Radial, Galaxy, Obsidian-like and Tree style presets");
  }
  for (const style of ["radial", "galaxy", "obsidian", "tree"]) {
    if (!new RegExp(`data-style-preset="${style}"`).test(home)) throw new Error(`Generator preset gallery is missing ${style}`);
  }
  if (!/<link rel="stylesheet" href="\.\/presets\.css">/.test(home)) {
    throw new Error("Generator must load the preset gallery stylesheet");
  }
  if (!/<a id="openMap" class="button" href="\.\/radial\/" target="_blank" rel="noopener">/.test(home)) {
    throw new Error("Generator interactive-map anchor must have the classic radial safe default href and rel=noopener");
  }

  const sourceLessImages = [...home.matchAll(/<img\b[^>]*>/gi)].filter((match) => !/\bsrc\s*=/.test(match[0]));
  if (sourceLessImages.length !== 1 || !/\bid="preview"/.test(sourceLessImages[0][0]) || !/\balt=/.test(sourceLessImages[0][0])) {
    throw new Error("Only the JS-populated preview image may omit src, and it must retain alt text");
  }

  for (const [name, html] of [["viewer", viewer], ["radial viewer", radialViewer], ["tree viewer", treeViewer]]) {
    if (!/<select id="style">[\s\S]*?value="radial"[\s\S]*?value="galaxy"[\s\S]*?value="obsidian"[\s\S]*?value="tree"/.test(html)) {
      throw new Error(`${name} must expose all four style presets`);
    }
    for (const className of ["original", "fork", "archived"]) {
      if (!new RegExp(`class="${className}"`).test(html)) throw new Error(`${name} legend is missing ${className}`);
    }
    if (!/<link rel="stylesheet" href="\.\.\/viewer\.css">/.test(html)) {
      throw new Error(`${name} must load the external validated stylesheet`);
    }
    if (/script-src[^;]*'unsafe-inline'/.test(html)) {
      throw new Error(`${name} CSP must not allow unsafe-inline scripts`);
    }
    if (/style-src[^;]*'unsafe-inline'/.test(html)) {
      throw new Error(`${name} CSP must not require inline styles`);
    }
  }
  if (!/tree-router\.js/.test(viewer) || !/viewer\.js/.test(viewer)) {
    throw new Error("Galaxy/Obsidian viewer must route dedicated Tree and Radial selections before starting the graph viewer");
  }
  if (!/radial-viewer\.js/.test(radialViewer)) {
    throw new Error("Radial viewer must load its classic browser renderer");
  }
  if (!/tree-nav\.js/.test(treeViewer) || !/tree-viewer\.js/.test(treeViewer)) {
    throw new Error("Tree viewer must load hierarchical rendering plus dedicated-view navigation");
  }
  if (/script-src[^;]*'unsafe-inline'/.test(home)) {
    throw new Error("generator CSP must not allow unsafe-inline scripts");
  }
}

function mockElement(id) {
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
    select() {},
    setAttribute() {}
  };
}

async function generateWorkflowFixture() {
  const appJs = await readFile(join(siteDir, "app.js"), "utf8");
  const elements = new Map();
  const context = {
    document: {
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, mockElement(id));
        return elements.get(id);
      },
      querySelectorAll() {
        return [];
      },
      execCommand() {
        return true;
      }
    },
    navigator: { clipboard: { async writeText() {} } },
    location: { href: "https://nekomario28.github.io/interactive-project-map/" },
    history: { replaceState() {} },
    URL,
    Set,
    setTimeout() {},
    console
  };

  vm.createContext(context);
  new vm.Script(appJs, { filename: "site/app.js" }).runInContext(context);
  const workflow = vm.runInContext(
    "workflowFor({username:'nekomario28',theme:'dark',style:'radial',maxRepos:100,forks:true,archived:false})",
    context
  );

  if (typeof workflow !== "string" || !workflow.includes("jobs:") || !workflow.includes("uses: nekomario28/interactive-project-map@")) {
    throw new Error("Generated installer workflow is incomplete");
  }
  if (!workflow.includes("style: radial")) {
    throw new Error("Generated installer workflow must preserve the classic Radial map style");
  }
  if (workflow.includes("__PROJECT_MAP_ACTION_REF__")) {
    throw new Error("Generated installer workflow still contains the Action ref placeholder");
  }

  await mkdir(validatorDir, { recursive: true });
  await writeFile(join(validatorDir, "generated-project-map.yml"), `${workflow}\n`);
}

await validateDynamicMarkup();
await validateEmbeddedCss(join(siteDir, "index.html"));
await validateExternalCss(join(siteDir, "viewer.css"));
await validateExternalCss(join(siteDir, "presets.css"));
await generateWorkflowFixture();
console.log("Generated Pages markup, CSS, all four style presets and browser installer runtime validated.");
