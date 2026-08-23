import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { applyContributedViewer } from "./apply-contributed-viewer.mjs";
import { applyUiContractFixes } from "./apply-ui-contract-fixes.mjs";

const VIEWER_DIRS = ["u", "radial", "tree", "treemap", "timeline", "cluster", "sunburst", "matrix", "sankey"];
const SCRIPT_TAG = '<script src="../category-navigator.js" defer></script>';
const STYLE_TAG = '<link rel="stylesheet" href="../category-navigator.css">';
const CONTRIBUTED_EMPHASIS_SCRIPT = '<script src="../contributed-emphasis.js" defer></script>';
const CONTRIBUTED_EMPHASIS_STYLE = '<link rel="stylesheet" href="../contributed-emphasis.css">';
const CONTRIBUTED_BUILD_TARGETS = ["view-state.js", "interaction-polish.js", "viewer.css", join("u", "index.html")];

function attachNavigator(html, mode) {
  let next = html;
  if (!next.includes(STYLE_TAG)) {
    if (!next.includes("</head>")) throw new Error(`Missing </head> in ${mode} viewer`);
    next = next.replace("</head>", `${STYLE_TAG}\n</head>`);
  }
  if (!next.includes(CONTRIBUTED_EMPHASIS_STYLE)) {
    if (!next.includes("</head>")) throw new Error(`Missing </head> for Contributed emphasis in ${mode} viewer`);
    next = next.replace("</head>", `${CONTRIBUTED_EMPHASIS_STYLE}\n</head>`);
  }
  if (!next.includes(CONTRIBUTED_EMPHASIS_SCRIPT)) {
    if (!next.includes("</body>")) throw new Error(`Missing </body> for Contributed emphasis in ${mode} viewer`);
    next = next.replace("</body>", `${CONTRIBUTED_EMPHASIS_SCRIPT}\n</body>`);
  }
  if (!next.includes(SCRIPT_TAG)) {
    if (!next.includes("</body>")) throw new Error(`Missing </body> in ${mode} viewer`);
    next = next.replace("</body>", `${SCRIPT_TAG}\n</body>`);
  }
  return next;
}

async function hasCompletePagesBuild(outputDir) {
  try {
    await Promise.all(CONTRIBUTED_BUILD_TARGETS.map((target) => access(join(outputDir, target))));
    return true;
  } catch {
    return false;
  }
}

export async function applyCategoryNavigator(outputDir = resolve(process.cwd(), "site")) {
  const sourceDir = resolve(process.cwd(), "scripts");
  await mkdir(outputDir, { recursive: true });
  const completePagesBuild = await hasCompletePagesBuild(outputDir);
  if (completePagesBuild) await applyContributedViewer(outputDir);
  await copyFile(join(sourceDir, "public-category-navigator.js"), join(outputDir, "category-navigator.js"));
  await copyFile(join(sourceDir, "public-category-navigator.css"), join(outputDir, "category-navigator.css"));
  await copyFile(join(sourceDir, "public-contributed-emphasis.js"), join(outputDir, "contributed-emphasis.js"));
  await copyFile(join(sourceDir, "public-contributed-emphasis.css"), join(outputDir, "contributed-emphasis.css"));

  for (const mode of VIEWER_DIRS) {
    const htmlPath = join(outputDir, mode, "index.html");
    const html = await readFile(htmlPath, "utf8");
    const next = attachNavigator(html, mode);
    if (!next.includes("category-navigator.js") || !next.includes("category-navigator.css")) {
      throw new Error(`Could not attach category navigator to ${mode} viewer`);
    }
    if (!next.includes("contributed-emphasis.js") || !next.includes("contributed-emphasis.css")) {
      throw new Error(`Could not attach Contributed emphasis to ${mode} viewer`);
    }
    if (next !== html) await writeFile(htmlPath, next);
  }

  if (completePagesBuild) await applyUiContractFixes(outputDir);
}

async function main() {
  const outputDir = resolve(process.argv[2] || join(process.cwd(), "site"));
  await applyCategoryNavigator(outputDir);
  console.log(`Attached category navigator and Contributed emphasis to ${VIEWER_DIRS.length} interactive viewers`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
