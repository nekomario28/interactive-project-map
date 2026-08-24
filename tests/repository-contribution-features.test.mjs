import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildPersonalContributionEvidence } from "../scripts/repository-contribution-features.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const assessmentFixtures = JSON.parse(fs.readFileSync(path.join(root, "fixtures/repository-assessment-cases.v1.json"), "utf8"));
const byId = new Map(assessmentFixtures.cases.map((entry) => [entry.id, entry]));

test("project-wide reputation and scale evidence is rejected by the person-side extractor", () => {
  assert.throws(
    () => buildPersonalContributionEvidence({ relation: "contributed", projectStars: 100000 }),
    /projectStars is project-side evidence/,
  );
  assert.throws(
    () => buildPersonalContributionEvidence({ relation: "contributed", projectContributors: 1000 }),
    /projectContributors is project-side evidence/,
  );
});

test("one merged PR alone remains activity evidence rather than a contribution score", () => {
  const fixture = byId.get("famous-project-tiny-contribution");
  const evidence = buildPersonalContributionEvidence({
    relation: fixture.context.relation,
    mergedPullRequests: fixture.evidence.mergedPullRequestsByPerson,
    maintainerRole: fixture.evidence.maintainer,
    releaseInvolvement: fixture.evidence.releaseRole,
    scopeEvidence: fixture.evidence.contributionDescription,
  });

  assert.equal(evidence.activity.mergedPullRequests.raw, 1);
  assert.deepEqual(evidence.signals.activity, ["merged-prs"]);
  assert.deepEqual(evidence.signals.responsibility, []);
  assert.equal(evidence.scopeEvidence.value, "typo-only");
  assert.equal(evidence.compositePersonalContribution, null);
  assert.equal(evidence.attribution.requiresPersonalContributionGate, true);
});

test("maintainer, release, core-component, review, and duration evidence remain distinct", () => {
  const fixture = byId.get("large-project-core-maintainer");
  const evidence = buildPersonalContributionEvidence({
    relation: fixture.context.relation,
    mergedPullRequests: fixture.evidence.mergedPullRequestsByPerson,
    reviews: fixture.evidence.reviews,
    maintainedCoreComponent: fixture.evidence.maintainedCoreComponent,
    releaseInvolvement: fixture.evidence.releaseRole,
    activeDurationMonths: fixture.evidence.sustainedDurationMonths,
    maintainerRole: true,
  });

  assert.equal(evidence.activity.mergedPullRequests.raw, 42);
  assert.equal(evidence.activity.reviews.raw, 180);
  assert.equal(evidence.activity.activeDurationMonths.raw, 24);
  assert.deepEqual(evidence.signals.responsibility.sort(), ["maintained-core-component", "maintainer-role", "release-involvement"]);
  assert.ok(evidence.signals.activity.includes("reviews"));
  assert.ok(evidence.signals.activity.includes("sustained-duration"));
  assert.equal(evidence.compositePersonalContribution, null);
});

test("missing responsibility evidence stays unknown rather than false", () => {
  const evidence = buildPersonalContributionEvidence({ relation: "owned-team", mergedPullRequests: 3 });
  assert.equal(evidence.responsibility.maintainerRole.state, "unknown");
  assert.equal(evidence.responsibility.releaseInvolvement.state, "unknown");
  assert.equal(evidence.responsibility.maintainedCoreComponent.state, "unknown");
});

test("owned team and contributed relations require person-side attribution gates", () => {
  const team = buildPersonalContributionEvidence({ relation: "owned-team" });
  const contributed = buildPersonalContributionEvidence({ relation: "contributed" });
  assert.equal(team.attribution.mode, "team-contribution-gated");
  assert.equal(team.attribution.requiresPersonalContributionGate, true);
  assert.equal(contributed.attribution.mode, "external-project-contribution-gated");
  assert.equal(contributed.attribution.requiresPersonalContributionGate, true);
});

test("fork personal attribution requires local-delta evidence but absence remains unknown", () => {
  const unknown = buildPersonalContributionEvidence({ relation: "owned-fork" });
  assert.equal(unknown.attribution.mode, "fork-local-delta");
  assert.equal(unknown.attribution.requiresLocalDeltaEvidence, true);
  assert.equal(unknown.attribution.localDeltaState, "unknown");

  const observed = buildPersonalContributionEvidence({ relation: "owned-fork", localDeltaEvidence: "adds a local device integration patch" });
  assert.equal(observed.localDelta.state, "observed");
  assert.equal(observed.attribution.localDeltaState, "observed");
});

test("owned-solo relation allows direct attribution only after relation classification", () => {
  const evidence = buildPersonalContributionEvidence({ relation: "owned-solo" });
  assert.equal(evidence.attribution.mode, "direct-solo-context");
  assert.equal(evidence.attribution.requiresPersonalContributionGate, false);
  assert.equal(evidence.compositePersonalContribution, null);
});
