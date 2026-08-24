# Repository assessment artifact v1

Status: **experimental static artifact contract / not consumed by production renderers yet**

The assessment system now has separate evidence vectors for Quality, Impact, Scale, lifecycle/Maturity/Activity context, and Personal Contribution, plus calibration-only Portfolio Prominence candidates. This document defines how those outputs can be packaged without mutating `graph.json` or making a renderer the authority.

Default future generated path:

```text
project-map/assessment.json
```

Machine-readable contract: [`../data/repository-assessment-artifact-contract.v1.json`](../data/repository-assessment-artifact-contract.v1.json).

Validator/builder: [`../scripts/repository-assessment-artifact.mjs`](../scripts/repository-assessment-artifact.mjs).

## Why a separate artifact first

Assessment changes at a different rate and has different acquisition costs from semantic graph generation. Keeping it separate initially provides several advantages:

- current graph/taxonomy semantics remain frozen;
- current static and interactive renderers do not need schema changes just to experiment with assessment;
- L0/L1/L2 acquisition can be incomplete without corrupting graph data;
- evidence provenance and `UNKNOWN` / `not-collected` states remain available even when no score exists;
- scoring/calibration policy can evolve without making old `graph.json` data ambiguous;
- the stable reusable `v1` release need not move for assessment-only research/contract changes.

Production integration can later choose whether to keep the sidecar artifact or project a stable subset into `graph.json` after evidence justifies that coupling.

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

`generatorRevision` is the exact generator-code revision. It is not used as a substitute for repository evidence revision. Repository observations retain their own `observedAt`, and deeper evidence records retain their own source/provenance identities.

While weights/tiers remain experimental:

```text
productionScoring = false
productionScore = null
```

for every repository.

## Repository identity and graph join

The canonical assessment key is:

```text
lowercase(owner/repository)
```

Example:

```text
Alice/ToolKit -> alice/toolkit
```

The current graph projection uses different repository node IDs for owned and Contributed work:

```text
owned
  repository:ToolKit

contributed
  repository:upstreamorg/projectx
```

Therefore each assessment entry records both:

```text
repositoryKey   canonical cross-artifact identity
graphNodeId     current graph projection join id
```

`githubRepositoryId` is optional. It can become the stronger provider-stable identity when acquisition exposes it consistently, but v1 does not change `graph.json` merely to add that field.

Repository renames can therefore be handled by regenerating the sidecar from current provider evidence; a future provider-ID migration can be versioned independently.

## Context

Each repository retains the context needed to interpret evidence:

```text
categoryId
artifacts[]
lifecycle
relation
```

Category/artifact semantics remain owned by Standard Taxonomy v1. The assessment artifact references them; it does not become a second taxonomy authority.

## Acquisition state

Each entry records:

```text
level = L0 | L1 | L2
observedAt
```

The intended budget remains:

```text
L0
  bounded metadata for all eligible repositories

L1
  repository structure / basic validation evidence for selected needs

L2
  deep evidence only for bounded repositories/dimensions where it changes a decision
```

This makes the sidecar compatible with large portfolios without deep-scanning every repository.

## Section wrappers

Each assessment section is wrapped as:

```json
{
  "state": "not-collected",
  "value": null
}
```

Allowed states are:

```text
observed
partial
not-collected
not-applicable
unknown
```

`observed` and `partial` require a value object. The other states require `value = null`.

Sections are:

```text
quality
impact
scale
lifecycle
personalContribution
prominence
```

This is intentionally redundant with the deeper evidence vector states: the wrapper describes **artifact acquisition/section availability**, while the nested vector preserves its dimension-level evidence semantics.

## L0 skeletons

`makeAssessmentRepositorySkeleton()` can create an L0 entry before any deep assessment has run.

For a solo-owned repository it emits:

```text
quality               not-collected
impact                not-collected
scale                 not-collected
lifecycle             not-collected
personalContribution  not-applicable
prominence            not-collected
productionScore       null
```

For team/fork/contributed work, Personal Contribution is `not-collected` rather than `not-applicable`.

This is a key static-first property: **absence of acquisition is represented as absence of acquisition, not as low merit.**

## Prominence boundary

When a calibration candidate has been evaluated, a prominence section may contain:

```text
candidateId
projectProminence
personalPortfolioProminence
```

For shared/fork/contributed work, the validator rejects a non-null personal prominence unless Personal Contribution is itself represented as observed in the artifact.

If contribution evidence is unknown/not-collected:

```text
projectProminence           may be available
personalPortfolioProminence must remain null
```

This preserves the distinction between a strong project and demonstrated personal credit.

## What the artifact does not prove

A structurally valid `assessment.json` proves only that the generated projection obeys the assessment packaging contract.

It does **not** by itself prove:

- that Quality evidence is correct;
- that a benchmark or external evaluator is valid;
- that the selected prominence candidate is a production policy;
- that a project deserves a particular tier;
- that renderers display the artifact correctly;
- that all repositories were deeply assessed.

Those claims require their owning evidence and later rendered validation.

## Next integration gate

Before any production SVG/viewer consumes assessment data:

1. generate L0 sidecar entries from the current graph/provider inventory;
2. fill evidence vectors only through their owning extractors;
3. evaluate a bounded real-repository sample through the candidate prominence formulas;
4. inspect confidence/coverage and attribution failures;
5. decide whether `balanced-v1` still survives real evidence;
6. only then design tier thresholds and visual channels;
7. run rendered multi-preset/browser evidence before claiming visual completion.

Until then, `assessment.json` remains a sidecar experiment and stable reusable `v1` stays unchanged.
