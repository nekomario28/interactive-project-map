# GitHub Project Galaxy

Turn a GitHub user's public repositories into a reusable project map with:

- a static SVG for GitHub profile READMEs
- user-owned static `project-map/graph.json`
- interactive GitHub Pages viewers with search, details, pan, zoom, pinch, and repository links
- **12 visual presets**: Radial Tree, Galaxy Classic, Galaxy Systems, Galaxy Hybrid, Obsidian-like, Tree, Treemap, Timeline, Cluster / Bubble, Sunburst, Matrix / Heatmap, and Sankey
- visual example cards in the public generator before setup generation
- explicit Original / Fork / Archived semantics
- a static-first architecture with no shared GitHub REST request during normal viewing

## Architecture

```text
https://nekomario28.github.io/interactive-project-map/
        ↓ generate setup
USERNAME/USERNAME profile repository
        ↓ scheduled GitHub Action
project-map/galaxy.svg
project-map/graph.json
        ↓
GitHub profile README ──click──> github.io viewer
                                  ↓
                    raw.githubusercontent.com
                                  ↓
              USERNAME/USERNAME/HEAD/project-map/graph.json
```

The REST API is used when the user's Action refreshes repository metadata. README views and interactive-map views consume the generated static files instead.

## Presets

`radial` remains the default for workflows that omit `style`. The former explicit `style=galaxy` value is retained as a compatibility alias and normalizes to `galaxy-systems`; it is intentionally not shown as a thirteenth preset.

| Style | Viewer | Best use |
|---|---|---|
| `radial` | `/radial/?username=USER&style=radial` | compact profile README / general default |
| `galaxy-classic` | `/u/?username=USER&style=galaxy-classic` | original one-galaxy atmosphere and global motion |
| `galaxy-systems` | `/u/?username=USER&style=galaxy-systems` | clearest category → repository spatial membership |
| `galaxy-hybrid` | `/u/?username=USER&style=galaxy-hybrid` | spiral-galaxy atmosphere plus readable local category systems |
| `obsidian` | `/u/?username=USER&style=obsidian` | organic force-directed exploration |
| `tree` | `/tree/?username=USER&style=tree` | explicit Owner → Category → Repository hierarchy |
| `treemap` | `/treemap/?username=USER&style=treemap` | dense portfolio composition and relative emphasis |
| `timeline` | `/timeline/?username=USER&style=timeline` | repository creation history by category |
| `cluster` | `/cluster/?username=USER&style=cluster` | category concentration in large repository sets |
| `sunburst` | `/sunburst/?username=USER&style=sunburst` | compact proportional hierarchy |
| `matrix` | `/matrix/?username=USER&style=matrix` | Category × Language technical composition |
| `sankey` | `/sankey/?username=USER&style=sankey` | Owner → Category → Original/Fork/Archived flow |

### Radial Tree (Classic)

Owner is centered, categories occupy the middle ring, and repositories sit around the outside. It is deliberately compact at the default 740×420 profile size.

### Galaxy Classic

Preserves the pre-Galaxy-Systems Living Galaxy behavior: one global galaxy, differential repository motion, spiral atmosphere, and category positions derived from the moving portfolio. It is intentionally kept as an independent runtime so later Systems/Hybrid tuning cannot silently change the original presentation.

The static Classic SVG is non-animated and uses the original bounded Galaxy renderer.

### Galaxy Systems

The owner is the center of the map. Categories form local systems and orbit the owner extremely slowly; repositories orbit only their own category. Category membership is therefore readable from position without following a permanent spoke network.

Interactive timing is deliberately calm:

- category orbit: about **30 minutes per revolution**
- repository lane 0: **6 minutes per revolution**
- each additional lane: **+3 minutes**
- all repositories inside one category use the same hashed direction

Owner → Category and Category → Repository edges are hidden when nothing is focused. Selecting or hovering a repository reveals its explanatory `Owner → Category → Repository` path; category selection reveals that category's ownership/membership edges. Repository relation edges remain faintly visible without focus.

For static SVGs with at most 80 repositories, the same hierarchy uses script-free declarative SVG animation. Renderers that ignore SVG animation still receive a correct initial frame. Above 80 repositories it automatically uses the bounded non-animated dense fallback.

### Galaxy Hybrid

Combines the two ideas rather than replacing either one. Categories occupy one, two, or three spiral arms depending on category count, so the portfolio still reads as one galaxy. Each category remains a local system whose repositories follow elliptical orbits aligned with the arm.

Interactive timing:

- whole spiral/category structure: about **40 minutes per revolution**
- local repository lane 0: **8 minutes per revolution**
- each additional lane: **+4 minutes**

Hybrid uses the same focus-only ownership/membership edge policy as Systems and adds nucleus glow, spiral dust, category halos, and elliptical lane guides. Static Hybrid SVG animation is likewise script-free for up to 80 repositories and falls back to the bounded dense renderer above that limit.

### Obsidian-like

A deterministic force-directed graph using the original global center / repel / link physics. It prioritizes exploratory relationships over strict hierarchy and remains physically independent from all Galaxy runtimes.

