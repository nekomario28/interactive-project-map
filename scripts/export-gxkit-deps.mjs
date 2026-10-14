/** Export IPM's *source-code* imports to the depsgx ModuleGraph contract.
 *
 * This is intentionally not the user-facing repository/ownership graph.
 * Parsing uses the TypeScript compiler already required by the IPM build;
 * gxkit remains a separate, optional inspection gate.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

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
  const kind = /\.[cm]?tsx?$/.test(filename) ? ts.ScriptKind.TS : ts.ScriptKind.JS;
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, kind);
  if (file.parseDiagnostics.length) {
    const error = file.parseDiagnostics[0];
    throw new Error(`Cannot parse ${filename}: ${ts.flattenDiagnosticMessageText(error.messageText, " ")}`);
  }
  const imports = new Set();
  const capture = (node) => {
    if (node && ts.isStringLiteralLike(node) && node.text.startsWith(".")) imports.add(node.text);
  };
  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) capture(node.moduleSpecifier);
    if (ts.isCallExpression(node) && node.arguments.length === 1) {
      const callee = node.expression;
      if (callee.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(callee) && callee.text === "require")) capture(node.arguments[0]);
    }
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) capture(node.argument.literal);
    ts.forEachChild(node, visit);
  };
  visit(file);
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
