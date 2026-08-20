import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateStaticMap } from "../scripts/action.mjs";
import {
  DEFAULT_TAXONOMY_MAX_DRIFT_RATIO,
  DISABLED_TAXONOMY_DISCOVERY_PROVIDER as SCRIPT_DISABLED,
  MAX_TAXONOMY_CATEGORIES,
  TAXONOMY_SCHEMA_VERSION,
  buildTaxonomyDiscoveryInput as buildScriptInput,
  parseTaxonomyOverrideFile,
  resolvePortfolioTaxonomy as resolveScriptTaxonomy,
  validateTaxonomyCategories as validateScriptCategories,
} from "../scripts/taxonomy.mjs";
import {
  DISABLED_TAXONOMY_DISCOVERY_PROVIDER as SOURCE_DISABLED,
  buildTaxonomyDiscoveryInput as buildSourceInput,
  resolvePortfolioTaxonomy as resolveSourceTaxonomy,
  validateTaxonomyCategories as validateSourceCategories,
} from "../src/taxonomy.ts";
import { buildGraph } from "../src/graph.ts";
import { sanitizeStaticGraph } from "../src/static-graph.ts";

function repo(id, name, overrides = {}) {
  return {
    id,
    name,
    html_url: `https://github.com/example/${name}`,
    description: `${name} project`,
    language: "TypeScript",
    topics: [],
    stargazers_count: 0,
    forks_count: 0,
    fork: false,
    archived: false,
    updated_at: "2026-08-20T00:00:00Z",
    readmeExcerpt: `${name} README`,
    frameworks: [],
    manifests: [],
    ...overrides,
  };
}

const discoveredCategories = [
  {
    id: "robotics",
    label: "Robotics",
    description: "Robot simulation, control, navigation, manipulation, and sim-to-real projects",
    aliases: ["ROS2", "Gazebo"],
  },
  {
    id: "web-apps",
    label: "Web / Apps",
    description: "Web applications, frontends, APIs, and interactive product experiences",
    aliases: ["React", "Web"],
  },
];

function discoveryProvider(id = "fake-taxonomy", model = "fixture-v1") {
  const state = { calls: 0, inputs: [] };
  return {
    id,
    model,
    state,
    async discover(input) {
      state.calls += 1;
      state.inputs.push(structuredClone(input));
      return { categories: discoveredCategories };
    },
  };
}

function config() {
  return {
    username: "example",
    theme: "dark",
    style: "galaxy-systems",
    maxRepos: 100,
    includeForks: true,
    includeArchived: true,
    width: 740,
    height: 420,
    outputDir: "project-map",
  };
}

test("taxonomy corpus fingerprint is deterministic, order-independent, and source/static implementations match", async () => {
  const repos = [
    repo(2, "web-app", { topics: ["web", "react"], description: "  Web app  \n React " }),
    repo(1, "robot", { topics: ["robotics", "ros2"], description: "ROS2 robot" }),
  ];
  const script = await buildScriptInput(repos);
  const source = await buildSourceInput(repos);
  assert.deepEqual(source, script);
  assert.equal(script.input.schemaVersion, TAXONOMY_SCHEMA_VERSION);
  assert.match(script.input.corpusFingerprint, /^[0-9a-f]{64}$/);
  assert.deepEqual(script.repositories.map((item) => item.repoId), [1, 2]);

  const reordered = await buildScriptInput([repos[1], repos[0]]);
  assert.equal(reordered.input.corpusFingerprint, script.input.corpusFingerprint);

  const cosmetic = await buildScriptInput([
    repo(1, "robot", { topics: ["ros2", "robotics"], description: "ROS2 robot" }),
    repo(2, "web-app", { topics: ["react", "web"], description: "Web app React" }),
  ]);
  assert.equal(cosmetic.input.corpusFingerprint, script.input.corpusFingerprint);

  const changed = await buildScriptInput([
    repos[1],
    repo(2, "web-app", { topics: ["web", "react"], description: "Web app React", readmeExcerpt: "Now includes offline collaboration" }),
  ]);
  assert.notEqual(changed.input.corpusFingerprint, script.input.corpusFingerprint);
});

