# Licensing audit — 2026-08-21

This document records the current licensing boundary of `interactive-project-map` after the Obsidian-like fidelity work, semantic label LOD research, and Spatial Core extraction. It is an engineering compliance note, not legal advice.

## Project license

- Repository license: **MIT** (`LICENSE`).
- Current copyright notice: `Copyright (c) 2026 SYUN`.
- Root `package.json` and private `@interactive-project-map/spatial-core` package now declare SPDX metadata `"license": "MIT"` so automated tooling does not report the packages as unlicensed/unknown.
- `private: true` only prevents accidental npm publishing; it does not conflict with the repository-level MIT grant.

### Ownership check

The audit does **not** change the copyright-holder string in `LICENSE`. `SYUN` should be confirmed by the rights holder as the intended name/pseudonym. If it is stale or incorrect, correct that notice before a formal release; the MIT notice is supposed to identify the copyright holder whose grant is being preserved.

## Runtime / shipped-code boundary

The recommended GitHub Pages path ships project-authored static JavaScript, CSS, HTML/SVG, and generated graph data. There are no npm runtime dependencies declared in `package.json`; all listed npm packages are `devDependencies` used for validation, typechecking, testing, or deployment tooling.

Therefore the current Pages output does **not** bundle Playwright, ESLint, HTML-Validate, Stylelint, TypeScript, Wrangler, Sigma.js, Cytoscape.js, MapLibre, Stellarium, d3-force, Graph Spawn, Persistent Graph, Node Factor, MSAGLJS, Atomic, sift-kg, or GraphRAG.

If a future distribution starts shipping `node_modules`, a prebuilt toolchain image, or copied third-party source, re-run this audit because notice obligations will change.

### README-derived classification data

Repository README excerpts are fetched as bounded classification input, but the current generated `GalaxyGraph` does **not** serialize `readmeExcerpt`. Deterministic README evidence stores only the matched Project Map taxonomy alias (for example `ros2` or `minecraft`), not the source README sentence. The public node retains ordinary GitHub metadata such as repository description/topics and the derived classification result.

This avoids redistributing substantial third-party README text through `graph.json`. Preserve this boundary: if a future feature starts publishing README excerpts, generated summaries containing long source quotations, or source snippets, perform a separate copyright/content audit first.

## Direct development dependencies

Current root direct dev dependencies and their upstream license families:

| Package | Current declared version/range | License | Shipping status |
| --- | --- | --- | --- |
| `@playwright/test` | `1.62.1` | Apache-2.0 | test-only; not in Pages output |
| `eslint` | `10.8.0` | MIT | validation-only |
| `html-validate` | `11.6.0` | MIT | validation-only |
| `stylelint` | `17.14.1` | MIT | validation-only |
| `typescript` | `^7.0.2` | Apache-2.0 | typecheck/build tooling only |
| `wrangler` | `^4.118.0` | MIT OR Apache-2.0 | Worker/dev/deploy tooling only |

No license conflict with an MIT-licensed source repository was found for these direct development tools.

### Reproducibility caveat

There is currently **no committed `package-lock.json`**. That is not a license violation, but it means the transitive dependency set can change between installs, especially for the two caret-ranged direct dependencies and their dependency trees. As a result, a future compliance scan cannot reproduce today's exact transitive-license inventory from the repository alone.

Recommended follow-up only if reproducible releases/CI become a priority: commit a lockfile and optionally add a lightweight allowlist-based license scan. Do not add a large license-management framework merely for the current static project.

## External implementation references

The current audit distinguishes **concept/reference use** from **code reuse**.

### Obsidian ecosystem

| Source | Verified status | Current use in Project Map |
| --- | --- | --- |
| Graph Spawn (`tjqscott/obsidian-graph-spawn`) | MIT | Concept/evidence only: initial seeding before live force settling and observed alpha lifecycle. Project Map does not copy its component union-find/ring/disc seeding implementation. |
| Persistent Graph (`Sanqui/obsidian-persistent-graph`) | MIT | Behavior evidence only for live simulation/pinning lifecycle. |
| Node Factor (`CalfMoon/node-factor`) | MIT | Concept/evidence only for connectivity-derived node importance. Project Map uses its own unique-visible-neighbor formula. |
| d3-force | ISC-style permissive license | Behavior/reference only. Project Map does not import or copy d3-force; Spatial Core implements its own bounded pairwise force kernel. |

