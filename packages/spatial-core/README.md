# Spatial Core

`@interactive-project-map/spatial-core` is the dependency-free, domain-neutral extraction boundary for spatial primitives that are useful both inside Interactive Project Map and in external consumers such as FlowDeck.

The package deliberately contains **no DOM/canvas code and no GitHub-, ChatGPT-, CI-, runner-, or FlowDeck-specific state**. Product-specific code should adapt its own nodes, statuses and actions onto these primitives.

## Initial surface

- stable math primitives: `TAU`, `clamp`, `hashText`, `wrapAngle`
- deterministic scatter for stable initial placement
- bounded weighted-edge validation/deduplication
- generic force-node creation, edge linking, one-step integration and deterministic settling

The initial constants and algorithms are extracted from the existing Galaxy / Obsidian-family implementation. Browser gesture policy, rendering, labels, hit testing and selection remain in the viewer layer.

## Why this boundary exists

Interactive Project Map remains an independent project focused on project visualization. FlowDeck is a separate project-state control plane. Sharing a small spatial package keeps both products independent while preventing copy/paste drift in layout math and relation normalization.

See Issue #50 for the prior-art survey, licensing decisions and staged extraction plan.

## Stability

This package is private and pre-1.0 for now. The first objective is internal parity and regression coverage. A publishable external-consumer API should be frozen only after a real consumer adapter exists.
