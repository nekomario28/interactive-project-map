# GitHub Project Galaxy

Turn a GitHub user's public repositories into a reusable project map with:

- a static SVG for GitHub profile READMEs
- user-owned static `project-map/graph.json`
- interactive GitHub Pages viewers with search, details, pan, zoom, pinch, and repository links
- **10 visual presets**: Radial Tree, Galaxy, Obsidian-like, Tree, Treemap, Timeline, Cluster / Bubble, Sunburst, Matrix / Heatmap, and Sankey
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

`radial` remains the default for backward compatibility. Existing workflows that omit `style` therefore retain the classic presentation.

| Style | Viewer | Best use |
|---|---|---|
| `radial` | `/radial/?username=USER&style=radial` | compact profile README / general default |
| `galaxy` | `/u/?username=USER&style=galaxy` | spatial portfolio exploration |
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

### Galaxy

Categories occupy semantic sectors with repositories distributed over radial lanes. Label-aware lane placement and screen-space collision culling keep the map readable.

### Obsidian-like

A deterministic force-directed graph using center, repel, link, and collision forces. It prioritizes exploratory relationships over strict hierarchy.

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
| `style` | `radial` | one of the 10 preset IDs above |
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
- dense label-overlap regression tests for node-based layouts
- Treemap bounds/coverage checks
- Sunburst segment checks
- Matrix aggregation checks
- Sankey flow-total checks
- Action tests for all 10 style values
- static graph validation and permission-isolation tests

CI also invokes the local `action.yml` **without a `style` input** and confirms that Radial Tree remains the backward-compatible default. On preset-development PRs it additionally renders all ten presets from the same current `graph.json` and uploads a visual comparison artifact.

## Optional Cloudflare Worker

The Worker implementation remains available for API/fallback experiments but is not required by the recommended GitHub Pages flow.

## License

MIT
