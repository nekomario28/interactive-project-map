/** Export IPM's *source-code* imports to the depsgx ModuleGraph contract.
 *
 * This is intentionally not the user-facing repository/ownership graph.
 * Parsing reuses espree and Node's built-in TypeScript type stripping;
 * gxkit remains a separate, optional inspection gate.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { stripTypeScriptTypes } from "node:module";
import * as espree from "espree";

const ROOTS = ["src", "packages", "scripts"];
const EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];
const JS_EXT = new Set(EXTENSIONS);

const posix = (path) => path.split(sep).join("/");

function walk(root, folder, output) {
  if (!existsSync(folder)) return;
  for (const entry of readdirSync(folder, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, "en"))) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".tmp") continue;
    const path = join(folder, entry.name);
    if (entry.isDirectory()) walk(root, path, output);
    else if (entry.isFile() && JS_EXT.has(extname(path))) output.add(posix(relative(root, path)));
  }
}

function importsOf(source, filename) {
  // TypeScript 7's native compiler intentionally no longer exposes createSourceFile.
  // Node strips TS-only syntax; espree (already present for ESLint) parses the
  // resulting JavaScript. Preserve declared type-only import/export edges first.
  const isTypeScript = /\\.[cm]?tsx?$/.test(filename);
  const prepared = isTypeScript
    ? stripTypeScriptTypes(
        source.replace(/(^|[\\r\\n])(\\s*)(import|export)\\s+type(?=\\s*(?:\\{|\\*|[\\w$]+\\s+from\\s*["']))/g, "$1$2$3"),
        { mode: "strip" },
      )
    : source;
  let ast;
  try {
    ast = espree.parse(prepared, { ecmaVersion: "latest", sourceType: filename.endsWith(".cjs") ? "script" : "module" });
  } catch (error) {
    throw new Error(`Cannot parse ${filename}: ${error.message}`, { cause: error });
  }
  const imports = new Set();
  const capture = (node) => {
    if (node?.type === "Literal" && typeof node.value === "string" && node.value.startsWith(".")) imports.add(node.value);
  };
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (["ImportDeclaration", "ExportNamedDeclaration", "ExportAllDeclaration"].includes(node.type)) capture(node.source);
    if (node.type === "ImportExpression") capture(node.source);
    if (node.type === "CallExpression" && node.callee?.type === "Identifier" && node.callee.name === "require" && node.arguments.length === 1) capture(node.arguments[0]);
    for (const [key, child] of Object.entries(node)) {
      if (key !== "loc" && key !== "range" && key !== "start" && key !== "end" && key !== "parent") visit(child);
    }
  };
  visit(ast);
  return [...imports].sort();
}

function resolveImport(root, importer, specifier, included) {
  const target = resolve(root, dirname(importer), specifier);
  const candidates = [target];
  if (JS_EXT.has(extname(target))) {
    const bare = target.slice(0, -extname(target).length);
    for (const ext of EXTENSIONS) candidates.push(bare + ext);
  } else if (!extname(target)) {
    for (const ext of EXTENSIONS) candidates.push(target + ext);
  }
  for (const ext of EXTENSIONS) candidates.push(join(target, `index${ext}`));
  for (const candidate of candidates) {
    const name = posix(relative(root, candidate));
    if (included.has(name)) return { module: name };
  }
  // Existing assets and imports outside the inspected source directories are not modules.
  if (existsSync(target) || candidates.some((candidate) => existsSync(candidate))) return null;
  return { missing: posix(relative(root, target)) };
}

export function collectSourceDependencies(root = process.cwd(), folders = ROOTS) {
  root = resolve(root);
  const included = new Set();
  for (const folder of folders) walk(root, join(root, folder), included);
  const modules = [...included].sort();
  const depends = [];
  const missing = [];
  for (const importer of modules) {
    for (const specifier of importsOf(readFileSync(join(root, importer), "utf8"), importer)) {
      const match = resolveImport(root, importer, specifier, included);
      if (!match) continue;
      if (match.missing) {
        const name = `unresolved:${match.missing}`;
        depends.push([importer, name]);
        missing.push({ importer, specifier, target: match.missing });
      } else {
        depends.push([importer, match.module]);
      }
    }
  }
  depends.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
  return { modules, depends, roots: [], layers: [], missing };
}

export function pythonArtifact(model) {
  // JSON arrays and JSON-escaped strings are valid Python literals for this string-only model.
  // No repository code is executed by the generated module.
  return [
    '"""Generated, inert dependency data for gxkit depsgx. Do not edit."""',
    "from depsgx import ModuleGraph",
    "",
    "graph = ModuleGraph(",
    `    modules=${JSON.stringify(model.modules, null, 2)},`,
    `    depends=${JSON.stringify(model.depends, null, 2)},`,
    '    name="Interactive Project Map source imports",',
    ")",
    "",
  ].join("\n");
}

const mainFile = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (mainFile) {
  const args = process.argv.slice(2);
  const rootAt = args.indexOf("--root");
  const pythonAt = args.indexOf("--python");
  const root = rootAt >= 0 ? args[rootAt + 1] : process.cwd();
  if ((rootAt >= 0 && !root) || (pythonAt >= 0 && !args[pythonAt + 1])) {
    console.error("usage: node scripts/export-gxkit-deps.mjs [--root DIR] [--python OUT.py]");
    process.exitCode = 2;
  } else {
    const model = collectSourceDependencies(root);
    if (pythonAt >= 0) {
      const output = isAbsolute(args[pythonAt + 1]) ? args[pythonAt + 1] : resolve(root, args[pythonAt + 1]);
      mkdirSync(dirname(output), { recursive: true });
      writeFileSync(output, pythonArtifact(model));
      console.log(`gxkit dependency model: ${model.modules.length} modules, ${model.depends.length} imports, ${model.missing.length} unresolved -> ${output}`);
    } else {
      console.log(JSON.stringify(model, null, 2));
    }
  }
}
