import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const NODE_TARGETS = Object.freeze(["radial-viewer.js", "tree-viewer.js"]);
const REPOSITORY_TARGETS = Object.freeze({
  "treemap-viewer.js": {
    opacity: "    const opacity = matches(repo) ? (repo.archived ? 0.64 : repo.fork ? 0.78 : 0.90) : 0.10;",
    contributedOpacity: "    const opacity = matches(repo) ? (repo.relation === \"contributed\" ? 0.96 : repo.archived ? 0.64 : repo.fork ? 0.78 : 0.90) : 0.10;",
  },
  "timeline-viewer.js": {
    opacity: "    const opacity = matches(repo) ? (repo.archived ? 0.72 : repo.fork ? 0.82 : 0.96) : 0.10;",
    contributedOpacity: "    const opacity = matches(repo) ? (repo.relation === \"contributed\" ? 0.96 : repo.archived ? 0.72 : repo.fork ? 0.82 : 0.96) : 0.10;",
  },
  "cluster-viewer.js": {
    opacity: "    const opacity = matches(repo) ? (repo.archived ? 0.70 : repo.fork ? 0.82 : 0.96) : 0.10;",
    contributedOpacity: "    const opacity = matches(repo) ? (repo.relation === \"contributed\" ? 0.96 : repo.archived ? 0.70 : repo.fork ? 0.82 : 0.96) : 0.10;",
  },
  "sunburst-viewer.js": {
    opacity: "    const opacity = matches(repo) ? (repo.archived ? 0.70 : repo.fork ? 0.82 : 0.94) : 0.08;",
    contributedOpacity: "    const opacity = matches(repo) ? (repo.relation === \"contributed\" ? 0.96 : repo.archived ? 0.70 : repo.fork ? 0.82 : 0.94) : 0.08;",
  },
});

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Could not locate ${label}`);
  return source.replace(from, to);
}

export function patchDedicatedPrimaryStatusRendering(source, label = "dedicated viewer") {
  let next = source;
  next = replaceRequired(
    next,
    "    let opacity = node.archived ? 0.72 : 1;",
    "    let opacity = node.type === \"repository\" && node.relation === \"contributed\" ? 0.96 : node.archived ? 0.72 : 1;",
    `${label} Contributed opacity precedence`,
  );
  next = replaceRequired(
    next,
    '    if (node.type === "repository" && node.archived) {',
    '    if (node.type === "repository" && node.archived && node.relation !== "contributed") {',
    `${label} Contributed archive-ring precedence`,
  );
  return next;
}

export function patchDedicatedRepositoryPrimaryStatusRendering(source, config, label = "dedicated viewer") {
  let next = source;
  next = replaceRequired(
    next,
    config.opacity,
    config.contributedOpacity,
    `${label} Contributed opacity precedence`,
  );
  next = replaceRequired(
    next,
    "    if (repo.archived) {",
    '    if (repo.archived && repo.relation !== "contributed") {',
    `${label} Contributed archive-decoration precedence`,
  );
  return next;
}

export async function applyDedicatedContributedRenderSync(outputDir = resolve(process.cwd(), "site")) {
  for (const filename of NODE_TARGETS) {
    const path = join(outputDir, filename);
    const source = await readFile(path, "utf8");
    const next = patchDedicatedPrimaryStatusRendering(source, filename);
    if (next !== source) await writeFile(path, next);
  }
  for (const [filename, config] of Object.entries(REPOSITORY_TARGETS)) {
    const path = join(outputDir, filename);
    const source = await readFile(path, "utf8");
    const next = patchDedicatedRepositoryPrimaryStatusRendering(source, config, filename);
    if (next !== source) await writeFile(path, next);
  }
}

async function main() {
  const outputDir = resolve(process.argv[2] || join(process.cwd(), "site"));
  await applyDedicatedContributedRenderSync(outputDir);
  console.log("Aligned node-based dedicated Contributed primary-status rendering with static SVG semantics");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
