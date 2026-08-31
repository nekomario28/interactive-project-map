# Search Context parity E2E race — 2026-08-31

## Observation

During the all-research reconcile PR, `tests/e2e/threejs-search-context.spec.mjs` failed once and passed on an immediate rerun with no runtime changes.

The failed assertion showed the 2D snapshot already carrying the normalized query while its derived `directRepositoryIds`, `directCategoryIds`, `contextCategoryIds`, `categoryMemberIds` and `matchReasons` were still empty. The following Three.js snapshot had the expected derived semantic projection.

## Initial diagnosis — superseded

The first diagnosis attributed the failure only to the E2E completion condition polling `window.ProjectMapSearchContext.snapshot().query`. The test was strengthened to wait for the full semantic snapshot and to compare both renderers independently against the renderer-neutral pure model.

That test change was still useful because it stopped accepting an intermediate/incorrect semantic state. However, the conclusion that this was only test synchronization was **superseded by later main evidence**.

## Reconciliation: production bootstrap race

After the stronger test was merged, main `2c297dde94583e8a22b56c54c32657ded4c97cc9` failed the same parity gate again. The 2D snapshot retained the normalized query for ten seconds while alias/facet/category-derived IDs and reasons remained empty. A retry in the same run failed on a different semantic query. This ruled out the original "query changed before projection settled" explanation as the complete cause.

Inspection of the deployed Pages artifact identified the runtime ordering failure:

1. a base 2D viewer script runs first as a deferred script and immediately starts the asynchronous `graph.json` fetch;
2. later deferred scripts install shared runtime patches such as `interaction-polish.js` and `project-map-view-model.js`;
3. `interaction-polish.js` wraps `sanitizeGraph` to preserve browser-safe taxonomy aliases/search facets and semantic metadata;
4. if the graph response resolves before that later patch is installed, the legacy sanitizer runs first and permanently drops that metadata from `state.graph`.

The outcome therefore depends on response timing. Slow/normal responses use the patched sanitizer; sufficiently fast responses can use the legacy sanitizer. This explains why identical code could pass one CI run and fail another, and why the failed snapshot had a correct query but no alias/facet/category matches.

## Correct fix

The 2D graph-load bootstrap is gated until `DOMContentLoaded`, which fires only after the ordered deferred-script set has executed. All nine 2D viewer runtimes therefore begin graph loading only after their shared sanitizer/search/view-model patches are installed.

The regression proof checks the ordering directly: when the graph fetch begins, both `window.ProjectMapSearchContext` and canonical `window.ProjectMapViewModel.projectSearchContext` must already exist. It then verifies taxonomy-alias and facet search against the loaded graph.

The earlier full-snapshot oracle remains valuable and is retained. It is now a correctness assertion on top of the actual runtime-order fix rather than the fix itself.
