# Repository assessment artifact v1

Status: **experimental static artifact contract / not consumed by production renderers yet**

The assessment system has separate evidence vectors for Quality, Impact, Scale, lifecycle/Maturity/Activity context, and Personal Contribution, plus calibration-only Portfolio Prominence candidates. This document defines how those outputs are packaged without mutating `graph.json` or making a renderer the authority.

Default future generated path:

```text
project-map/assessment.json
```

Machine-readable contract: [`../data/repository-assessment-artifact-contract.v1.json`](../data/repository-assessment-artifact-contract.v1.json).

Builder/validator: [`../scripts/repository-assessment-artifact.mjs`](../scripts/repository-assessment-artifact.mjs).

L0 graph adapter: [`../scripts/repository-assessment-from-graph.mjs`](../scripts/repository-assessment-from-graph.mjs).

Relation contract: [`repository-relation-axes-v1.md`](repository-relation-axes-v1.md).

## Why a separate artifact first

Assessment changes at a different rate and has different acquisition costs from semantic graph generation. Keeping it separate initially means:

- current graph/taxonomy semantics remain unchanged;
- current static and interactive renderers need no schema change;
- L0/L1/L2 acquisition can be incomplete without corrupting graph data;
- `unknown`, `not-collected`, and provenance remain visible even when no score exists;
- calibration policy can evolve independently;
- stable reusable `v1` need not move for assessment-only experiments.

## Root identity

The artifact records:

```text
schemaVersion
contractId
owner
generatedAt
generatorRevision
taxonomyId
assessmentPolicyId
productionScoring
prominenceCandidateId
repositories[]
```

`generatorRevision` identifies the generator code. Repository observations have their own `observedAt`; deeper evidence keeps its own source/revision/time identity.

While the scoring policy remains experimental:

```text
productionScoring = false
productionScore = null
```

for every repository.

## Repository identity and graph join

Canonical assessment identity is:

```text
lowercase(owner/repository)
```

The current graph projection is joined without changing the graph schema:

```text
owned repository
  repository:<name>

contributed repository
  repository:<lowercase owner/name>
```

Each assessment entry therefore stores both `repositoryKey` and the current `graphNodeId`. `githubRepositoryId` is optional until acquisition exposes it consistently.

## Context is evidence-bearing too

Repository context is:

```text
category
artifacts
lifecycle
relation
```

Category is represented as:

```json
{ "state": "observed", "id": "developer-tools" }
```

or, when the current graph does not establish it:

```json
{ "state": "unknown", "id": null }
```

Artifact facets are represented as:

```json
{ "state": "observed", "values": ["tool"] }
```

or:

```json
{ "state": "unknown", "values": [] }
```

`partial` is allowed for artifact facets when a bounded acquisition step proves some artifact forms but not completeness.

Do not invent `application`, dataset/model status, or another fallback solely to make an assessment route available. Quality routing waits until artifact evidence exists.

## Orthogonal repository relation

Assessment relation uses three axes:

```text
ownership:     owned | contributed
collaboration: solo | team | unknown
lineage:       original | fork | unknown
```

The production graph's `relation: contributed` remains unchanged and is merely one source for `ownership = contributed` in the sidecar.

At L0 the graph can establish owned/contributed and the fork flag, but normally cannot prove solo/team. Therefore L0 defaults collaboration to `unknown` rather than `solo`.

This prevents an owned repository from receiving direct personal credit merely because it is owned by the profile account.

## Acquisition state

Each entry records:

```text
level = L0 | L1 | L2
observedAt
```

Budget:

```text
L0
  bounded existing graph/provider metadata

L1
  repository structure and fit-for-purpose validation evidence

L2
  deep evidence only where it changes an assessment decision
```

The sidecar remains viable for large portfolios because deep scanning is not the default.

## L0 graph adapter

`buildL0RepositoryAssessmentFromGraph()` consumes the existing generated graph and copies only facts already represented there.

For each repository it derives:

```text
ownership
  node.relation === contributed ? contributed : owned

lineage
  node.fork === true ? fork : original

collaboration
  unknown

category
  taxonomyAssignment.categoryId
  else classification.categoryId
  else unknown

artifacts
  validated artifact:* secondary tags
  else unknown

lifecycle
  archived only when node.archived === true
  otherwise unknown
```

It deliberately does **not** infer active lifecycle from recent timestamps, solo authorship from ownership, or application artifact type from missing facet evidence.

The adapter also returns diagnostics for observed/unknown category and artifact coverage, owned/contributed/fork counts, archived state, and unresolved collaboration.

## Section wrappers

Assessment sections use:

```json
{
  "state": "not-collected",
  "value": null
}
```

Allowed states:

```text
observed
partial
not-collected
not-applicable
unknown
```

Sections are:

```text
quality
impact
scale
lifecycle
personalContribution
prominence
```

The wrapper describes section availability; nested evidence vectors retain their more detailed evidence state, authority, provenance, and applicability semantics.

## Personal attribution boundary

Only a fully resolved:

```text
owned × solo × original
```

relation makes Personal Contribution `not-applicable`, because project merit can be treated as direct personal project merit for this calibration layer.

For team, fork, contributed, or unresolved owned work, Personal Contribution remains `not-collected` until evidence is acquired.

Project prominence may eventually be available independently. Personal portfolio prominence must remain null when:

- Personal Contribution is required but not observed; or
- owned collaboration/lineage is still unresolved.

This preserves the distinction between a strong project and demonstrated personal credit.

## What structural validity proves

A valid `assessment.json` proves that the projection follows the packaging contract. It does not prove:

- intrinsic repository Quality;
- benchmark correctness;
- model capability or dataset validity;
- a production prominence formula;
- final tiers;
- renderer correctness;
- complete deep assessment coverage.

## Next gate

Before production SVG/viewers consume assessment data:

1. validate the L0 graph adapter against current graph semantics;
2. fill Quality/Impact/Scale/lifecycle/Contribution only through their owning extractors;
3. resolve collaboration only from direct evidence rather than ownership assumptions;
4. calibrate a bounded real-repository sample;
5. measure coverage/confidence and attribution failures;
6. decide whether `balanced-v1` remains the leading prominence candidate;
7. only then choose tiers and rendered visual channels;
8. require exact-head tests and rendered browser evidence before production integration.

Until those gates pass, `assessment.json` remains a sidecar experiment and stable reusable `v1` stays unchanged.
