# Contributed admission and SVG audit — 2026-08-24

## Decision

`Contributed` is a portfolio claim about public work that has entered an external repository, not a feed of every upstream proposal.

The default admission rule is therefore:

- include an external repository when the rolling contribution window contains at least one **merged pull request**, or at least one **commit contribution recorded in that external repository**;
- do not admit a repository solely because the user opened one or more still-unmerged pull requests;
- after admission, rank by merged PRs, then commits, then PRs, then repository name, and retain the existing bounded cap.

Pending upstream PRs remain useful activity evidence, but they are not the same claim as accepted contribution. If the product later needs to show them, use a separate relation/label such as `Pending upstream` rather than weakening `Contributed`.

## Why not merged-only

Merged-only has high precision but is too narrow for users who can contribute directly to repositories where their commits are accepted without a pull request. GitHub `ContributionsCollection` already exposes external commit contributions, so accepted direct commits are an evidence-backed second admission path.

No patch-size, changed-file, star-count, or arbitrary weighted threshold is used. Large open PRs can represent substantial work, but size alone does not prove that an external project accepted it.

## Real portfolio audit

The 2026-08-23 production graph contained six external repositories:

| Repository | Commits | PRs | Merged PRs | Decision under accepted-work rule |
| --- | ---: | ---: | ---: | --- |
| `c0c25034/ProjExD_4` | 1 | 1 | 1 | include |
| `gazebosim/gz-sim` | 0 | 1 | 0 | pending only |
| `gazebosim/ros_gz` | 0 | 1 | 0 | pending only |
| `SkyAdri-mc/BuyClaimChunks` | 0 | 1 | 0 | pending only |
| `talhanation/recruits` | 0 | 1 | 0 | pending only |
| `talhanation/workers` | 0 | 1 | 0 | pending only |

The pending PRs include meaningful work, including large NeoForge ports. Their exclusion is not a quality judgment; it keeps the public `Contributed` claim semantically precise until upstream acceptance is observable.

## Category / ownership boundary

External repositories continue to have no serialized `groupId`, `groupLabel`, ownership edge, or category-membership edge.

This is intentional. The user's owned taxonomy hierarchy expresses portfolio ownership. Injecting an external repository into that hierarchy would make a descriptive content category look like an ownership path.

External repositories are still passed through repository classification and may carry `classification.categoryId` / `classification.categoryLabel`. That classification is descriptive metadata and may be shown in details or search UI, but it must not become an ownership membership edge.

For layouts that require every visible repository to belong to a visual container, create a **presentation-only** `External contributions` group on a copied render model. Never serialize that projection back into `graph.json`.

## SVG finding and repair

The profile generator already attached Contributed nodes to the final graph before rendering `galaxy.svg`, but Galaxy Systems SVG layout only enumerated repositories that matched a serialized category `groupId`. Because Contributed nodes intentionally have no `groupId`, the canonical profile `graph.json` contained six Contributed repositories while the static Galaxy Systems SVG omitted them.

The repair projects Contributed nodes into a temporary `External contributions` system during Galaxy Systems SVG rendering, adds an explicit Contributed status color/legend entry, and leaves the canonical graph untouched.

Regression coverage must prove:

- an accepted Contributed node appears in Galaxy Systems SVG;
- the external visual system is labeled `External contributions`;
- the SVG includes an explicit Contributed legend/status color;
- rendering does not add `groupId` to the canonical Contributed node;
- every owned and Contributed repository remains represented in the SVG.

## Reopen conditions

Reconsider the admission rule only with evidence that either:

- direct external commit contributions are producing false positives;
- merged/commit-only admission hides a product-critical class of upstream collaboration that can be represented with an equally precise relation;
- GitHub changes the semantics or availability of the contribution source.

Do not silently broaden `Contributed` back to every authored PR.