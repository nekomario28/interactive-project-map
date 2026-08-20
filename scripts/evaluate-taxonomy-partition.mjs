import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { evaluateTaxonomyPartition, evaluateTaxonomyPartitionThresholds } from "./taxonomy-partition-evaluation.mjs";

const MAX_GRAPH_BYTES = 2_000_000;
const MAX_EXPECTED_BYTES = 512 * 1024;

function usage() {
  return [
    "Usage: node scripts/evaluate-taxonomy-partition.mjs --graph <graph.json> --expected <expected.json> [options]",
    "",
    "Category IDs may differ between expected and discovered taxonomy; metrics compare the partition structure.",
    "",
    "Options:",
    "  --output <report.json>",
    "  --min-coverage <0..1>",
    "  --max-ambiguity-rate <0..1>",
    "  --min-pairwise-f1 <0..1>",
    "  --min-adjusted-rand-index <-1..1>",
    "  --min-purity <0..1>",
    "  --max-actual-clusters <n>",
  ].join("\n");
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--help" || token === "-h") return { help: true };
    if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
    const value = argv[index + 1];
    if (value == null || value.startsWith("--")) throw new Error(`Missing value for ${token}`);
    args[token.slice(2)] = value;
    index += 1;
  }
  return args;
}

async function readJson(path, maxBytes, label) {
  const text = await readFile(resolve(path), "utf8");
  if (Buffer.byteLength(text, "utf8") > maxBytes) throw new Error(`${label} exceeds ${maxBytes} bytes`);
  try { return JSON.parse(text); } catch { throw new Error(`${label} must contain valid JSON`); }
}

function boundedNumber(value, name, minimum, maximum) {
  if (value == null) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) throw new Error(`${name} must be between ${minimum} and ${maximum}`);
  return parsed;
}

function boundedInt(value, name, minimum, maximum) {
  if (value == null) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  return parsed;
}

export async function evaluateTaxonomyPartitionCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(usage());
    return { exitCode: 0 };
  }
  if (!args.graph || !args.expected) throw new Error(`--graph and --expected are required\n\n${usage()}`);
  const graph = await readJson(args.graph, MAX_GRAPH_BYTES, "graph.json");
  const expected = await readJson(args.expected, MAX_EXPECTED_BYTES, "expected fixture");
  const report = evaluateTaxonomyPartition(graph, expected);
  const gate = evaluateTaxonomyPartitionThresholds(report, {
    minCoverage: boundedNumber(args["min-coverage"], "--min-coverage", 0, 1),
    maxAmbiguityRate: boundedNumber(args["max-ambiguity-rate"], "--max-ambiguity-rate", 0, 1),
    minPairwiseF1: boundedNumber(args["min-pairwise-f1"], "--min-pairwise-f1", 0, 1),
    minAdjustedRandIndex: boundedNumber(args["min-adjusted-rand-index"], "--min-adjusted-rand-index", -1, 1),
    minPurity: boundedNumber(args["min-purity"], "--min-purity", 0, 1),
    maxActualClusters: boundedInt(args["max-actual-clusters"], "--max-actual-clusters", 1, 400),
  });
  const output = { ...report, gate };
  const text = JSON.stringify(output, null, 2) + "\n";
  if (args.output) await writeFile(resolve(args.output), text);
  process.stdout.write(text);
  if (!gate.passed) {
    for (const item of gate.failures) console.error(`taxonomy partition gate: ${item}`);
    return { exitCode: 2, report: output };
  }
  return { exitCode: 0, report: output };
}

async function main() {
  try {
    const result = await evaluateTaxonomyPartitionCli();
    process.exitCode = result.exitCode;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
