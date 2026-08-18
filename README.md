# GitHub Project Galaxy API

Turn a GitHub user's public repositories into a living project galaxy that can be embedded directly in a GitHub profile README.

The service exposes three surfaces:

- `GET /api/galaxy.svg?username=...` — embeddable SVG preview for README files.
- `GET /api/graph?username=...` — JSON graph with owner, category, repository nodes and edges.
- `GET /u/<username>` — interactive canvas viewer with pan, zoom, drag, and repository links.

This repository is an independent implementation intended to make the project-map pattern reusable as a public API.

## Quick start

```bash
npm install
npm run dev
```

Then open:

```text
http://localhost:8787/u/syun88
http://localhost:8787/api/galaxy.svg?username=syun88&theme=dark
http://localhost:8787/api/graph?username=syun88
```

## README embed

After deployment, users can add this directly to their GitHub profile README:

```html
<h2 align="center">Interactive Project Map</h2>

<p align="center">
  <sub>Public projects arranged as a living galaxy.</sub>
</p>

<p align="center">
  <a href="https://YOUR_DOMAIN/u/YOUR_USERNAME">
    <img
      width="740"
      src="https://YOUR_DOMAIN/api/galaxy.svg?username=YOUR_USERNAME&theme=dark"
      alt="Galaxy map of public GitHub projects"
    >
  </a>
</p>

<p align="center">
  <a href="https://YOUR_DOMAIN/u/YOUR_USERNAME"><strong>Explore the live map ↗</strong></a><br>
  <sub>Select projects · drag nodes · pan · zoom</sub>
</p>
```

## API

### `GET /api/galaxy.svg`

Query parameters:

| Parameter | Default | Description |
|---|---:|---|
| `username` | required | GitHub username |
| `theme` | `dark` | `dark` or `light` |
| `width` | `740` | SVG width, 420–1600 |
| `height` | `420` | SVG height, 260–1000 |
| `max_repos` | `100` | Maximum repositories to fetch, 1–300 |
| `forks` | `true` | Include forked repositories |
| `archived` | `false` | Include archived repositories |

Example:

```text
/api/galaxy.svg?username=syun88&theme=dark&forks=false
```

### `GET /api/graph`

Returns a stable, renderer-friendly structure:

```json
{
  "owner": "syun88",
  "generatedAt": "2026-08-18T00:00:00.000Z",
  "repositoryCount": 42,
  "groupCount": 7,
  "nodes": [],
  "edges": []
}
```

The endpoint supports `max_repos`, `forks`, and `archived`.

### `GET /u/<username>`

Interactive viewer. It uses the JSON endpoint at runtime and does not require a build per user.

## Repository grouping

Repositories are grouped using deterministic rules based on repository names, descriptions, topics, and primary language. Built-in semantic groups include:

- Robotics / ROS 2
- AI / Machine Learning
- Minecraft Modding
- Hardware / Embedded
- Web / Apps
- Coursework / Learning

Repositories that do not match a semantic group fall back to a primary-language group such as `Python Projects` or `Rust Projects`.

## GitHub API rate limits

The service works without a token for light use. For a public deployment, configure a GitHub token as a Worker secret so requests are not limited to GitHub's low unauthenticated API quota.

```bash
npx wrangler secret put GITHUB_TOKEN
```

The token is used only server-side and is never returned to clients.

## Deploy to Cloudflare Workers

```bash
npm install
npx wrangler login
npm run deploy
```

After deployment, use the assigned `*.workers.dev` URL or attach a custom domain.

## Design goals

- One deployment works for any public GitHub username.
- README consumers only need an `<img>` URL.
- JSON remains independent from the built-in renderer.
- No client-side GitHub token.
- Deterministic layouts keep README previews stable between requests.
- Interactive viewer remains lightweight and dependency-free at runtime.

## License

MIT
