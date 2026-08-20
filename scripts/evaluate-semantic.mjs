import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { evaluateSemanticGraph, evaluateSemanticThresholds } from "./semantic-evaluation.mjs";

const MAX_GRAPH_BYTES = 2_000_000;
const MAX_EXPECTED_BYTES = 512 * 1024;
const MAX_DIAGNOSTICS_BYTES = 512 * 1024;

function usage() {
  return [
    "Usage: node scripts/evaluate-semantic.mjs --graph <graph.json> --expected <expected.json> [options]",
    "",
    "Options:",
    "  --previous <graph.json>                 compare taxonomy/assignment churn",
    "  --diagnostics <diagnostics.json>        include provider/cache/call metrics",
    "  --output <report.json>                  write report in addition to stdout",
    "  --min-assigned-accuracy <0..1>",
    "  --min-end-to-end-accuracy <0..1>",
    "  --min-coverage <0..1>",
    "  --max-ambiguity-rate <0..1>",
    "  --max-missing-rate <0..1>",
    "  --max-taxonomy-churn-rate <0..1>",
    "  --max-assignment-churn-rate <0..1>",
    "  --max-largest-category-share <0..1>",
    "  --max-adjudicator-calls <n>",
  ].join("\n");
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--help" || token === "-h") return { help: true };
    if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const value = argv[index + 1];
    if (value == null || value.startsWith("--")) throw new Error(`Missing value for --${key}`);
    args[key] = value;
    index += 1;
  }
  return args;
}

async function readJson(path, maxBytes, label) {
  const absolute = resolve(path);
  const text = await readFile(absolute, "utf8");
  if (Buffer.byteLength(text, "utf8") > maxBytes) throw new Error(`${label} exceeds ${maxBytes} bytes`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} must contain valid JSON`);
  }
}

function probability(value, name) {
  if (value == null) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) throw new Error(`${name} must be between 0 and 1`);
  return parsed;
}

function nonNegativeInt(value, name) {
  if (value == null) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 10_000) throw new Error(`${name} must be an integer between 0 and 10000`);
  return parsed;
}

export async function evaluateSemanticCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(usage());
    return { exitCode: 0 };
  }
  if (!args.graph || !args.expected) throw new Error(`--graph and --expected are required\n\n${usage()}`);

  const graph = await readJson(args.graph, MAX_GRAPH_BYTES, "graph.json");
  const expected = await readJson(args.expected, MAX_EXPECTED_BYTES, "expected fixture");
  const previousGraph = args.previous ? await readJson(args.previous, MAX_GRAPH_BYTES, "previous graph") : undefined;
  const runDiagnostics = args.diagnostics ? await readJson(args.diagnostics, MAX_DIAGNOSTICS_BYTES, "diagnostics") : undefined;

  const report = evaluateSemanticGraph(graph, expected, { previousGraph, runDiagnostics });
  const gate = evaluateSemanticThresholds(report, {
    minAssignedAccuracy: probability(args["min-assigned-accuracy"], "--min-assigned-accuracy"),
    minEndToEndAccuracy: probability(args["min-end-to-end-accuracy"], "--min-end-to-end-accuracy"),
    minCoverage: probability(args["min-coverage"], "--min-coverage"),
    maxAmbiguityRate: probability(args["max-ambiguity-rate"], "--max-ambiguity-rate"),
    maxMissingRate: probability(args["max-missing-rate"], "--max-missing-rate"),
    maxTaxonomyChurnRate: probability(args["max-taxonomy-churn-rate"], "--max-taxonomy-churn-rate"),
    maxAssignmentChurnRate: probability(args["max-assignment-churn-rate"], "--max-assignment-churn-rate"),
    maxLargestCategoryShare: probability(args["max-largest-category-share"], "--max-largest-category-share"),
    maxAdjudicatorCalls: nonNegativeInt(args["max-adjudicator-calls"], "--max-adjudicator-calls"),
  });
  const output = { ...report, gate };
  const text = JSON.stringify(output, null, 2) + "\n";
  if (args.output) await writeFile(resolve(args.output), text);
  process.stdout.write(text);
  if (!gate.passed) {
    for (const failure of gate.failures) console.error(`semantic evaluation gate: ${failure}`);
    return { exitCode: 2, report: output };
  }
  return { exitCode: 0, report: output };
}

async function main() {
  try {
    const result = await evaluateSemanticCli();
    process.exitCode = result.exitCode;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
