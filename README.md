# GitHub Project Galaxy API

Turn a GitHub user's public repositories into a living project galaxy with:

- an embeddable SVG preview
- structured graph JSON
- an interactive map with pan, zoom, drag, and repository links

This repository supports two deployment modes:

1. **GitHub Actions + GitHub Pages** — GitHub-only static generation, with no external server required.
2. **Cloudflare Worker** — the existing request-time API for arbitrary usernames.

## GitHub Actions + GitHub Pages

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

GitHub Pages is static hosting, so these API files are generated when the workflow runs rather than at request time.

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

You can also publish explicit users:

```json
{
  "usernames": ["nekomario28", "syun88"],
  "maxRepos": 100,
  "includeForks": true,
  "includeArchived": false,
  "width": 740,
  "height": 420
}
```

### Enable Pages

Open:

**Settings → Pages → Build and deployment → Source → GitHub Actions**

Then run:

**Actions → Build and deploy project galaxy → Run workflow**

The workflow also refreshes the generated map twice per day.

### Published URLs

For a repository named `interactive-project-map` owned by `USERNAME`:

```text
https://USERNAME.github.io/interactive-project-map/api/users/USERNAME/graph.json
https://USERNAME.github.io/interactive-project-map/api/users/USERNAME/galaxy-dark.svg
https://USERNAME.github.io/interactive-project-map/api/users/USERNAME/galaxy-light.svg
https://USERNAME.github.io/interactive-project-map/u/USERNAME/
```

### Profile README embed

```html
<h2 align="center">Interactive Project Map</h2>

<p align="center">
  <sub>Public projects arranged as a living galaxy.</sub>
</p>

<p align="center">
  <a href="https://USERNAME.github.io/interactive-project-map/u/USERNAME/">
    <img
      width="740"
      src="https://USERNAME.github.io/interactive-project-map/api/users/USERNAME/galaxy-dark.svg"
      alt="Galaxy map of public GitHub projects"
    >
  </a>
</p>

<p align="center">
  <a href="https://USERNAME.github.io/interactive-project-map/u/USERNAME/"><strong>Explore the live map ↗</strong></a><br>
  <sub>Select projects · drag nodes · pan · zoom</sub>
</p>
```

### GitHub token

The workflow uses the built-in `github.token` by default. If a separate token is needed, create a repository Actions secret named:

```text
PROJECT_MAP_GITHUB_TOKEN
```

The workflow automatically prefers that secret when present.

### Local Pages build

```bash
npm run check:pages
GITHUB_REPOSITORY_OWNER=nekomario28 npm run build:pages
```

Output is written to `site/`.

## Cloudflare Worker

The request-time API remains available:

```bash
npm install
npm run dev
```

Endpoints:

```text
GET /api/galaxy.svg?username=USERNAME
GET /api/graph?username=USERNAME
GET /u/USERNAME
```

Deploy with:

```bash
npx wrangler login
npm run deploy
```

For production Worker usage, configure a GitHub token with:

```bash
npx wrangler secret put GITHUB_TOKEN
```

## Repository grouping

Repositories are grouped using deterministic rules based on repository names, descriptions, topics, and primary language. Built-in semantic groups include:

- Robotics / ROS 2
- AI / Machine Learning
- Minecraft Modding
- Hardware / Embedded
- Web / Apps
- Coursework / Learning

Repositories that do not match a semantic group fall back to a primary-language group such as `Python Projects` or `Rust Projects`.

## License

MIT
