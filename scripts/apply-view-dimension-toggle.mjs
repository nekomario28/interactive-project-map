import { copyFile, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const SCRIPT_TAG = '<script src="../view-dimension-toggle.js" defer></script>';
const STYLE_TAG = '<link rel="stylesheet" href="../view-dimension-toggle.css" />';
const TWO_D_DIRS = ["u", "radial", "tree", "treemap", "timeline", "cluster", "sunburst", "matrix", "sankey"];

const TWO_D_TOGGLE = '<span class="control-cluster view-mode-cluster" role="group" aria-label="Rendering dimension"><span class="control-cluster-label">View</span><span class="view-mode-option is-active" aria-current="page">2D</span><a id="view3D" class="view-mode-option is-experimental" href="../three/" title="Open the experimental Three.js view">3D <small>Lab</small></a></span>';
const THREE_D_TOGGLE = '<span class="control-cluster view-mode-cluster" role="group" aria-label="Rendering dimension"><span class="control-cluster-label">View</span><a id="twoDLink" class="view-mode-option" href="../u/">2D</a><span class="view-mode-option is-active is-experimental" aria-current="page">3D <small>Lab</small></span></span><label class="field view-style-field"><span>Style</span><select id="threeStyle" aria-label="3D style"><option value="cosmic">Cosmic</option></select></label>';

function attachAssets(html) {
  let next = html;
  if (!next.includes(STYLE_TAG)) next = next.replace("</head>", `${STYLE_TAG}\n</head>`);
  if (!next.includes(SCRIPT_TAG)) next = next.replace("</body>", `${SCRIPT_TAG}\n</body>`);
  return next;
}

export function patchTwoDViewDimension(html) {
  let next = html;
  if (!next.includes('data-view-dimension="2d"')) {
    if (!next.includes('<body data-map-style="')) throw new Error("Could not locate 2D body map-style attribute");
    next = next.replace('<body data-map-style="', '<body data-view-dimension="2d" data-map-style="');
  }
  if (!next.includes('id="view3D"')) {
    const styleField = '<label class="field"><span>Style</span><select id="style">';
    if (!next.includes(styleField)) throw new Error("Could not locate 2D Style control");
    next = next.replace(styleField, `${TWO_D_TOGGLE}${styleField}`);
  }
  return attachAssets(next);
}

export function patchThreeDViewDimension(html) {
  let next = html;
  if (!next.includes('data-view-dimension="3d"')) {
    if (!next.includes('<body data-map-style="threejs-cosmic">')) throw new Error("Could not locate Three.js body map-style attribute");
    next = next.replace('<body data-map-style="threejs-cosmic">', '<body data-view-dimension="3d" data-map-style="threejs-cosmic">');
  }
  if (!next.includes('class="control-cluster view-mode-cluster"')) {
    const oldLink = '<a id="twoDLink" class="three-link-button" href="../u/">2D Map</a>';
    if (!next.includes(oldLink)) throw new Error("Could not locate Three.js 2D fallback link");
    next = next.replace(oldLink, THREE_D_TOGGLE);
  }
  return attachAssets(next);
}

export async function applyViewDimensionToggle({
  siteDir = join(process.cwd(), "site"),
  sourceDir = join(process.cwd(), "scripts"),
} = {}) {
  const changed = [];
  for (const dir of TWO_D_DIRS) {
    const path = join(siteDir, dir, "index.html");
    const html = await readFile(path, "utf8");
    const next = patchTwoDViewDimension(html);
    if (next !== html) {
      await writeFile(path, next);
      changed.push(path);
    }
  }

  const threePath = join(siteDir, "three", "index.html");
  const threeHtml = await readFile(threePath, "utf8");
  const nextThree = patchThreeDViewDimension(threeHtml);
  if (nextThree !== threeHtml) {
    await writeFile(threePath, nextThree);
    changed.push(threePath);
  }

  const runtimePath = join(siteDir, "view-dimension-toggle.js");
  const stylePath = join(siteDir, "view-dimension-toggle.css");
  await Promise.all([
    copyFile(join(sourceDir, "public-view-dimension-toggle.js"), runtimePath),
    copyFile(join(sourceDir, "public-view-dimension-toggle.css"), stylePath),
  ]);
  return { changed, runtimePath, stylePath };
}

async function main() {
  const result = await applyViewDimensionToggle();
  console.log(`Applied 2D/3D View controls to ${result.changed.length} viewer pages`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