The repository research notes explicitly record where concepts were adopted and where code was not copied. The current `compactSpawnPoint`, degree weighting, text fade, hover adapter, camera policy, and Spatial Core force code are project-native implementations.

### Label LOD / visualization research

| Source | License/status | Current use |
| --- | --- | --- |
| Sigma.js | MIT | Concept only: screen-space density/label admission patterns. No Sigma dependency or copied label-grid source. |
| MSAGLJS | MIT | Concept only: semantic zoom/rank-first visibility. No tile-pyramid code imported. |
| Cytoscape.js | MIT | Concept only: minimum effective label size. |
| MapLibre GL JS | BSD-3-Clause plus retained upstream notices in MapLibre itself | Architecture/policy reference only. No MapLibre/Mapbox code copied. |
| Stellarium | GPL-2.0 | **Concept only**: field-of-view/importance-controlled label amount. Do not copy Stellarium implementation code into this MIT project without an explicit GPL-compatible licensing decision. |
| GraphMaps / dynamic map-labeling / HCI / AR papers | publications | Research/design evidence only; no source code copied. |

The `docs/semantic-label-lod-survey.md` decision to treat Stellarium as concept-only remains correct and should be preserved.

### Semantic-classification research

- Atomic — MIT — conceptual semantic-unit / embeddings reference.
- sift-kg — MIT — conceptual corpus/schema-discovery reference.
- Microsoft GraphRAG — MIT — architectural/community-organization reference only.
- Other knowledge-graph examples mentioned as `reference only` should remain reference-only unless their exact license is verified before code reuse.

No full external semantic/knowledge-graph implementation is vendored or imported by the current project.

## Obsidian copyright and trademark boundary

Obsidian itself is proprietary software/content owned by Dynalist Inc.; the Obsidian name, logo, and app icon are trademarks according to Obsidian's official brand guidelines.

Current Project Map status:

- uses the textual preset label **`Obsidian-like`** / style id `obsidian`;
- does **not** ship the Obsidian logo, app icon, source code, binaries, or brand assets;
- does not claim API/plugin compatibility or first-party status;
- implements an independent force-directed visualization based on public documentation, open-source plugin observations, papers, and project-native code.

Recommended presentation rule: whenever the preset is described in user-facing legal/about documentation, make it clear that it is an independent approximation and is not affiliated with or endorsed by Dynalist Inc./Obsidian. Do not add Obsidian logos/assets without checking the current brand policy first.

## Notice / attribution decision

At this audit point, a `THIRD_PARTY_NOTICES` file containing full MIT/BSD/ISC texts is **not required by the identified implementation boundary**, because the audited external projects are references/concepts rather than copied substantial source portions, and the npm packages are development tools rather than redistributed runtime code.

If future work copies or adapts a substantial source portion from MIT/BSD/ISC code, preserve the source copyright/license notice and add a concise `THIRD_PARTY_NOTICES` entry. If future work imports GPL code, stop and make an explicit project-wide compatibility decision before merge.

Research citations/credits should remain even where legally optional; they improve provenance and make later license audits much easier.

## Current risk classification

- **No identified copyleft contamination in shipped code.**
- **No identified bundled third-party runtime library.**
- **No identified redistribution of raw README excerpts in generated graph output.**
- **No current need to relicense the repository away from MIT.**
- **Low trademark risk**, provided `Obsidian-like` remains clearly descriptive/non-affiliated and no protected brand assets are used.
- **One metadata/ownership item to confirm:** whether `SYUN` is the intended copyright-holder text.
- **One reproducibility weakness:** no committed dependency lockfile, so exact transitive licenses are not frozen.

## Future merge rule

For every external implementation considered for direct reuse:

1. verify the exact repository/ref and license before copying code;
2. record whether reuse is `dependency`, `copied/adapted code`, or `concept only`;
3. preserve required notices for copied permissive code;
4. reject or isolate copyleft/source-available code unless compatibility is intentionally accepted;
5. preserve the current rule that bounded source text used for classification is not automatically republished;
6. prefer project-native reimplementation when the useful idea is small and doing so avoids unnecessary dependency/notice complexity.
