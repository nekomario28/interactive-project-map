# Repository Quality viewer feature gate v1

Status: **experimental opt-in interactive viewer integration / default Structure unchanged / no production scoring**

This gate is the first browser integration of the score-free repository Quality model. It intentionally does not make Quality part of the default viewer contract.

## Activation

The shared interactive graph viewer enables Quality only when the URL contains:

```text
?quality=1
```

Without that parameter:

```text
assessment request count = 0
Quality drawing changes  = 0
Quality detail changes   = 0
```

The graph continues to load only `project-map/graph.json` as before.

## Sidecar source

When explicitly enabled, the viewer additionally requests:

```text
https://raw.githubusercontent.com/<owner>/<owner>/HEAD/project-map/assessment.json
```

The assessment sidecar remains the only assessment authority. The browser does not create a second `quality.json` authority.

The browser accepts only the experimental v1 boundary:

```text
schemaVersion        1
contractId           ipm-repository-assessment-artifact-v1
assessmentPolicyId   ipm-repository-assessment-v1
productionScoring    false
owner                viewer owner
```

Repository Quality sections are available only for `observed` or `partial` state. `not-collected` remains unavailable rather than becoming a synthetic all-unknown ring.

## Artifact-route safety

A Quality vector must declare artifact facets already present in the repository assessment context.

```text
assessment context = application
Quality route      = application
  -> allowed

assessment context = library
Quality route      = application
  -> reject

assessment context = unknown
Quality route      = application
  -> reject
```

The viewer is presentation-only. It cannot invent semantic context to make its own overlay renderable.

## Compact ring

The graph canvas uses the compact target-finding distribution already defined by the Quality overlay contract:

```text
supports
neutral
weakens
mixed
unknown
```

The denominator remains only:

```text
required + recommended target dimensions
```

Optional and not-applicable dimensions do not inflate the denominator. Unknown applicable targets remain visible as unresolved share.

The ring does not encode:

```text
Quality score
Confidence score
Impact
Stars
Forks
Portfolio Prominence
rank
tier
```

It has no authority over node size, label priority, graph position or category membership.

## Non-color differentiation

The initial canvas implementation does not rely on hue alone. Finding states also use different dash patterns:

```text
supports  solid
neutral   short dash
weakens   longer dash
mixed     compound dash
unknown   sparse dot/dash
```

This is an accessibility improvement over a color-only prototype, but it is not yet a complete color-vision or theme acceptance review.

## Detail view

Compact rings intentionally discard dimension identity. When a repository is selected in Quality mode, the normal details panel additionally exposes:

```text
Quality evidence     directional coverage label
Quality findings     target finding counts
Quality dimensions   target dimension -> finding state
```

This preserves the contract:

```text
compact = distribution summary
full/detail = dimension identity
```

No numeric Quality grade is introduced merely to make the detail panel concise.

## Fail-open behavior

If the explicit Quality request encounters:

```text
404 assessment sidecar
invalid root contract
owner mismatch
unsupported policy
invalid repository key
artifact-route mismatch
unsupported dimension/finding state
```

then Quality enters:

```text
qualityMode = unavailable
```

and the Structure graph remains usable. The failure is not surfaced as a graph loading error because `graph.json` remains authoritative for Structure mode.

## Current live profile state

At the time of this gate implementation, the current `nekomario28/nekomario28` profile does **not** publish:

```text
project-map/assessment.json
```

Therefore a live `?quality=1` request currently exercises the fail-open path. The separate candidate CLI and current-profile receipts already validate generation of an assessment candidate, but default publication remains deliberately disabled.

## Regression coverage

The browser regression suite verifies:

1. default viewer makes zero `assessment.json` requests;
2. `?quality=1` with a valid sidecar activates Quality;
3. one assessed repository draws one compact ring;
4. an unassessed repository remains explicitly `Not collected`;
5. selected repository details expose coverage, finding distribution and dimension identity;
6. Quality runtime reports `geometryAuthority = overlay-only`;
7. the graph node is not mutated with a synthetic `quality` field;
8. a missing sidecar leaves the Structure graph usable without showing the graph error panel.

The build postprocess is idempotent and injects `quality-view.js` into only the shared graph viewer route.

## Production boundary

This change still does not:

- publish `assessment.json` from the default Action;
- expose a normal UI toggle;
- enable Quality on dedicated Tree/Treemap/Timeline/etc. viewers;
- alter default Structure mode;
- alter node size or label priority;
- enable Quality ranking or tiers;
- enable Portfolio Prominence;
- move stable `v1`.

## Next gates

A safe progression is:

```text
feature-gate exact-head CI
  -> explicit current-profile assessment candidate artifact
  -> browser test against that exact candidate
  -> dark/obsidian + realistic scale visual acceptance
  -> opt-in assessment publication path
  -> visible experimental Quality toggle
  -> broader repository Quality acquisition
  -> Portfolio Prominence calibration
```

Assessment publication and UI discoverability should remain separate decisions: a sidecar may be generated experimentally before Quality becomes a normal user-facing mode.
