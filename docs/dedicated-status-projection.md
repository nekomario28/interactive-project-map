# Dedicated viewer status projection

## Goal

Make Original / Fork / Archived filters mean the same thing in all eight dedicated viewers without copying filter logic into eight renderer implementations.

## Adopted boundary

`public-dedicated-view-state.js` runs before the existing dedicated viewer script. It wraps only the static `project-map/graph.json` fetch, computes repository-status counts, removes repositories whose statuses are disabled, repairs group/repository counts and prunes edges, then returns the projected JSON to the existing sanitizer/layout code.

The dedicated renderer remains the authority for Tree, Radial, Treemap, Timeline, Cluster, Sunburst, Matrix and Sankey layout. No renderer or graph algorithm is duplicated.

Status changes update the existing shareable `status=` URL state and reload the same static viewer. This intentionally rebuilds aggregate/dedicated layouts from the selected repository set instead of trying to mutate eight different internal state machines. It adds one static `graph.json` reload per explicit filter change, but no GitHub REST request and no owner-side service load.

## Why this is minimal

- one browser adapter, not eight renderer patches;
- existing sanitizers still validate the projected graph;
- existing `tree-nav.js` keeps semantic URL state when switching styles;
- existing HUI `control-cluster`, status-chip styling, zero-count behavior and result-count semantics are reused;
- no graph/UI dependency and no new backend state.

## Gate

Browser tests must prove all eight dedicated routes receive the same projected repository set for the same `status=` state, that toggles survive reload through the URL, and that absent statuses are disabled.
