# Future UI TODOs

Status: **historical; the Search TODO below is completed**.

Active work is tracked in `docs/current-roadmap.md`. This file is retained as the original cross-preset Search interaction contract that guided implementation.

## Search-aware repository/category highlighting

Status: **implemented** by #62, #63 and #64, with later view-state/preset work preserving the contract.

The implemented shared search contract covers repository names/descriptions, standard-category context, topics/facets and match reasons; repository hits preserve category context; keyboard navigation works without graph relayout; and dedicated presets receive search emphasis without changing their layout semantics.

### Preserved design rules

- Direct repository hits remain stronger than contextual category matches.
- Non-matching nodes are visually de-emphasized rather than using search as a graph-generation filter.
- Selected and hovered nodes keep precedence over passive search highlighting.
- Search uses the shared `ipm-standard-v1` category vocabulary; technology/ecosystem terms remain facets/evidence rather than silently becoming primary categories.
- Search stays deterministic and local over the already-generated graph; it does not trigger embedding/LLM requests from the browser.
- Clearing search restores normal visual state without mutating generated `graph.json`.
- Matrix/Sankey aggregate views and the other dedicated layouts preserve their own aggregation/geometry while exposing search context.

No active TODO remains in this file. See `docs/current-roadmap.md` for current priorities.
