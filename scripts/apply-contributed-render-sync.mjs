import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SHARED_VIEWER = "viewer.js";
const GALAXY_RENDERERS = Object.freeze([
  ["galaxy-classic-runtime.js", "classic"],
  ["galaxy-systems-runtime.js", "systems"],
]);

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Could not locate ${label}`);
  return source.replace(from, to);
}

export function patchSharedContributedRendering(source) {
  let next = source;
  next = replaceRequired(
    next,
    "  if (node.archived) opacity *= 0.72;",
    "  if (node?.type === \"repository\" && node?.relation === \"contributed\") opacity *= 0.96;\n  else if (node.archived) opacity *= 0.72;",
    "shared Contributed opacity precedence",
  );
  next = replaceRequired(
    next,
    '    if (node.type === "repository" && node.archived) {',
    '    if (node.type === "repository" && node.archived && node.relation !== "contributed") {',
    "shared Contributed archive-ring precedence",
  );
  return next;
}

export function patchGalaxyContributedRendering(source, mode) {
  if (!GALAXY_RENDERERS.some(([, candidate]) => candidate === mode)) throw new Error(`Unsupported Galaxy renderer: ${mode}`);
  let next = source;
  next = replaceRequired(
    next,
    "      let opacity = node.archived ? 0.72 : 1;",
    "      const contributedPrimary = node.type === \"repository\" && node.relation === \"contributed\";\n      let opacity = contributedPrimary ? 0.96 : node.archived ? 0.72 : 1;",
    `${mode} Contributed opacity precedence`,
  );

  if (mode === "classic") {
    next = replaceRequired(
      next,
      '      const colorsByStatus = node.type === "owner" ? colors.owner : node.type === "group" ? colors.group : node.archived ? colors.archived : node.fork ? colors.fork : colors.original;\n      ctx.fillStyle = colorsByStatus;',
      '      const colorsByStatus = node.type === "owner" ? colors.owner : node.type === "group" ? colors.group : contributedPrimary ? colors.contributed : node.archived ? colors.archived : node.fork ? colors.fork : colors.original;\n      ctx.fillStyle = colorsByStatus;',
      "Classic Contributed fill precedence",
    );
  } else {
    next = replaceRequired(
      next,
      '      ctx.fillStyle = node.type === "owner" ? colors.owner : node.type === "group" ? colors.group : node.archived ? colors.archived : node.fork ? colors.fork : colors.original;',
      '      ctx.fillStyle = node.type === "owner" ? colors.owner : node.type === "group" ? colors.group : contributedPrimary ? colors.contributed : node.archived ? colors.archived : node.fork ? colors.fork : colors.original;',
      "Systems Contributed fill precedence",
    );
  }

  next = replaceRequired(
    next,
    '      if (node.type === "repository" && node.archived) {',
    '      if (node.type === "repository" && node.archived && !contributedPrimary) {',
    `${mode} Contributed archive-ring precedence`,
  );
  return next;
}

export async function applyContributedRenderSync(outputDir = resolve(process.cwd(), "site")) {
  const sharedPath = join(outputDir, SHARED_VIEWER);
  const shared = await readFile(sharedPath, "utf8");
  const nextShared = patchSharedContributedRendering(shared);
  if (nextShared !== shared) await writeFile(sharedPath, nextShared);

  for (const [filename, mode] of GALAXY_RENDERERS) {
    const path = join(outputDir, filename);
    const source = await readFile(path, "utf8");
    const next = patchGalaxyContributedRendering(source, mode);
    if (next !== source) await writeFile(path, next);
  }
}

async function main() {
  const outputDir = resolve(process.argv[2] || join(process.cwd(), "site"));
  await applyContributedRenderSync(outputDir);
  console.log("Aligned shared, Galaxy Classic, and Galaxy Systems Contributed rendering with static SVG semantics");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
