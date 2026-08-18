# GitHub Project Galaxy

Turn a GitHub user's public repositories into a project map with:

- a static SVG for GitHub profile READMEs
- static `graph.json` owned by each user
- a shared interactive map with search, details, pan, zoom, drag, pinch, and repository links
- **Galaxy**, **Obsidian-like**, and **Tree** presentation presets
- an on-site visual preset gallery so users can see the layout idea before generating anything
- explicit colors for original repositories, forks, and archived repositories
- label-aware spacing and collision culling so dense maps remain readable
- a zero-backend public generator hosted on GitHub Pages
- an optional Cloudflare Worker API for experiments/fallback use

## Recommended architecture

The public frontend is a **static GitHub Pages application**. Repository metadata is generated inside each user's own profile repository by GitHub Actions.

```text
https://nekomario28.github.io/interactive-project-map/
        ↓ choose style + generate setup
USERNAME/USERNAME profile repository
        ↓ scheduled GitHub Action
project-map/galaxy.svg
project-map/graph.json
        ↓
GitHub profile README ──click──> github.io interactive viewer
                                  ↓
                    raw.githubusercontent.com
                                  ↓
              USERNAME/USERNAME/HEAD/project-map/graph.json
```

Normal README views and normal interactive-map views do **not** call the GitHub REST API. The REST API is used only when the user's scheduled Action refreshes repository metadata.

## Map styles

The generator shows a compact visual example for every preset before setup generation. The same `graph.json` drives every interactive style; only the presentation changes.

### Galaxy

```text
https://nekomario28.github.io/interactive-project-map/u/?username=USERNAME&style=galaxy
```

Galaxy places categories in semantic sectors around one owner-centered map and distributes repositories over multiple radial lanes. Lane capacity is based on estimated label width, and the interactive renderer performs a second screen-space label collision pass while drawing.

### Obsidian-like

```text
https://nekomario28.github.io/interactive-project-map/u/?username=USERNAME&style=obsidian
```

Obsidian-like uses a neutral native-looking dark workspace and a deterministic force-directed layout based on center, repel, link, and collision forces. It is inspired by the interaction model of graph-view tools without copying Obsidian assets or product UI verbatim.

### Tree

```text
https://nekomario28.github.io/interactive-project-map/tree/?username=USERNAME&style=tree
```

Tree makes the hierarchy explicit:

```text
Owner
├── Category A
│   ├── Repository
│   ├── Repository
│   └── Repository
├── Category B
│   ├── Repository
│   └── Repository
└── Category C
    └── Repository
```

The static renderer allocates horizontal space by subtree size and wraps repositories into rows when a category is dense. Repository labels still use collision-aware placement, so text is hidden rather than rendered on top of other text when the available SVG area cannot fit every label.

All styles preserve the same semantics:

- **Original** repositories use the primary repository color.
- **Forks** use a distinct fork color.
- **Archived** repositories use a distinct archived color plus an outer dashed ring.
- Owner, category, and relation edges have their own visual roles.

The viewers also provide search, a repository details panel, drag, pan, wheel/pinch zoom, Fit/Reset controls, and keyboard shortcuts (`0`, `+`, `-`, `Enter`, `Esc`). Galaxy and Obsidian-like switch live inside the shared viewer; selecting Tree routes to the dedicated hierarchical viewer, and selecting Galaxy/Obsidian-like there routes back without changing the underlying static data.

## Public URLs

After GitHub Pages is enabled for this repository, the default project-site URL is:

```text
https://nekomario28.github.io/interactive-project-map/
```

Galaxy and Obsidian-like use:

```text
https://nekomario28.github.io/interactive-project-map/u/?username=USERNAME&style=galaxy
https://nekomario28.github.io/interactive-project-map/u/?username=USERNAME&style=obsidian
```

Tree uses:

```text
https://nekomario28.github.io/interactive-project-map/tree/?username=USERNAME&style=tree
```

All routes remain static GitHub Pages pages.

## User installation

### 1. Open the generator

Open:

```text
https://nekomario28.github.io/interactive-project-map/
```

Choose one of the visual preview cards, then enter your GitHub username and configure:

- dark/light static SVG theme
- Galaxy, Obsidian-like, or Tree map style
- maximum repository count
- whether forks are included
- whether archived repositories are included

The page generates a complete GitHub Actions workflow and README embed.

### 2. Add the workflow to your profile repository

For GitHub user `octocat`, the profile repository is:

```text
octocat/octocat
```

Create:

```text
.github/workflows/project-map.yml
```

and paste the workflow generated by the site.

The workflow uses two jobs intentionally:

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

The custom `interactive-project-map` Action never runs with a write-capable token.

