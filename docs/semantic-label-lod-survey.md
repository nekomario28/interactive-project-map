# Semantic label LOD / decluttering survey

Status: research only. This document does **not** change production rendering.

## Problem

The current Galaxy Systems / Galaxy Hybrid adaptive-label runtime improved label placement and category hierarchy, but its objective is still close to “place as many collision-free labels as the screen budget permits.” In particular, the current repository budget has a floor of 12 ordinary repository labels, so a distant overview can remain text-heavy even when the intended visual is the graph / galaxy itself.

The revised design goal is different:

> Preserve the overview as a visual object first; disclose text only when the current scale, focus, and screen-space density justify it.

This survey looks outside graph rendering as well: cartography, astronomy, classic zoomable UIs, dynamic map labeling, augmented-reality view management, and current open-source graph renderers.

## Findings

### 1. Large-graph browsing: semantic zoom is a first-class layer, not a collision afterthought

**GraphMaps (Microsoft Research, 2015)** builds a sequence of layers and selects a layer by zoom. It caps the number of rendered entities per view while preserving stable geometry. This is almost exactly the desired interaction contract: the layout does not jump, but information density changes with scale.

- Paper: https://www.microsoft.com/en-us/research/publication/graphmaps-browsing-large-graphs-interactive-maps/
- arXiv: https://arxiv.org/abs/1506.06745

**A New Approach to GraphMaps (2017)** explicitly tries to minimize the change in the number of visible nodes between adjacent zoom levels, because abrupt LOD changes hurt browsing continuity.

- https://arxiv.org/abs/1705.05479

**Browsing Large Graphs with Tile Pyramids and Sleeve Routing in the Browser (Microsoft Research, 2026)** is especially relevant because it is recent, browser-side, and implemented in open-source TypeScript. It keeps labels of the highest-ranked nodes readable at each zoom level in a tile pyramid, analogous to major place names on geographic maps.

- Paper: https://www.microsoft.com/en-us/research/publication/browsing-large-graphs-with-tile-pyramids-and-sleeve-routing-in-the-browser/
- arXiv: https://arxiv.org/abs/2605.17498
- implementation: https://github.com/microsoft/msagljs
- license: MIT

The current MSAGLJS `TileMap` ranks nodes (PageRank), builds multiple levels, and at coarse levels accepts only higher-ranked nodes whose scaled boxes do not overlap already accepted higher-ranked nodes. This is useful as a reference implementation, but a full tile pyramid is unnecessary for the current portfolio-sized Galaxy renderer.

### 2. Current graph renderers: screen-space thresholds + density grids are mature practice

**Sigma.js** uses several complementary controls rather than maximizing label count:

- `labelRenderedSizeThreshold`: do not label nodes whose rendered screen size is too small.
- `labelDensity`: global density control.
- `labelGridCellSize`: divides the screen into cells and chooses only a limited number of labels per cell.
- `hideLabelsOnMove`: temporarily hides labels while camera movement is active.

Its actual `LabelGrid` implementation is deterministic: candidates within each screen cell are ranked, and the allowed number of labels per cell changes with camera ratio / density. This is a particularly good pattern to adapt because it is small, deterministic, and screen-space based.

- repo: https://github.com/jacomyal/sigma.js
- settings: https://v4.sigmajs.org/reference/settings/
- label heuristic: `packages/sigma/src/core/labels.ts`
- license: MIT

**Cytoscape.js** has `min-zoomed-font-size`: if the effective font size falls below the configured threshold, the label is not drawn. This directly supports the idea that distant repository labels should simply be absent.

- https://js.cytoscape.org/
- license: MIT

### 3. Cartography: zoom ranges, priority, collision, and progressive disclosure are separate concerns

**MapLibre GL JS** gives symbol layers explicit zoom ranges and separates them from collision / priority:

- layers can have `minzoom` / `maxzoom`;
- `text-allow-overlap` defaults to false;
- `symbol-sort-key` controls which labels win placement conflicts;
- map guidance recommends showing the appropriate level of detail for the current zoom instead of attempting to render everything at low zoom.

This is a useful architecture lesson: **eligibility by scale** should happen before **collision placement**. The current Galaxy runtime mostly does collision / budget without a true low-zoom eligibility gate for ordinary repository labels.

- style specification: https://maplibre.org/maplibre-style-spec/layers/
- performance / zoom guidance: https://maplibre.org/maplibre-gl-js/docs/guides/large-data/
- license: BSD-3-Clause

