# Spatial Core

`@interactive-project-map/spatial-core` is the dependency-free, domain-neutral extraction boundary for spatial primitives that are useful both inside Interactive Project Map and in external consumers such as FlowDeck.

The package deliberately contains **no DOM/canvas code and no GitHub-, ChatGPT-, CI-, runner-, or FlowDeck-specific state**. Product-specific code adapts its own state onto the generic graph contract.

## Initial surface

- stable math primitives: `TAU`, `clamp`, `hashText`, `wrapAngle`
- deterministic scatter for stable initial placement
- bounded weighted-edge validation/deduplication
- generic force-node creation, edge linking, one-step integration and deterministic settling
- generic versioned spatial graph normalization
- adapter from the current `GalaxyGraph` into the generic consumer graph

The initial constants and algorithms are extracted from the existing Galaxy / Obsidian-family implementation. Browser gesture policy, rendering, labels, hit testing and selection remain in the viewer layer.

## Generic consumer graph v1

The contract deliberately separates hierarchy/ownership from exploratory relationships:

```js
{
  version: 1,
  nodes: [
    {
      id: "project:example",
      label: "Example",
      kind: "project",
      parentId: "portfolio:main",      // optional
      status: "active",                // optional, consumer-defined vocabulary
      weight: 3.4,                     // optional non-negative visual hint
      positionHint: { x: 120, y: -40 },// optional stable spatial-memory hint
      metadata: { /* domain-owned */ },
    },
  ],
  structuralEdges: [
    { source: "portfolio:main", target: "project:example", kind: "contains", directed: true },
  ],
  relationEdges: [
    { source: "project:example", target: "project:other", kind: "research", weight: 0.86 },
  ],
}
```

`status`, `kind`, `metadata`, edge `kind`, and weight interpretation are intentionally consumer-owned. Spatial Core validates/bounds the shape but does not decide what `active`, `blocked`, `run`, `research`, or any other product concept means.

`positionHint` is an explicit stable-position input rather than a live metric. A consumer such as FlowDeck can persist project positions to preserve spatial memory even when activity/priority changes.

Structural and relation edges remain separate by design. The current `adaptGalaxyGraph()` maps ownership/membership into structural edges and `semanticEdges` into relation edges.

## External-consumer strategy

For a consumer such as FlowDeck:

1. keep the consumer's canonical project/run/chat/research model outside Spatial Core;
2. map only navigation-relevant state into the generic spatial graph;
3. persist stable positions in the consumer and pass them as `positionHint`;
4. use consumer-defined render policy for status, priority, size, badges, and actions;
5. keep detailed operations in the focused project workspace rather than expanding Spatial Core into a dashboard framework.

This lets Interactive Project Map continue evolving independently while FlowDeck reuses proven spatial behavior through a narrow adapter.

## Why this boundary exists

Interactive Project Map remains an independent project focused on project visualization. FlowDeck is a separate project-state control plane. Sharing a small spatial package keeps both products independent while preventing copy/paste drift in layout math and relation normalization.

See Issue #50 for the prior-art survey, licensing decisions and staged extraction plan.

## Stability

This package is private and pre-1.0 for now. The consumer graph is versioned from the start, but publishable API stability should be frozen only after a real external consumer exists.
