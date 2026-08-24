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
const CONTRIBUTED = { ownership: "contributed", collaboration: "unknown", lineage: "original" };
const TEAM_ORIGINAL = { ownership: "owned", collaboration: "team", lineage: "original" };
const OWNED_FORK = { ownership: "owned", collaboration: "unknown", lineage: "fork" };
const SOLO_ORIGINAL = { ownership: "owned", collaboration: "solo", lineage: "original" };
const OWNED_UNKNOWN = { ownership: "owned", collaboration: "unknown", lineage: "original" };

test("project-wide reputation and scale evidence is rejected by the person-side extractor", () => {
  assert.throws(
    () => buildPersonalContributionEvidence({ relation: CONTRIBUTED, projectStars: 100000 }),
    /projectStars is project-side evidence/,
  );
  assert.throws(
    () => buildPersonalContributionEvidence({ relation: CONTRIBUTED, projectContributors: 1000 }),
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
  assert.equal(evidence.attribution.profile, "contributed");
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
  const evidence = buildPersonalContributionEvidence({ relation: TEAM_ORIGINAL, mergedPullRequests: 3 });
  assert.equal(evidence.responsibility.maintainerRole.state, "unknown");
  assert.equal(evidence.responsibility.releaseInvolvement.state, "unknown");
  assert.equal(evidence.responsibility.maintainedCoreComponent.state, "unknown");
});

test("owned team and contributed ownership require person-side attribution gates", () => {
  const team = buildPersonalContributionEvidence({ relation: TEAM_ORIGINAL });
  const contributed = buildPersonalContributionEvidence({ relation: CONTRIBUTED });
  assert.equal(team.attribution.mode, "team-contribution-gated");
  assert.equal(team.attribution.profile, "team");
  assert.equal(team.attribution.requiresPersonalContributionGate, true);
  assert.equal(contributed.attribution.mode, "external-project-contribution-gated");
  assert.equal(contributed.attribution.profile, "contributed");
  assert.equal(contributed.attribution.requiresPersonalContributionGate, true);
});

test("fork lineage requires local-delta evidence but absence remains unknown", () => {
  const unknown = buildPersonalContributionEvidence({ relation: OWNED_FORK });
  assert.equal(unknown.attribution.mode, "fork-local-delta");
  assert.equal(unknown.attribution.requiresLocalDeltaEvidence, true);
  assert.equal(unknown.attribution.localDeltaState, "unknown");

  const observed = buildPersonalContributionEvidence({ relation: OWNED_FORK, localDeltaEvidence: "adds a local device integration patch" });
  assert.equal(observed.localDelta.state, "observed");
  assert.equal(observed.attribution.localDeltaState, "observed");
});

test("owned solo original allows direct attribution only after all relation axes are resolved", () => {
  const evidence = buildPersonalContributionEvidence({ relation: SOLO_ORIGINAL });
  assert.equal(evidence.attribution.mode, "direct-solo-original-context");
  assert.equal(evidence.attribution.profile, "direct");
  assert.equal(evidence.attribution.requiresPersonalContributionGate, false);
  assert.equal(evidence.compositePersonalContribution, null);
});

test("owned unknown collaboration never silently becomes solo", () => {
  const evidence = buildPersonalContributionEvidence({ relation: OWNED_UNKNOWN });
  assert.equal(evidence.attribution.profile, "unresolved");
  assert.equal(evidence.attribution.mode, "unresolved-attribution");
  assert.equal(evidence.attribution.requiresPersonalContributionGate, true);
  assert.equal(evidence.attribution.directPersonalMeritPermitted, false);
});
