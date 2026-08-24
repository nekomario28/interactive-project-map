import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildAssessmentRoute,
  normalizeImpactCounter,
  resolveArtifactModule,
  validateRepositoryAssessmentFixtures,
  validateRepositoryAssessmentPolicy,
} from "../scripts/repository-assessment-policy.mjs";
import {
  inferL0RepositoryRelation,
  relationAttributionProfile,
} from "../scripts/repository-relation.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));

const policy = readJson("data/repository-assessment-policy.v1.json");
const taxonomy = readJson("data/standard-taxonomy.v1.json");
const fixtures = readJson("fixtures/repository-assessment-cases.v1.json");

test("repository assessment policy validates against Standard Taxonomy v1", () => {
  assert.equal(validateRepositoryAssessmentPolicy(policy, taxonomy), true);
});

test("repository assessment fixtures validate against the policy contract", () => {
  assert.equal(validateRepositoryAssessmentFixtures(fixtures, policy, taxonomy), true);
});

test("repository relation is orthogonal and L0 does not assume solo authorship", () => {
  assert.deepEqual(policy.repositoryRelationAxes.ownership, ["owned", "contributed"]);
  assert.ok(policy.repositoryRelationAxes.collaboration.includes("unknown"));
  assert.ok(policy.repositoryRelationAxes.lineage.includes("fork"));
  assert.equal(policy.repositoryRelationContract.axesAreOrthogonal, true);
  assert.equal(policy.repositoryRelationContract.forkIsLineageNotOwnership, true);
  assert.equal(policy.relationStates, undefined);

  const owned = inferL0RepositoryRelation({ external: false, fork: false });
  assert.deepEqual(owned, { ownership: "owned", collaboration: "unknown", lineage: "original" });
  assert.equal(relationAttributionProfile(owned), "unresolved");

  const contributed = inferL0RepositoryRelation({ external: true, fork: false });
  assert.equal(relationAttributionProfile(contributed), "contributed");
});

test("every Standard Taxonomy artifact facet resolves to an assessment module", () => {
  for (const artifact of taxonomy.facets.artifact.values) {
    const resolved = resolveArtifactModule(policy, artifact);
    assert.ok(resolved.emphasize.length > 0, `${artifact} should resolve emphasized dimensions`);
  }
});

test("artifact inheritance composes rather than replacing parent evidence", () => {
  const application = resolveArtifactModule(policy, "application");
  const service = resolveArtifactModule(policy, "service");
  const framework = resolveArtifactModule(policy, "framework");
  const library = resolveArtifactModule(policy, "library");

  assert.deepEqual(service, application);
  assert.deepEqual(framework, library);
});

test("mixed research + dataset + model assessment composes all modules", () => {
  const route = buildAssessmentRoute(policy, ["research", "dataset", "model"]);
  assert.deepEqual(route.artifacts, ["research", "dataset", "model"]);
  assert.ok(route.evidenceTopics.includes("method"));
  assert.ok(route.evidenceTopics.includes("schema-metadata"));
  assert.ok(route.evidenceTopics.includes("model-card"));
  assert.ok(route.claimBoundaries.some((boundary) => boundary.includes("intrinsic data validity")));
  assert.ok(route.claimBoundaries.some((boundary) => boundary.includes("model capability")));
});

test("stars and forks use monotonic nonlinear normalization without direct Quality effect", () => {
  for (const signalName of ["stars", "forks"]) {
    const signal = policy.impactSignals[signalName];
    assert.equal(signal.axis, "impact");
    assert.equal(signal.directQualityEffect, false);
    assert.equal(signal.defaultTransformFamily, "log1p");
  }

  assert.equal(normalizeImpactCounter(0), 0);
  assert.ok(normalizeImpactCounter(10) > normalizeImpactCounter(1));
  assert.ok(normalizeImpactCounter(100) > normalizeImpactCounter(10));
  assert.ok(normalizeImpactCounter(1000) > normalizeImpactCounter(100));
  assert.ok(normalizeImpactCounter(1000) < 10 * normalizeImpactCounter(100));
});

test("v1 deliberately leaves scoring weights and tier thresholds unfrozen", () => {
  assert.equal(policy.ranking.weights, null);
  assert.equal(policy.ranking.tierThresholds, null);
  assert.equal(policy.ranking.qualityAndProminenceAreDistinct, true);
  assert.equal(policy.ranking.globalPercentilesWithoutCorpus, false);
});

test("contract fixtures preserve the critical ranking and authorship counterexamples", () => {
  const byId = new Map(fixtures.cases.map((entry) => [entry.id, entry]));

  assert.equal(byId.get("frozen-dataset-without-ci").context.lifecycle, "frozen");
  assert.equal(byId.get("high-quality-zero-star-solo").evidence.stars, 0);
  assert.equal(byId.get("popular-solo-lower-quality").evidence.stars, 5000);
  assert.equal(byId.get("famous-project-tiny-contribution").context.relation.ownership, "contributed");
  assert.equal(byId.get("large-project-core-maintainer").evidence.maintainedCoreComponent, true);
  assert.equal(byId.get("fork-with-small-local-delta").context.relation.lineage, "fork");
  assert.equal(byId.get("owned-collaboration-unresolved").context.relation.collaboration, "unknown");
});
