# Dedicated viewer status projection

## Goal

Make Original / Fork / Archived filters mean the same thing in all eight dedicated viewers without copying filter logic into eight renderer implementations.

## Adopted boundary

`public-dedicated-view-state.js` runs before the existing dedicated viewer script. It wraps only the static `project-map/graph.json` fetch, computes repository-status counts, removes repositories whose statuses are disabled, repairs group/repository counts and prunes edges, then returns the projected JSON to the existing sanitizer/layout code.

The dedicated renderer remains the authority for Tree, Radial, Treemap, Timeline, Cluster, Sunburst, Matrix and Sankey layout. No renderer or graph algorithm is duplicated.

Status changes update the existing shareable `status=` URL state and reload the same static viewer. This intentionally rebuilds aggregate/dedicated layouts from the selected repository set instead of trying to mutate eight different internal state machines. It adds one static `graph.json` reload per explicit filter change, but no GitHub REST request and no owner-side service load.

## Build ownership

[`build-public-pages.mjs`](../scripts/build-public-pages.mjs) emits the status controls, copies the shared projection runtime, and places it before each dedicated renderer. These prerequisites belong to page generation: attaching them later creates an incomplete intermediate page and an unnecessary ordering dependency.

Dedicated renderer sources directly own Contributed status precedence, palette and aggregate composition. They call [`public-dedicated-graph.js`](../scripts/public-dedicated-graph.js) directly for repository URL validation and metadata normalization, strict external admission, category-only layout projection without graph ownership mutation, and contribution details. The builder emits this runtime as a shared dependency before each dedicated renderer instead of inserting code into renderer sources.

Owned URLs may canonicalize extra GitHub path segments; external URLs require exactly an owner/repository path. That distinction must survive reuse of the URL parser. Owned and external topic limits also remain distinct. Owner/group admission, duplicate-ID handling, edges and dates remain renderer projections, not switches in a universal graph sanitizer.

Radial owns its external-ring geometry; category-only renderers explicitly request the temporary external layout projection. The shared runtime's evidence snapshot reads the current admitted graph through a renderer-provided callback rather than owning a second graph state.

Dedicated admission currently rejects external repository URLs with extra path segments, while the shared view-model canonicalizes those URLs. The returned node and graph shapes also differ. Replacing admission wholesale therefore requires explicit behavioral reconciliation, not merely a shared function call.

## Why this is minimal

- one browser adapter, not eight renderer patches;
- existing sanitizers still validate the projected graph;
- existing `tree-nav.js` keeps semantic URL state when switching styles;
- existing HUI `control-cluster`, status-chip styling, zero-count behavior and result-count semantics are reused;
- no graph/UI dependency and no new backend state.

## Gate

Browser tests must prove all eight dedicated routes receive the same projected repository set for the same `status=` state, that toggles survive reload through the URL, and that absent statuses are disabled.
