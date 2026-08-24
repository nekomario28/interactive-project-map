# Repository Quality presentation model v1

Status: **experimental renderer-neutral join contract / non-default Quality mode / no production renderer integration**

The assessment path now has a validated candidate artifact and a score-free Quality overlay projection. The next integration boundary is not to let each renderer independently re-interpret assessment data. Instead, graph identity and assessment identity are joined once into a renderer-neutral presentation model.

Implementation:

```text
scripts/repository-quality-presentation.mjs
```

Regression coverage:

```text
tests/repository-quality-presentation.test.mjs
```

## Pipeline

```text
graph.json
  +
assessment.json candidate
  ↓ strict graphNodeId join
Quality presentation model
  ├ repository identity/context
  ├ Quality availability
  ├ detail fixed-dimension view
  ├ compact finding-distribution view
  └ explicit visual authority boundaries
       ↓ later
experimental SVG / interactive renderer
```

The presentation model does not become assessment authority. It is a deterministic renderer-facing projection.

## Strict join by default

Every repository node in the graph must have exactly one assessment entry, and every assessment repository must join a graph repository node.

Default behavior:

```text
missing assessment entry -> reject
orphan assessment entry  -> reject
duplicate graph node id   -> reject
duplicate assessment id   -> reject
owner mismatch            -> reject
```

A non-strict mode exists only for diagnostics and bounded migration experiments. Production-facing Quality presentation should use the strict join.

This prevents a renderer from silently dropping or inventing portfolio membership.

## Available vs unavailable Quality

The presentation model preserves the assessment projection boundary:

```text
Quality observed/partial
  -> overlayState = available

Quality not-collected/unknown/not-applicable
  -> overlayState = unavailable
```

Unavailable repositories receive an explicit renderer token:

```text
quality-unavailable
```

They do **not** receive a synthetic eight-dimension unknown ring.

That distinction remains visible at both compact and detail scales.

## Two scale views, one semantic source

For available Quality:

```text
detail
  full-fixed-dimension-ring
  preserves dimension identity
  8 stable global slots

compact
  target-finding-distribution
  does not preserve dimension identity
  requires detail for dimension-level interpretation
```

Both views are derived from the same canonical Quality overlay. The compact view is not separately assessed.

This preserves the scale-aware rule:

```text
detail identity != compact distribution
```

without allowing the two views to drift semantically.

## Quality does not own portfolio prominence yet

The existing Structure renderer currently has its own layout and repository-radius behavior, including Stars-derived radius in some static modes.

This Quality presentation contract deliberately sets:

```text
placementEffect      none
nodeSizeEffect       none
labelPriorityEffect  none
impactHaloEffect     none
```

and:

```text
repositoryCore = inherit-structure-renderer
```

Therefore this stage adds Quality evidence semantics without pretending that Quality already determines project importance.

The future Portfolio Prominence layer remains responsible for any calibrated combination of:

```text
Quality
Impact
Scale
Maturity
Personal Contribution
```

Quality alone must not resize or recenter repositories before that calibration exists.

## Renderer must not re-infer Quality

A renderer consuming this model must not inspect README files, CI configuration, Stars, repository age, artifact type, or raw evidence to decide Quality presentation.

The renderer may choose geometry and accessible styling, but it receives semantic state from the presentation model:

```text
overlayState
qualitySectionState
views.detail
views.compact
coverage
attention state
visual policy
```

This keeps acquisition/evaluation logic out of presentation code.

## Current-profile regression target

The current frozen profile candidate contains:

```text
repositories      15
Quality available  4
Quality unavailable 11
```

The presentation model must join all 15 entries exactly.

The four currently available Quality overlays remain:

```text
interactive-project-map
ProjExD_Group10
gz-sim
turing-smart-screen-python-owl
```

For `interactive-project-map`, the detail view preserves eight global dimension slots and reports `4/6 interpreted`, while the compact view exposes the target-finding distribution without claiming dimension identity.

Unassessed entries such as `FTBPublicClaims` remain `quality-unavailable`.

## Contribution and relation boundary

The model carries validated assessment context for renderer display, but Quality presentation does not mutate relation state.

For example, the current L0 profile still leaves collaboration unresolved for several owned repositories. That uncertainty stays in the assessment context until a separate relation-enrichment path resolves it.

Likewise the contributed `c0c25034/ProjExD_4` entry remains Quality-unavailable while its L0 artifact context is unresolved, even though person-side activity evidence exists.

## What this model proves

Once exact-head CI passes, it proves that:

- graph and assessment membership can be joined deterministically;
- all current repositories remain represented in a Quality-mode presentation projection;
- available and unavailable Quality remain distinct;
- compact/detail semantics come from one source;
- Quality cannot accidentally alter node size, placement, label priority, or Impact channels;
- renderer code need not become an assessment engine.

It does not prove:

- final SVG geometry;
- accessibility across all themes and sizes;
- production `assessment.json` publication;
- default viewer integration;
- Quality scoring/ranking/tiers;
- Portfolio Prominence weights.

## Next gate

After this model is exact-head validated, build a separate experimental renderer fixture that consumes only this presentation model.

The renderer should show all 15 repositories, use `quality-unavailable` for the 11 unassessed entries, render compact distributions at profile-scale and fixed-dimension rings only in detail-scale views, and leave current Structure mode unchanged.