test("taxonomy schema has stable ids, bounded categories, validated parents, and deterministic aliases", () => {
  const input = [
    { id: "ROBOTICS", label: " Robotics ", description: " Robot work ", aliases: ["ROS2", "ros2", "Gazebo"] },
    { id: "robot-sim", label: "Simulation", description: "Simulation projects", parentId: "ROBOTICS", aliases: [] },
  ];
  const script = validateScriptCategories(input);
  const source = validateSourceCategories(input);
  assert.deepEqual(source, script);
  assert.deepEqual(script, [
    { id: "robot-sim", label: "Simulation", description: "Simulation projects", aliases: [], parentId: "robotics" },
    { id: "robotics", label: "Robotics", description: "Robot work", aliases: ["Gazebo", "ROS2"] },
  ]);

  assert.throws(() => validateScriptCategories([
    ...discoveredCategories,
    { ...discoveredCategories[0], label: "Duplicate" },
  ]), /Duplicate taxonomy category id/);
  assert.throws(() => validateScriptCategories([
    { id: "child", label: "Child", description: "Child", parentId: "missing" },
  ]), /Unknown parent taxonomy category/);
  assert.throws(() => validateScriptCategories([
    { id: "a", label: "A", description: "A", parentId: "b" },
    { id: "b", label: "B", description: "B", parentId: "a" },
  ]), /parent cycle/);
  assert.throws(() => validateScriptCategories(Array.from({ length: MAX_TAXONOMY_CATEGORIES + 1 }, (_, index) => ({
    id: `category-${index}`,
    label: `Category ${index}`,
    description: `Category ${index}`,
  }))), /must contain/);
});

test("taxonomy override file is strict, bounded, and provides authoritative categories", () => {
  const parsed = parseTaxonomyOverrideFile(JSON.stringify({
    version: 1,
    forceRediscovery: false,
    categories: discoveredCategories,
  }));
  assert.equal(parsed.version, 1);
  assert.equal(parsed.forceRediscovery, undefined);
  assert.deepEqual(parsed.categories, validateScriptCategories(discoveredCategories));
  assert.throws(() => parseTaxonomyOverrideFile("{"), /valid JSON/);
  assert.throws(() => parseTaxonomyOverrideFile(JSON.stringify({ version: 2, categories: discoveredCategories })), /version must be 1/);
});

test("initial discovery freezes taxonomy and exact unchanged corpus avoids another provider call", async () => {
  const repos = [repo(1, "robot"), repo(2, "web")];
  const scriptProvider = discoveryProvider();
  const sourceProvider = discoveryProvider();
  const firstScript = await resolveScriptTaxonomy(repos, scriptProvider);
  const firstSource = await resolveSourceTaxonomy(repos, sourceProvider);
  assert.deepEqual(firstSource.taxonomy, firstScript.taxonomy);
  assert.equal(firstScript.diagnostics.reason, "initial-discovery");
  assert.equal(scriptProvider.state.calls, 1);
  assert.equal(firstScript.taxonomy?.source.providerId, "fake-taxonomy");

  const second = await resolveScriptTaxonomy(repos, scriptProvider, { previousTaxonomy: firstScript.taxonomy });
  assert.equal(second.diagnostics.reason, "unchanged");
  assert.equal(second.diagnostics.reused, true);
  assert.equal(second.diagnostics.exactCorpusMatch, true);
  assert.equal(scriptProvider.state.calls, 1, "unchanged corpus must not trigger discovery again");
  assert.deepEqual(second.taxonomy, firstScript.taxonomy);
});

