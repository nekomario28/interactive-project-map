# GitHub Project Galaxy

Turn a GitHub user's public repositories into a living project galaxy with:

- an embeddable SVG preview for GitHub README files
- structured graph JSON
- an interactive map with pan, zoom, drag, and repository links
- a zero-setup hosted generator that creates copy-ready embed code from a username

## Recommended: one hosted service

The Cloudflare Worker is the recommended public deployment. Deploy it once and any user can generate a project map without forking this repository, enabling GitHub Pages, installing npm packages, or providing their own GitHub token.

After deployment, open the Worker root URL and enter a public GitHub username. The generator provides:

- a live SVG preview
- an interactive map URL
- a copy-ready HTML snippet for a GitHub profile README
- a Markdown embed
- direct SVG and graph JSON URLs

Example public endpoints:

```text
GET /api/galaxy.svg?username=USERNAME
GET /api/graph?username=USERNAME
GET /u/USERNAME
```

A README can use the hosted service directly:

```html
<p align="center">
  <a href="https://YOUR_DOMAIN/u/YOUR_USERNAME">
    <img
      width="740"
      src="https://YOUR_DOMAIN/api/galaxy.svg?username=YOUR_USERNAME&amp;theme=dark"
      alt="YOUR_USERNAME project galaxy"
    >
  </a>
</p>
```

### Hosted-service safeguards

The public Worker does not expose its GitHub token to clients. Repository data is fetched server-side.

To avoid turning every image request into a GitHub API request, normalized graph data is cached for 15 minutes using the Cloudflare Workers Cache API. The graph cache key contains only:

```text
username
max_repos
forks
archived
```

SVG-only options such as `theme`, `width`, and `height` reuse the same graph cache entry.

The Worker also configures three Cloudflare Rate Limiting bindings:

- `API_RATE_LIMITER` — limits total graph/SVG generation requests per client IP
- `UPSTREAM_RATE_LIMITER` — limits uncached GitHub lookups per client IP
- `GLOBAL_UPSTREAM_RATE_LIMITER` — places a coarse per-location ceiling on GitHub upstream lookups

Rate-limit bindings are intentionally optional in the TypeScript environment so local/unit tooling can run without them, while the supplied `wrangler.jsonc` enables them for normal deployment.

> Cloudflare's Cache API cache is data-center-local rather than globally replicated. This is a low-setup v1 protection layer, not a globally consistent database. If traffic grows substantially, move repository metadata caching to a shared storage layer such as Workers KV or a Durable Object.

### Deploy the hosted service

Use Node.js 22.18 or newer (the GitHub workflows use Node.js 24).

```bash
npm install
npm run verify
npx wrangler login
npm run deploy
```

For production use, configure a GitHub token as a Worker secret:

```bash
npx wrangler secret put GITHUB_TOKEN
```

The service also works without a token for light public-data use, but GitHub's unauthenticated REST quota is much lower.

## Optional: self-host with GitHub Actions + GitHub Pages

GitHub Pages remains available for users who prefer a static copy under their own account.

The workflow in `.github/workflows/deploy-pages.yml` fetches repository metadata, builds the graph, renders dark/light SVG previews, generates the interactive viewer, and deploys the result to GitHub Pages.

```text
GitHub Actions
    ↓
GitHub REST API
    ↓
site/api/users/<username>/graph.json
site/api/users/<username>/galaxy-dark.svg
site/api/users/<username>/galaxy-light.svg
site/u/<username>/index.html
    ↓
GitHub Pages
```

GitHub Pages is static hosting, so these files are generated when the workflow runs rather than at request time.

### Configure users

Edit `config/project-map.json`:

```json
{
  "usernames": ["@owner"],
  "maxRepos": 100,
  "includeForks": true,
  "includeArchived": false,
  "width": 740,
  "height": 420
}
```

`@owner` resolves to the repository owner from `GITHUB_REPOSITORY_OWNER`, so forks can work without changing the config.

### Enable Pages

For the static Pages mode only, open:

**Settings → Pages → Build and deployment → Source → GitHub Actions**

Then run:

**Actions → Build and deploy project galaxy → Run workflow**

The workflow also refreshes the generated map twice per day.

### GitHub Actions token

The Pages workflow uses the built-in `github.token` by default. If a separate token is needed, create a repository Actions secret named:

```text
PROJECT_MAP_GITHUB_TOKEN
```

### Local Pages build

```bash
npm run check:pages
GITHUB_REPOSITORY_OWNER=nekomario28 npm run build:pages
```

Output is written to `site/`.

## Query parameters

`GET /api/graph` supports:

| Parameter | Default | Range / values |
|---|---:|---|
| `username` | required | valid public GitHub username |
| `max_repos` | `100` | `1`–`300` |
| `forks` | `true` | boolean |
| `archived` | `false` | boolean |

`GET /api/galaxy.svg` supports the same graph parameters plus:

| Parameter | Default | Range / values |
|---|---:|---|
| `theme` | `dark` | `dark`, `light` |
| `width` | `740` | `420`–`1600` |
| `height` | `420` | `260`–`1000` |

## Repository grouping

Repositories are grouped using deterministic rules based on repository names, descriptions, topics, and primary language. Built-in semantic groups include:

- Robotics / ROS 2
- AI / Machine Learning
- Minecraft Modding
- Hardware / Embedded
- Web / Apps
- Coursework / Learning

Repositories that do not match a semantic group fall back to a primary-language group such as `Python Projects`, `Rust Projects`, `C++ Projects`, or `C# Projects`.

## Verification

```bash
npm run verify
```

This runs TypeScript type checking, a Wrangler Worker dry-run (including binding/config validation), Pages script syntax validation, and regression tests.

## License

MIT
