# Repository Quality assessment projection v1

Status: **experimental one-way presentation projection / no production viewer integration / no new quality.json authority**

The repository assessment sidecar already defines the future generated artifact:

```text
project-map/assessment.json
```

That artifact owns the packaged repository assessment sections for Quality, Impact, Scale, lifecycle, Personal Contribution and Prominence. The Quality presentation layer therefore must not introduce a second competing `quality.json` authority merely because a renderer needs convenient data.

This document defines a one-way projection:

```text
assessment.json
  repository.quality section
       ↓
Quality vector
       ↓ derive
Confidence coverage vector
       ↓
Quality overlay model
  ├ full fixed-dimension ring
  └ compact target-finding distribution
```

Implementation:

```text
scripts/repository-quality-assessment-projection.mjs
```

Regression coverage:

```text
tests/repository-quality-assessment-projection.test.mjs
```

## Why not quality.json

A separate Quality artifact would duplicate identity, observation provenance, artifact routing, relation context and acquisition state already present in `assessment.json`.

That creates avoidable risks:

- two generated files can disagree on repository identity or observation time;
- Quality can become detached from artifact/lifecycle/relation context;
- renderer-specific state can accidentally become assessment authority;
- unknown/not-collected section state can be lost during a convenience export;
- future Impact/Prominence views would repeat the same fragmentation.

The renderer may cache or transform presentation data internally, but the generated assessment sidecar remains the source projection.

## Repository projection state

Every repository remains present in the projection, even when no Quality overlay is available.

```text
quality.state = observed | partial
  overlayState = available
  overlay      = derived semantic model

quality.state = not-collected | unknown | not-applicable
  overlayState = unavailable
  overlay      = null
```

The original `qualitySectionState` is retained.

## Critical unknown boundary

These states are not equivalent:

```text
QUALITY NOT COLLECTED
  evaluator has not produced a Quality vector

QUALITY VECTOR WITH UNKNOWN DIMENSIONS
  evaluator has routed the repository and some applicable dimensions remain unresolved
```

The former must not be rendered as an eight-segment unknown ring. Doing so would falsely imply that assessment was run and concluded that every dimension was unknown.

Only an `observed` or `partial` Quality section may produce an overlay.

## Confidence is derived, not duplicated

The Quality vector already contains applicability, evidence state and finding direction for every dimension. Confidence coverage is therefore derived using the canonical Confidence builder before presentation:

```text
Quality vector
  ↓
buildQualityConfidenceVector()
  ↓
buildQualityOverlayModel()
```

There is no need to persist a second Confidence score or duplicated coverage summary in `assessment.json` merely for rendering.

If the future acquisition pipeline needs durable evidence provenance beyond the Quality vector, extend the owning assessment contract deliberately rather than adding renderer-only authority.

## Artifact-context fail-closed rule

An available Quality vector must be compatible with the repository artifact context packaged in `assessment.json`.

For example:

```text
assessment context artifacts = [library]
Quality vector artifacts      = [application]
```

is rejected instead of rendered.

Likewise, an available Quality overlay is rejected when assessment artifact context is still fully unknown.

This prevents a stale or incorrectly joined Quality vector from being displayed under the wrong rubric.

A multi-artifact Quality vector may use a subset of the assessment artifact facets, but every Quality routing artifact must be present in the assessment context.

## Source provenance

The projection records the assessment source identity:

```text
contractId
author/owner
generatedAt
generatorRevision
assessmentPolicyId
```

and per repository:

```text
repositoryKey
graphNodeId
qualitySectionState
overlayState
```

It does not copy raw GitHub evidence or become a new evidence source.

## Calibration donors must not leak into a portfolio artifact

An external repository can be useful as a rubric/calibration donor without being part of the assessed person's portfolio.

Those are different relations:

```text
CALIBRATION DONOR
  used to test artifact-specific assessment behavior

PORTFOLIO CONTRIBUTED REPOSITORY
  person-side contribution to an externally owned project is actually evidenced
```

Do not insert an external donor into a person's `assessment.json` merely to exercise another artifact family. Doing so can accidentally represent the donor as contributed work and create false personal attribution.

For cross-artifact calibration, use a separate assessment artifact whose `owner` and repository relation are truthful for that donor, or keep the donor in calibration fixtures. For example, an external dataset donor should remain under its own owner context while the personal profile sidecar contains only actual portfolio repositories.

The presentation projection does not infer whether an externally owned repository is a real contribution. It trusts the relation already packaged in the validated assessment artifact. Therefore donor-vs-portfolio separation must be enforced by acquisition/calibration workflow before projection.

## Full and compact views share one source

The projection creates one canonical Quality overlay model. That model exposes both:

```text
full fixed-dimension semantic segments
compact target-finding distribution
```

The renderer chooses the view according to display scale. The compact view is not independently assessed and cannot diverge from the full view.

## What this projection must not do

It has no authority to change:

```text
graph.json
assessment.json evidence
category assignment
artifact facets
repository relation
node size
label priority
Impact halo
Portfolio Prominence
Quality scalar/rank/tier
```

`compositeQualityScore` remains null and `productionRankingAllowed` remains false in the current experimental contract.

## Production integration sequence

A safe integration sequence is:

```text
1. generate assessment.json separately from graph.json
2. validate assessment artifact identity/provenance
3. join by repositoryKey / graphNodeId
4. derive Quality overlay only for observed/partial Quality sections
5. choose compact or full view from display context
6. keep missing Quality explicitly unavailable
7. expose detail/source evidence on interaction
```

Do not let the renderer infer artifact type, Quality evidence or relation state from `graph.json` once the assessment sidecar is authoritative for the packaged assessment projection.

## Current claim boundary

This projection proves only that assessment data can be transformed into deterministic, score-free presentation semantics while preserving unavailable/unknown distinctions and artifact routing.

It does not prove:

- production acquisition completeness;
- visual accessibility in every theme/scale;
- final Quality weights or tiers;
- Portfolio Prominence;
- the scientific or factual validity of assessed artifacts;
- that assessment.json is ready to ship as a stable public contract.

## Next gate

Before production renderer integration:

1. generate a bounded real personal `assessment.json` containing only actual portfolio repositories and the frozen application/library Quality cases that truthfully belong there;
2. build a separate donor-owned calibration assessment artifact for the external dataset case instead of inserting it into the personal portfolio;
3. run this projection over both artifacts rather than direct Quality fixture inputs;
4. verify personal graph join completeness and fail-closed mismatch behavior;
5. render full/compact overlays from the generated assessment artifacts;
6. inspect dark/light, compact profile scale, and interactive detail scale;
7. only then add a non-default experimental Quality view or feature flag.
