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
  - transferable URL state
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
- The transferable URL subset: `username`, `q`, `status`, `motion`, `activity`, `focus`, `depth`, and repository-quality `quality=1`.

## Does not own

- Canvas2D or WebGL drawing.
- 2D pan/zoom or 3D orbit/dolly camera behavior.
- Labels, raycasting/hit testing, hover effects or details DOM.
- Three.js loading/disposal.
- Renderer-local camera or backing-store state. In particular, Three.js `render=auto|high|low` is intentionally outside the transferable contract.
- Generic force math or weighted relation normalization; those remain Spatial Core responsibilities.

## Integration

P0 made the experimental Three.js Lab the first direct semantic-model consumer for graph admission and structural repository-status projection.

P1 adds a small pure transferable-state API generated into the browser from the same source. The shared `/u/` viewer and the Three.js Lab parse/serialize the same cross-renderer URL contract, while renderer-local state stays with its adapter. The Three.js backing-store control is named **Render** rather than **Quality**, preserving `quality=1` exclusively for repository Quality evidence.

Canvas/WebGL drawing, cameras and scene implementations remain intentionally separate.