This is an independently implemented approximation and is not affiliated with or endorsed by Obsidian or Dynalist Inc. Obsidian is a trademark of Dynalist Inc.

### Tree

An explicit top-down `Owner → Category → Repository` hierarchy. Subtree-size allocation and wrapping make structural relationships immediately visible.

### Treemap

Each category receives a region containing repository tiles. Stars have only a weak influence on tile area so one popular repository cannot dominate the complete portfolio. Small tiles suppress labels rather than overlap them.

### Timeline

Repositories are positioned on category lanes using GitHub creation time. `graph.json` stores `createdAt` in addition to `updatedAt`; older graph files fall back to `updatedAt` until regenerated.

### Cluster / Bubble

Each category forms a large boundary containing its repositories. This is aimed at large 100–300 repository profiles where domain concentration matters more than explicit edges.

### Sunburst

A concentric `Owner → Category → Repository` hierarchy using proportional sectors. Narrow outer sectors suppress repository labels. Dense category labels can still be less readable than Tree or Radial, which is an intentional tradeoff of the compact circular form.

### Matrix / Heatmap

Rows are categories and columns are the most-used languages. Cell intensity represents repository count; the small status bar inside each populated cell shows Original / Fork / Archived composition.

### Sankey

A flow diagram from Owner to Category to repository status. Band widths preserve repository counts, making it easy to compare where work is concentrated and how much is Original, Forked, or Archived.

All presets preserve the same status colors. Archived repositories receive an additional dashed treatment where the visualization renders individual repository marks.

## Installation

Open the public generator:

```text
https://nekomario28.github.io/interactive-project-map/
```

Enter a GitHub username, compare the preset cards, choose theme/style/repository filters, then copy the generated workflow into the user's profile repository:

```text
USERNAME/USERNAME/.github/workflows/project-map.yml
```

The generated workflow intentionally isolates permissions:

```text
generate
  contents: read
  interactive-project-map Action
       ↓ artifact
publish
  actions: read
  contents: write
  pinned GitHub-maintained Actions + git commit/push
```

The custom project-map Action never receives a write-capable token. The public generator pins it to a reviewed immutable commit SHA.

Run **Update project map** once. It creates:

```text
project-map/
├── galaxy.svg
└── graph.json
```

`galaxy.svg` is kept as the filename for backward compatibility regardless of the chosen preset.

## Static viewer validation

Every dedicated viewer reads:

```text
https://raw.githubusercontent.com/USERNAME/USERNAME/HEAD/project-map/graph.json
```

and validates the graph before rendering. In particular:

- the requested username must be valid
- graph owner must match that username
- repository URLs must remain under `https://github.com/USERNAME/REPO`
- labels, topics, node counts, and edge counts are bounded
- malformed nodes/URLs and unknown edges are discarded

If the graph is missing or invalid, the viewer shows a setup/recovery message instead of consuming a shared API quota.

## Action inputs

| Input | Default | Meaning |
|---|---:|---|
| `github_token` | required | token used to read public repository metadata |
| `username` | caller owner | GitHub user to visualize |
| `theme` | `dark` | `dark` or `light` static SVG theme |
| `style` | `radial` | one of the 12 visible preset IDs above; legacy `galaxy` aliases to `galaxy-systems` |
| `max_repos` | `100` | `1`–`300` eligible repositories |
| `forks` | `true` | include forks |
| `archived` | `false` | include archived repositories |
| `width` | `740` | SVG width, `420`–`1600` |
| `height` | `420` | SVG height, `260`–`1000` |
| `output_dir` | `project-map` | relative output directory |

## GitHub Pages

For the upstream repository, configure **Settings → Pages → Build and deployment → Source → GitHub Actions** once. The Pages workflow then builds only static frontend files.

Local frontend build:

```bash
npm run build:pages
```

The previous configured multi-user catalog builder remains available for experiments:

```bash
npm run build:pages:catalog
```

## Verification

```bash
npm run verify
```

Verification includes:

- TypeScript type checking
- Wrangler Worker dry-run
- Node 24 syntax checks for the Action, all static renderers, and browser viewers
- HTML-Validate on emitted Pages HTML
- ESLint on emitted browser JavaScript
- Stylelint on emitted CSS
- actionlint on repository workflows and the browser-generated installer workflow
- Galaxy Classic preservation checks
- Galaxy Systems speed, nested-orbit, focus-edge, and SVG fallback checks
- Galaxy Hybrid spiral/elliptical-orbit and SVG fallback checks
- dense 300-repository regression tests across all 12 presets
- Treemap bounds/coverage checks
- Sunburst segment checks
- Matrix aggregation checks
- Sankey flow-total checks
- static graph validation and permission-isolation tests

CI also invokes the local `action.yml` **without a `style` input** and confirms that Radial Tree remains the backward-compatible default. On preset-development PRs it additionally renders all 12 presets from the same current `graph.json` and uploads a visual comparison artifact.

## Optional Cloudflare Worker

