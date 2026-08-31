# Search Context parity E2E race — 2026-08-31

## Observation

During the all-research reconcile PR, `tests/e2e/threejs-search-context.spec.mjs` failed once and passed on an immediate rerun with no runtime changes.

The failed assertion showed the 2D snapshot already carrying the normalized query while its derived `directRepositoryIds`, `directCategoryIds`, `contextCategoryIds`, `categoryMemberIds` and `matchReasons` were still empty. The following Three.js snapshot had the expected derived semantic projection.

## Diagnosis

The E2E completion condition polled only `window.ProjectMapSearchContext.snapshot().query`. That field can become current before the test observes the complete semantic projection used for parity comparison. The test therefore had a race window and could capture an intermediate 2D state.

This is test synchronization evidence, not a demonstrated product/runtime semantic bug.

## Fix

The parity E2E now derives the canonical expected snapshot from the same renderer-neutral pure model after sanitizing the fixture, then polls each renderer until the **entire semantic snapshot** equals that oracle.

This improves two properties at once:

1. the test no longer treats the query string alone as proof that semantic projection has settled;
2. 2D and Three.js are each checked against the renderer-neutral model rather than using 2D as the sole oracle, so a hypothetical shared renderer bug cannot pass merely because both sides agree.

No production runtime or rendering behavior changes.