Do not backport code from post-1.13 proprietary Mapbox GL JS. If code is ever reused, use only MapLibre / explicitly BSD-covered sources and retain the required notices. For this project, concept-level reuse is sufficient.

### 4. Astronomy: the closest visual analogy to Galaxy

**Stellarium** treats labels as an amount that depends on field of view and object magnitude. Its documentation explicitly says that more labels appear as the user zooms in. Star labels and markers can also be independently controlled, and a magnitude limit can prevent the automatic addition of fainter stars.

This is an unusually strong analogy for this project:

- category / owner = bright stars / major landmarks;
- high-priority repository = brighter star;
- ordinary repository = fainter star;
- field of view / zoom controls how many names are allowed.

The important lesson is not Stellarium's implementation code, but its perceptual policy: **preserve the sky first; add names according to FOV and importance**.

- user guide: https://stellarium.org/guide/
- `StarMgr::setLabelsAmount`: https://stellarium.org/doc/24.0/classStarMgr.html
- license: GPL-2.0; treat as concept-only unless a GPL-compatible code decision is intentionally made.

### 5. Classic zoomable-interface research: overview should be intentionally sparse

Several older HCI results point in the same direction.

**Furnas, Generalized Fisheye Views (1986)** starts from the observation that people represent their local neighborhood in detail but retain only major landmarks farther away. That is exactly the desired distinction between focused repository labels and distant context.

- DOI: 10.1145/22627.22342

**Pad++ (1994 onward)** treats zoom as a change in representation, not merely magnification. Details are naturally revealed by taking a closer look; multiscale rendering and smooth zoom are fundamental.

- https://www.cs.umd.edu/projects/hcil/pad%2B%2B/papers/

**Shneiderman, The Eyes Have It (1996)** gives the classic information-seeking sequence: overview first, zoom/filter, details on demand.

- https://www.cs.umd.edu/users/ben/papers/Shneiderman1996eyes.pdf

**Woodruff, Landay, Stonebraker, Constant Information Density in Zoomable Interfaces (AVI 1998)** argues for controlling information density across scale; their study suggests users avoid higher-density displays. This is the most direct theoretical objection to a label algorithm whose main success metric is “how many labels can fit.”

- https://dsf.berkeley.edu/papers/avi98-density.pdf

### 6. Dynamic map labeling: avoid popping by giving labels stable active ranges

**Been, Daiches, Yap, Dynamic Map Labeling (2006)** treats continuous pan/zoom labeling as filtering + selection + placement, and calls out label popping as a navigation problem.

- DOI: 10.1109/TVCG.2006.136
- https://pubmed.ncbi.nlm.nih.gov/17080799/

**Been et al., Optimizing Active Ranges for Consistent Dynamic Map Labeling (2008/2010)** models each label as visible over one continuous interval of scales. This is a strong basis for avoiding a label rapidly appearing/disappearing around a threshold.

- conference DOI: 10.1145/1377676.1377681
- journal DOI: 10.1016/j.comgeo.2009.03.006

A practical renderer does not need to solve the NP-hard optimization exactly. A small hysteresis band / stable active range around each semantic LOD boundary is enough to obtain most of the perceptual benefit.

### 7. AR / HUD view management: filtering comes before placement

Augmented-reality view-management literature makes an important distinction that is easy to miss in graph label placement: even a perfect non-overlap solver can produce a cluttered view if too much information is admitted. AR systems therefore use **information filtering / prioritization first**, then placement / overlap management.

Representative sources:

- Feiner et al., UI management for mobile AR: information filtering selects relevant content before view management lays it out.
- Grasset et al., image-driven view management: label clutter can obscure important underlying visual content.
- Iwai et al. / later spatial-AR work: visibility and mental workload matter, not merely geometric non-overlap.

This supports changing the Galaxy objective from “find another anchor if there is space” to “first decide whether this label deserves to exist at this scale.”

## Reuse / license matrix

| Source | Useful mechanism | License / status | Recommended use |
| --- | --- | --- | --- |
| Sigma.js | screen grid, density culling, rendered-size threshold, hide-on-move | MIT | Strong candidate for a small native adaptation; copying with MIT notice is also possible, but a clean reimplementation is trivial |
| MSAGLJS | semantic zoom levels, rank-first coarse-node selection, non-overlap | MIT | Reuse algorithmic ideas; avoid importing full tile-pyramid machinery unless graph scale grows substantially |
| Cytoscape.js | minimum effective label size | MIT | Reimplement the simple policy natively |
| MapLibre GL JS | min/max zoom eligibility, sort-key priority, collision stage | BSD-3-Clause | Architecture/policy reference; no dependency needed |
| Stellarium | FOV + magnitude controlled label amount | GPL-2.0 | Concept-only; do not copy code into the MIT project without an explicit licensing decision |
| GraphMaps papers | layer-based semantic zoom with stable geometry | paper | Design basis, not code |
| Dynamic map-labeling papers | active ranges / anti-popping | paper | Design basis for hysteresis / transition bands |
| AR view-management papers | relevance filtering before geometric placement | paper | Design basis |

