# Project Map View Model

`@interactive-project-map/project-map-view-model` is the product-specific semantic boundary shared by renderer families.

It sits **above** `@interactive-project-map/spatial-core`:

```text
canonical graph.json
        |
        v
Project Map View Model
  - browser-safe graph admission
  - repository status semantics
  - Contributed provenance contract
  - safe search/taxonomy metadata
  - status/focus projections
        |
        +------------------+
        |                  |
        v                  v
2D renderer adapters    Three.js adapter
        |
        v
Spatial Core primitives where geometry/relation math is generic
```

## Owns

- GitHub username and repository identity admission needed by the public Project Map.
- `Original`, `Fork`, `Archived`, and `Contributed` precedence.
- Strict external-Contributed provenance/diagnostic admission.
- Renderer-safe repository metadata such as timestamps, topics and taxonomy search facets.
- Pure graph projections whose output can be compared across renderers.

## Does not own

- Canvas2D or WebGL drawing.
- 2D pan/zoom or 3D orbit/dolly camera behavior.
- Labels, raycasting/hit testing, hover effects or details DOM.
- Three.js loading/disposal.
- Generic force math or weighted relation normalization; those remain Spatial Core responsibilities.

## P0 integration

The experimental Three.js Lab is the first direct browser consumer. Its generated runtime uses this model for graph admission and repository-status projection, while retaining its existing renderer-specific search, camera and scene implementation.

The 2D family remains behaviorally unchanged in P0. Cross-renderer migration should move semantics into this package only when existing 2D regression gates prove parity.