The Worker implementation remains available for API/fallback experiments but is not required by the recommended GitHub Pages flow.

## Contributors & credits

### Project contributors

<table>
<tr>
<td align="center" width="180">
<a href="https://github.com/nekomario28"><img src="https://github.com/nekomario28.png?size=96" width="72" alt="@nekomario28"/><br/><sub><b>Yuu / nekomario28</b></sub></a><br/><sub>Maintainer · implementation</sub>
</td>
<td align="center" width="180">
<a href="https://github.com/syun88"><img src="https://github.com/syun88.png?size=96" width="72" alt="@syun88"/><br/><sub><b>SYUN / syun88</b></sub></a><br/><sub>Project contributor</sub>
</td>
</tr>
</table>

GitHub's automatic **Contributors** view remains commit-authorship-driven. The credits below acknowledge projects and people whose public work informed design decisions; they are **not** presented as Git co-authors or bundled dependencies.

<details>
<summary><b>Research & upstream credits</b></summary>

<br/>
<table>
<tr>
<td align="center" valign="top" width="25%"><a href="https://github.com/tjqscott/obsidian-graph-spawn"><img src="https://github.com/tjqscott.png?size=96" width="64" alt="tjqscott"/><br/><sub><b>Graph Spawn</b></sub></a><br/><sub>spawn lifecycle · MIT</sub></td>
<td align="center" valign="top" width="25%"><a href="https://github.com/Sanqui/obsidian-persistent-graph"><img src="https://github.com/Sanqui.png?size=96" width="64" alt="Sanqui"/><br/><sub><b>Persistent Graph</b></sub></a><br/><sub>simulation lifecycle · MIT</sub></td>
<td align="center" valign="top" width="25%"><a href="https://github.com/CalfMoon/node-factor"><img src="https://github.com/CalfMoon.png?size=96" width="64" alt="CalfMoon"/><br/><sub><b>Node Factor</b></sub></a><br/><sub>connectivity sizing · MIT</sub></td>
<td align="center" valign="top" width="25%"><a href="https://github.com/d3/d3-force"><img src="https://github.com/d3.png?size=96" width="64" alt="d3"/><br/><sub><b>d3-force</b></sub></a><br/><sub>force behavior reference · ISC</sub></td>
</tr>
<tr>
<td align="center" valign="top"><a href="https://github.com/jacomyal/sigma.js"><img src="https://github.com/jacomyal.png?size=96" width="64" alt="jacomyal"/><br/><sub><b>Sigma.js</b></sub></a><br/><sub>label density / LOD · MIT</sub></td>
<td align="center" valign="top"><a href="https://github.com/microsoft/msagljs"><img src="https://github.com/microsoft.png?size=96" width="64" alt="Microsoft"/><br/><sub><b>MSAGLJS</b></sub></a><br/><sub>semantic zoom · MIT</sub></td>
<td align="center" valign="top"><a href="https://github.com/cytoscape/cytoscape.js"><img src="https://github.com/cytoscape.png?size=96" width="64" alt="Cytoscape"/><br/><sub><b>Cytoscape.js</b></sub></a><br/><sub>label visibility threshold · MIT</sub></td>
<td align="center" valign="top"><a href="https://github.com/maplibre/maplibre-gl-js"><img src="https://github.com/maplibre.png?size=96" width="64" alt="MapLibre"/><br/><sub><b>MapLibre GL JS</b></sub></a><br/><sub>scale / collision policy · BSD-3-Clause</sub></td>
</tr>
<tr>
<td align="center" valign="top"><a href="https://github.com/Stellarium/stellarium"><img src="https://github.com/Stellarium.png?size=96" width="64" alt="Stellarium"/><br/><sub><b>Stellarium</b></sub></a><br/><sub>FOV label disclosure · GPL-2.0 concept only</sub></td>
<td align="center" valign="top"><a href="https://github.com/kenforthewin/atomic"><img src="https://github.com/kenforthewin.png?size=96" width="64" alt="kenforthewin"/><br/><sub><b>Atomic</b></sub></a><br/><sub>semantic-unit model · MIT</sub></td>
<td align="center" valign="top"><a href="https://github.com/juanceresa/sift-kg"><img src="https://github.com/juanceresa.png?size=96" width="64" alt="juanceresa"/><br/><sub><b>sift-kg</b></sub></a><br/><sub>schema discovery · MIT</sub></td>
<td align="center" valign="top"><a href="https://github.com/microsoft/graphrag"><img src="https://github.com/microsoft.png?size=96" width="64" alt="Microsoft"/><br/><sub><b>GraphRAG</b></sub></a><br/><sub>hierarchical community reference · MIT</sub></td>
</tr>
</table>

Detailed adoption and licensing boundaries are recorded in [`docs/licensing-audit-2026-08-21.md`](docs/licensing-audit-2026-08-21.md) and the corresponding research notes. Reference-only projects are credited here even when attribution is not legally required.

</details>

## License

MIT — copyright held collectively by the `interactive-project-map` contributors.