## Why the current policy still becomes cluttered

The current adaptive renderer already does several good things: measured text width, four candidate anchors, category-first priority, viewport-aware density, search / selection forcing, and no layout mutation.

The remaining mismatch is the **admission policy**:

1. ordinary repository labels have no true far-view “off” state;
2. the repository budget has a minimum floor, so even a distant overview attempts to show a nontrivial number of repository labels;
3. the renderer optimizes placement after admission, so extra free space tends to become extra text;
4. visibility does not yet have persistent scale intervals / hysteresis, so adding a hard cutoff naively could create popping.

The next change should keep the existing placement engine but put a semantic-LOD admission layer in front of it.

## Recommended design: Galaxy semantic label LOD

Preferred policy combines GraphMaps/MSAGLJS semantic zoom, Sigma screen-density culling, Cytoscape screen-size thresholds, Stellarium FOV/importance behavior, and dynamic-map active ranges.

### LOD 0 — overview / constellation view

- **ordinary repository labels: OFF**
- owner: visible
- categories: visible, but limited to category titles (Systems count can remain secondary)
- selected / hovered / direct-search repository: always allowed as an exception
- graph geometry, stars/nodes, orbits, edges, color remain fully visible

This is the state that restores the intended Galaxy appearance.

### LOD 1 — category exploration

- categories remain visible
- ordinary repository labels still mostly off
- selected / hovered / direct-search repository always visible
- optionally allow only one or a few highest-priority repository landmarks per category if their screen-space size is large enough

### LOD 2 — local exploration

- admit repository labels only when their rendered node size / effective font size crosses a screen-space threshold
- select labels using a Sigma-like screen grid, not one global count
- rank by interaction state first, then stable repository importance
- collision / four-anchor placement runs only after admission

### LOD 3 — close detail

- raise the density budget smoothly
- still perform collision checks; “close” does not imply “draw every label on top of each other”

### During camera motion

Adopt the Sigma pattern in a softer form:

- while panning / zoom animation is active, fade ordinary repository labels strongly or fully out;
- keep owner/category and selected/search labels visible;
- restore after a short idle interval.

This preserves the visual motion of the galaxy and also reduces transient collision work.

### Transitions / anti-popping

Do **not** switch all labels at one raw zoom number.

- derive LOD primarily from screen-space node size / effective text size and viewport density;
- use a small hysteresis band so entering and leaving a level use slightly different thresholds;
- use a short opacity fade for labels entering/leaving;
- once an ordinary label becomes eligible, keep its active range monotone during a simple zoom-in where possible.

This follows the dynamic-map-labeling principle without implementing the full active-range optimization problem.

## Proposed comparison gate before production merge

Build a text-only experiment on the current geometry and capture the same real graph / viewport at several scales. Compare:

1. **Current adaptive** — baseline after PR #68.
2. **Hard far-off** — repository labels exactly zero in overview; forced focus labels only.
3. **Semantic LOD** — overview off, category stage, then screen-grid repository disclosure with fade/hysteresis.
4. **Semantic LOD + motion suppression** — #3 plus ordinary repository labels fade while camera moves.

For each candidate record:

- exact node geometry hash before/after (must match);
- ordinary repository labels visible at overview;
- category labels visible at overview;
- selected/search-hit label visibility;
- labels per 100k screen pixels;
- maximum occupied text-area ratio;
- number of label visibility changes during a fixed zoom sweep (proxy for popping);
- screenshots at overview, mid zoom, close zoom, and search focus.

The primary visual gate should be **overview purity**, not maximum label count.

## Decision

**Do not continue increasing label density or improving anchor packing as the primary solution.**

The evidence across graph visualization, cartography, astronomy, classic zoomable UIs, dynamic labeling, and AR view management converges on the same policy:

> At distant scale, text should be intentionally absent except for structural landmarks and explicit focus. More detail should be progressively disclosed as the user zooms or asks for it.

Recommended next implementation experiment: **Semantic LOD + screen-grid density + forced focus labels + hysteresis/fade**, with a separate optional motion-suppression variant. No layout changes.