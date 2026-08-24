# Repository Quality presentation candidate v1

Status: **explicit derived renderer payload / experimental non-default mode / assessment remains authority**

The renderer-neutral Quality presentation model is now the boundary between assessment semantics and browser/SVG renderers. This CLI materializes that model without asking a renderer to re-evaluate Quality.

## Pipeline

```text
graph.json
  +
assessment.json candidate
  ↓ strict graphNodeId join
repository-quality-presentation-candidate.mjs
  ↓
quality-presentation.json candidate
  ↓ later
query-gated experimental renderer
```

`quality-presentation.json` is a derived presentation payload. It is **not** a second assessment authority and must never replace `assessment.json`.

## Invocation

```bash
node scripts/repository-quality-presentation-candidate.mjs \
  --graph path/to/graph.json \
  --assessment path/to/assessment.json \
  --out path/to/quality-presentation.json
```

Optional diagnostics:

```text
--diagnostics-out path/to/quality-presentation-diagnostics.json
```

The generator always uses the current frozen repository assessment policy and strict graph/assessment membership join.

## Strict join

The generator inherits the renderer-neutral model contract:

```text
missing assessment repository -> reject
orphan assessment repository  -> reject
duplicate graphNodeId          -> reject
duplicate assessment graphNodeId -> reject
owner mismatch                 -> reject
```

A renderer therefore receives an already-joined portfolio projection instead of silently deciding which assessment entries belong to which graph nodes.

## Input/output safety

The CLI rejects output paths that overwrite either input and rejects diagnostics/output path collisions.

It does not mutate input `graph.json` or `assessment.json`.

## Current-profile regression

The frozen current-profile regression produces:

```text
graph repositories       15
assessment repositories  15
joined                    15
Quality available          4
Quality unavailable       11
strict join             true
```

The four available repositories remain:

```text
interactive-project-map
ProjExD_Group10
gz-sim
turing-smart-screen-python-owl
```

All other current entries remain explicit `quality-unavailable`; no synthetic unknown ring is created.

## Renderer authority boundary

The output already contains:

```text
views.detail
  fixed dimension identity

views.compact
  target finding distribution

visualPolicy
  nodeSizeEffect       none
  placementEffect      none
  labelPriorityEffect  none
  impactHaloEffect     none
```

A browser or SVG renderer may choose accessible geometry/styles for those semantic tokens, but must not inspect raw assessment evidence, Stars, README text, CI configuration, repository age, or artifact type to derive a different Quality interpretation.

## Why this is separate from assessment publication

A future workflow may publish `assessment.json` and `quality-presentation.json` together, but they have different roles:

```text
assessment.json
  canonical assessment evidence/context

quality-presentation.json
  deterministic renderer-facing projection
```

The presentation payload is disposable/rebuildable from graph + assessment + policy.

## Still not production

This CLI does not:

- alter the default project-map Action output;
- publish presentation data automatically;
- enable a normal viewer Quality toggle;
- alter Structure mode;
- score, rank, tier, resize, or recenter repositories;
- enable Portfolio Prominence;
- move stable `v1`.

The next gate is a query-only browser consumer that fetches **this presentation payload**, not raw assessment data, and makes zero extra requests on normal Structure URLs.