test("small corpus drift reuses discovery baseline while cumulative drift beyond threshold rediscovers", async () => {
  const baselineRepos = Array.from({ length: 10 }, (_, index) => repo(index + 1, `repo-${index}`));
  const provider = discoveryProvider();
  const first = await resolveScriptTaxonomy(baselineRepos, provider);
  assert.equal(provider.state.calls, 1);
  const baselineFingerprint = first.taxonomy?.corpusFingerprint;

  const oneChanged = baselineRepos.map((item, index) => index === 0 ? { ...item, description: "meaningfully changed one" } : item);
  const small = await resolveScriptTaxonomy(oneChanged, provider, { previousTaxonomy: first.taxonomy });
  assert.equal(DEFAULT_TAXONOMY_MAX_DRIFT_RATIO, 0.15);
  assert.equal(small.diagnostics.changedRepositories, 1);
  assert.equal(small.diagnostics.driftRatio, 0.1);
  assert.equal(small.diagnostics.reason, "small-drift");
  assert.equal(small.diagnostics.stale, true);
  assert.equal(provider.state.calls, 1);
  assert.equal(small.taxonomy?.corpusFingerprint, baselineFingerprint, "small drift must not move the frozen baseline");

  const twoChanged = baselineRepos.map((item, index) => index < 2 ? { ...item, description: `meaningfully changed ${index}` } : item);
  const large = await resolveScriptTaxonomy(twoChanged, provider, { previousTaxonomy: small.taxonomy });
  assert.equal(large.diagnostics.changedRepositories, 2);
  assert.equal(large.diagnostics.driftRatio, 0.2);
  assert.equal(large.diagnostics.reason, "drift-discovery");
  assert.equal(large.diagnostics.discovered, true);
  assert.equal(provider.state.calls, 2);
  assert.notEqual(large.taxonomy?.corpusFingerprint, baselineFingerprint);
});

test("force rediscovery bypasses exact-corpus freeze", async () => {
  const repos = [repo(1, "one"), repo(2, "two")];
  const provider = discoveryProvider();
  const first = await resolveScriptTaxonomy(repos, provider);
  const forced = await resolveScriptTaxonomy(repos, provider, {
    previousTaxonomy: first.taxonomy,
    forceRediscovery: true,
  });
  assert.equal(provider.state.calls, 2);
  assert.equal(forced.diagnostics.reason, "forced-discovery");
  assert.equal(forced.diagnostics.discovered, true);
});

test("disabled/failing discovery never destroys an existing frozen taxonomy", async () => {
  const repos = [repo(1, "one"), repo(2, "two")];
  const provider = discoveryProvider();
  const first = await resolveScriptTaxonomy(repos, provider);

  const disabledWithoutPrevious = await resolveScriptTaxonomy(repos, SCRIPT_DISABLED);
  const sourceDisabled = await resolveSourceTaxonomy(repos, SOURCE_DISABLED);
  assert.equal(disabledWithoutPrevious.taxonomy, undefined);
  assert.equal(disabledWithoutPrevious.diagnostics.reason, "provider-disabled");
  assert.equal(sourceDisabled.diagnostics.reason, "provider-disabled");

  const changed = repos.map((item) => ({ ...item, description: `changed ${item.name}` }));
  const disabledWithPrevious = await resolveScriptTaxonomy(changed, SCRIPT_DISABLED, {
    previousTaxonomy: first.taxonomy,
    forceRediscovery: true,
  });
  assert.equal(disabledWithPrevious.diagnostics.reason, "provider-disabled-reused");
  assert.equal(disabledWithPrevious.diagnostics.stale, true);
  assert.deepEqual(disabledWithPrevious.taxonomy, first.taxonomy);

  const failed = await resolveScriptTaxonomy(changed, {
    id: "failing",
    model: "fixture",
    async discover() { throw new Error("taxonomy service unavailable"); },
  }, {
    previousTaxonomy: first.taxonomy,
    forceRediscovery: true,
  });
  assert.equal(failed.diagnostics.reason, "provider-error-reused");
  assert.match(failed.error ?? "", /service unavailable/);
  assert.deepEqual(failed.taxonomy, first.taxonomy);
});

test("authoritative category override skips provider and refreshes taxonomy baseline", async () => {
  const repos = [repo(1, "robot"), repo(2, "web")];
  const provider = discoveryProvider();
  const custom = [
    { id: "projects", label: "Projects", description: "All selected portfolio projects", aliases: ["Portfolio"] },
  ];
  const result = await resolveScriptTaxonomy(repos, provider, {
    overrides: { version: 1, categories: custom },
  });
  assert.equal(provider.state.calls, 0);
  assert.equal(result.diagnostics.reason, "override");
  assert.equal(result.diagnostics.overridden, true);
  assert.equal(result.taxonomy?.source.providerId, "override");
  assert.deepEqual(result.taxonomy?.categories, validateScriptCategories(custom));
  assert.match(result.taxonomy?.corpusFingerprint ?? "", /^[0-9a-f]{64}$/);
});