The public generator pins the reusable Action to a reviewed full commit SHA rather than a mutable tag. This gives consumers an immutable dependency by default.

### 3. Run the workflow once

Open the profile repository's **Actions** tab and run **Update project map** manually once.

It creates:

```text
project-map/
├── galaxy.svg
└── graph.json
```

`galaxy.svg` is retained as the stable output filename for backward compatibility even when the selected style is Obsidian-like or Tree.

The workflow also runs on a schedule. If repository data did not change, the generator preserves the previous timestamp so no meaningless daily commit is created.

### 4. Add the generated embed to README.md

The generated snippet is equivalent to:

```html
<p align="center">
  <a href="https://nekomario28.github.io/interactive-project-map/u/?username=USERNAME&style=galaxy">
    <img
      width="740"
      src="https://raw.githubusercontent.com/USERNAME/USERNAME/HEAD/project-map/galaxy.svg"
      alt="USERNAME project map"
    >
  </a>
</p>
```

For Tree, the generated link points to `/tree/?username=USERNAME&style=tree` instead. The profile serves the SVG directly from the user's own repository.

## How the static viewer works

The GitHub Pages viewers read:

```text
https://raw.githubusercontent.com/USERNAME/USERNAME/HEAD/project-map/graph.json
```

in the visitor's browser.

Before rendering, the viewer validates/sanitizes the static graph:

- requested username must be a valid GitHub username
- graph owner must match the requested username
- repository nodes must point to `https://github.com/USERNAME/REPO`
- repository names, labels, topics, node counts, and edge counts are bounded
- invalid repository URLs are discarded
- edges referring to unknown nodes are discarded

Repository links therefore remain constrained to the requested user's GitHub repositories.

If `graph.json` is missing or invalid, the static viewer shows an installation/recovery message instead of silently consuming a shared GitHub API quota.

## Action inputs

The root `action.yml` supports:

| Input | Default | Meaning |
|---|---:|---|
| `github_token` | required | token used to read public repository metadata |
| `username` | caller owner | GitHub user to visualize |
| `theme` | `dark` | static SVG theme: `dark` or `light` |
| `style` | `galaxy` | `galaxy`, `obsidian`, or `tree` |
| `max_repos` | `100` | `1`–`300` eligible repositories |
| `forks` | `true` | include forks |
| `archived` | `false` | include archived repositories |
| `width` | `740` | SVG width, `420`–`1600` |
| `height` | `420` | SVG height, `260`–`1000` |
| `output_dir` | `project-map` | relative generated-output directory |

## Deploy the public GitHub Pages frontend

For `nekomario28/interactive-project-map`, enable Pages once:

1. Open **Settings → Pages**.
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. Run **Actions → Build and deploy project galaxy → Run workflow**, or merge a Pages-related change to `main`.

The upstream repository deploys Pages automatically. Forks remain opt-in: a fork can set repository variable `ENABLE_GITHUB_PAGES=true` after enabling GitHub Pages.

The Pages workflow builds only static files:

```text
site/
├── .nojekyll
├── index.html
├── app.js
├── presets.css
├── viewer.js
├── tree-router.js
├── tree-viewer.js
├── viewer.css
├── u/
│   └── index.html
└── tree/
    └── index.html
```

There is no scheduled central repository-data rebuild anymore; user data is refreshed by each user's own profile-repository Action.

Local build:

```bash
npm run build:pages
```

The previous configured multi-user static catalog builder remains available for experiments:

```bash
npm run build:pages:catalog
```

## Optional Cloudflare Worker

The Worker implementation remains in the repository for API/fallback experimentation:

```text
GET /api/galaxy.svg?username=USERNAME
GET /api/graph?username=USERNAME
GET /u/USERNAME
```

It is **not required** for the recommended GitHub Pages flow.

For local Worker development:

```bash
npm install
npm run verify
npx wrangler dev
```

For deployment:

```bash
npx wrangler login
npx wrangler secret put GITHUB_TOKEN
npm run deploy
```

## Verification

```bash
npm run verify
```

Verification includes:

- TypeScript type checking
- Wrangler Worker dry-run
- Node 24 Action and Tree SVG syntax checks
- Pages generator/viewer/tree-viewer syntax checks
- HTML-Validate on emitted HTML
- ESLint on emitted browser JavaScript
- Stylelint on emitted CSS, including the preset gallery
- actionlint on repository workflows and the workflow generated by the browser installer
- dense SVG label-overlap tests for Galaxy, Obsidian-like, and Tree styles
- repository grouping/query/pagination tests
- static Action generation tests
- install-workflow permission tests
- static graph validation tests

The repository CI also invokes the local `action.yml` with `contents:read`, requests the Tree preset against real public repository metadata, and verifies that a real Tree SVG and graph JSON are generated.

## License

MIT
