# Repository Quality presentation viewer gate v1

Status: **experimental query-only browser integration / renderer-neutral payload consumer / default Structure unchanged**

This gate connects the shared interactive graph viewer to the renderer-neutral Quality presentation model without turning the browser into an assessment engine.

## Activation

Quality is requested only with:

```text
?quality=1
```

Normal Structure URLs do not fetch a Quality payload and do not change node rendering or details.

```text
default additional Quality requests = 0
```

## Renderer payload

When explicitly requested, the browser fetches:

```text
project-map/quality-presentation.json
```

It does **not** fetch raw `assessment.json` for rendering and does not reconstruct Quality from evidence.

The payload must use:

```text
presentationId  ipm-repository-quality-presentation-v1
status          experimental-non-default
```

and its source graph owner must match the viewer owner.

The browser also refuses a presentation model that claims authority over:

```text
node size
placement
label priority
Impact halo
```

All four effects must remain `none`/`false` under the current contract.

## Graph identity synchronization

Quality does not activate until the loaded graph and presentation payload agree on both:

```text
source.graphGeneratedAt == graph.generatedAt
exact repository graphNodeId set
```

A HEAD race such as:

```text
new graph.json
old quality-presentation.json
```

therefore fails open to Structure even when the repository membership set happens to be unchanged. This avoids attaching old Quality evidence to a newer graph snapshot merely because the same repositories still exist.

Repository discovery and graph snapshot identity remain owned by the graph/presentation generation pipeline, not the browser.

## Compact graph ring

The canvas consumes `views.compact` directly from the presentation model.

It draws the target-finding distribution:

```text
supports
neutral
weakens
mixed
unknown
```

using both hue and distinct dash patterns. The renderer does not recalculate applicability, evidence coverage, or finding direction.

The browser validates the supplied compact distribution before drawing it:

```text
sum(count) == denominator
ratio == count / denominator for each segment
sum(ratio) == 1 when denominator > 0
zero denominator => all counts and ratios are zero
```

This is integrity validation of the renderer-neutral payload, not browser-side Quality inference.

The ring is drawn outside the Structure repository core and does not modify `nodeRadius()` or graph layout state.

## Detail view

On repository selection, the details panel consumes:

```text
views.detail.coverage
views.compact.segments
views.detail.segments
```

to show:

```text
Quality evidence
Quality findings
Quality dimensions
```

Compact distribution remains a summary while detail preserves dimension identity.

## Unavailable Quality

An entry with `quality-unavailable` remains visible in the graph as a normal Structure node. In opt-in Quality mode its detail panel can state that Quality evidence is not collected/unavailable.

No synthetic unknown ring is created.

## Fail-open behavior

The Quality layer becomes `unavailable` while Structure remains usable if:

- the presentation file is missing;
- its root contract is invalid;
- owner does not match;
- `source.graphGeneratedAt` does not exactly match the loaded graph snapshot;
- repository membership does not exactly join the graph;
- compact/detail presentation shape is invalid;
- compact count/ratio distribution is internally inconsistent;
- visual authority exceeds the current no-geometry contract.

These are Quality-layer failures, not graph-loading failures. An expected missing sidecar may produce a browser network-console 404, but it must not raise a page exception or surface graph error UI.

## Runtime diagnostics

The experimental runtime exposes `window.ProjectMapQualityView.snapshot()` with bounded diagnostics including:

```text
requested
state
disabled | loading | active | unavailable
presentationUrl
available / unavailable
lastDrawnRings
semanticSource = renderer-neutral-presentation
geometryAuthority = overlay-only
productionRankingAllowed = false
```

This is intended for regression evidence, not a stable public API.

## Current live publication state

The personal profile does not yet publish `project-map/quality-presentation.json`. Until an explicit candidate is published, a live `?quality=1` request correctly exercises the fail-open path.

The generator and presentation-model regressions can produce a 15-repository candidate with four Quality-available entries, but publication remains a separate gate.

## Regression gates

Browser tests require:

1. normal Structure URL causes zero Quality-presentation requests;
2. `?quality=1` + valid presentation activates exactly the supplied available entries;
3. renderer displays supplied coverage/findings/dimension identity without reading raw assessment evidence;
4. graph node objects are not mutated with synthetic Quality state;
5. missing presentation returns to Structure without graph error UI or page exception;
6. stale `graphGeneratedAt` fails open instead of activating;
7. inconsistent compact count/ratio data fails open instead of being normalized silently;
8. a payload claiming node-size authority is rejected;
9. successful active rendering retains browser canvas evidence in the existing browser-e2e artifact.

The build postprocess that injects the runtime is idempotent and targets only the shared `/u/` graph viewer.

## Still outside scope

This gate does not:

- publish the presentation payload from the default Action;
- enable Quality by default;
- add a normal UI toggle;
- modify dedicated Tree/Treemap/Timeline/etc. viewers;
- score or rank Quality;
- change node size or label priority;
- enable Portfolio Prominence;
- move stable `v1`.

## Next gate

After exact-head CI:

```text
explicit assessment candidate
  -> explicit quality-presentation candidate
  -> publish experimental profile sidecars
  -> run browser against exact published pair
  -> inspect dark/obsidian + realistic profile scale
  -> decide opt-in UI discoverability
```

Assessment acquisition, presentation projection, and browser rendering remain three separate responsibilities.