test("Action persists taxonomy.json, reuses it on unchanged runs, and honors taxonomy-overrides.json without provider calls", async () => {
  const dir = await mkdtemp(join(tmpdir(), "project-map-p3a-"));
  const repos = [
    repo(1, "robot", { description: "ROS2 robot", topics: ["robotics"] }),
    repo(2, "web", { description: "React web app", topics: ["web"] }),
  ];
  const provider = discoveryProvider();
  try {
    const first = await generateStaticMap(config(), {
      cwd: dir,
      fetchRepos: async () => repos,
      taxonomyProvider: provider,
    });
    assert.equal(provider.state.calls, 1);
    assert.equal(first.taxonomy.diagnostics.reason, "initial-discovery");
    assert.ok(first.graph.taxonomy);
    assert.equal(first.taxonomyPath, "project-map/taxonomy.json");
    const taxonomyPath = join(dir, "project-map", "taxonomy.json");
    const persisted = JSON.parse(await readFile(taxonomyPath, "utf8"));
    assert.deepEqual(persisted, first.graph.taxonomy);

    const second = await generateStaticMap(config(), {
      cwd: dir,
      fetchRepos: async () => repos,
      taxonomyProvider: provider,
    });
    assert.equal(provider.state.calls, 1, "second unchanged Action run must use taxonomy.json freeze state");
    assert.equal(second.taxonomy.diagnostics.reason, "unchanged");
    assert.deepEqual(second.graph.taxonomy, first.graph.taxonomy);

    const overrideText = JSON.stringify({
      version: 1,
      categories: [{ id: "custom", label: "Custom Portfolio", description: "Human-edited portfolio taxonomy", aliases: ["Manual"] }],
    }, null, 2) + "\n";
    const overridePath = join(dir, "project-map", "taxonomy-overrides.json");
    await writeFile(overridePath, overrideText);
    const third = await generateStaticMap(config(), {
      cwd: dir,
      fetchRepos: async () => repos,
      taxonomyProvider: provider,
    });
    assert.equal(provider.state.calls, 1, "authoritative override must not call discovery provider");
    assert.equal(third.taxonomy.diagnostics.reason, "override");
    assert.equal(third.graph.taxonomy?.categories[0].id, "custom");
    assert.equal(await readFile(overridePath, "utf8"), overrideText, "Action must never rewrite human override file");
    const graph = JSON.parse(await readFile(join(dir, "project-map", "graph.json"), "utf8"));
    assert.deepEqual(graph.taxonomy, third.graph.taxonomy);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("invalid human taxonomy override fails loudly instead of silently changing classification", async () => {
  const dir = await mkdtemp(join(tmpdir(), "project-map-p3a-invalid-"));
  try {
    await writeFile(join(dir, "taxonomy-overrides.json"), "{}\n");
    await assert.rejects(
      generateStaticMap({ ...config(), outputDir: "." }, {
        cwd: dir,
        fetchRepos: async () => [repo(1, "one")],
      }),
      /output_dir must|Taxonomy override version|version must be 1/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("static graph sanitizer preserves structurally valid taxonomy and discards malformed taxonomy without rejecting the graph", async () => {
  const repos = [
    { ...repo(1, "alpha"), html_url: "https://github.com/octocat/alpha" },
    { ...repo(2, "beta"), html_url: "https://github.com/octocat/beta" },
  ];
  const provider = discoveryProvider();
  const resolved = await resolveScriptTaxonomy(repos, provider);
  const input = buildGraph("octocat", repos, true, true);
  input.taxonomy = resolved.taxonomy;
  const valid = sanitizeStaticGraph(input, "octocat");
  assert.ok(valid);
  assert.deepEqual(valid.taxonomy, resolved.taxonomy);

  input.taxonomy = {
    ...resolved.taxonomy,
    categories: [{ id: "broken", label: "Broken", description: "Broken", aliases: [], parentId: "missing" }],
  };
  const malformed = sanitizeStaticGraph(input, "octocat");
  assert.ok(malformed);
  assert.equal(malformed.taxonomy, undefined);
});
