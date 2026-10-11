# Pages build ownership

## Maintenance principle

Pages post-build mutation is implementation debt, not a feature extension point. Prefer emitting the required page or runtime from its canonical source rather than generating an incomplete asset and repairing it later.

The active pipeline lives in [`package.json`](../package.json), under `build:pages`. The reviewed historical mutator set lives in [`tests/build-postprocess-budget.test.mjs`](../tests/build-postprocess-budget.test.mjs). That set is an upper bound: removals are allowed, while introducing a new mutator requires explicit maintenance review. Historical entries do not require retaining obsolete source files or commands.

## Ownership boundaries

- [`build-public-pages.mjs`](../scripts/build-public-pages.mjs) owns base Pages markup, runtime assets, initial script order and CSP. A page's required controls and dependencies should be emitted together.
- Canonical `public-*` sources own browser behavior. Shared Project Map semantics belong above renderer-specific drawing, in the existing view-model and adapters. Dedicated renderers directly own status selection, colour, opacity, archive-decoration precedence and aggregate composition. External relation remains primary, while source fork/archive flags remain metadata rather than a later build correction.
- Dedicated status controls and projection attachment belong to page generation. See [dedicated status projection](dedicated-status-projection.md) for the filtering and layout boundary.
- [`public-dedicated-graph.js`](../scripts/public-dedicated-graph.js) owns dedicated repository URL validation and metadata normalization, strict external admission, temporary external layout projection and contribution details rows. The builder copies this shared browser runtime and places it before the dedicated renderer; renderers call it directly at their admission/layout/details boundaries. Owner/group admission, duplicate IDs, edges and date projection remain renderer-specific. No renderer source is rewritten to install these behaviors. Radial's geometry remains in the Radial renderer.
- [`postprocess-public-pages.mjs`](../scripts/postprocess-public-pages.mjs) validates CSP without rewriting output. Validation and mutation are distinct responsibilities.

## Order is a behavioral contract where consumers depend on it

The dedicated status projection must load before its renderer reads the graph. Deferred shared runtime patches must be installed before asynchronous graph loading begins; the final bootstrap gate protects that runtime lifecycle.

Three.js presentation composes dimension state, style, Galaxy motion, and pattern coupling in that order. Reducing filesystem stages must preserve that composition contract. Do not merge unrelated mechanisms merely to lower the command count.

## Migration and verification

Move one coherent responsibility into its natural owner, route consumers directly to it, and delete the obsolete path in the same change. Do not leave a compatibility wrapper whose only purpose is preserving an internal build step.

For behavior-preserving migrations, compare complete generated output against the same base revision and inputs. Test the required output through the builder, then run the affected browser gates. Source syntax or byte equality alone does not establish interactive correctness.

Do not pin unrelated tests to the total number of stages or to an incomplete intermediate output. Assert the dependency or consumer behavior that actually matters.

## Non-goals

Build cleanup does not authorize renderer redesign, release-pin movement, a new graph model, or dormant one-click installer reactivation. Existing product, graph-authority and browser-verification boundaries remain intact.
