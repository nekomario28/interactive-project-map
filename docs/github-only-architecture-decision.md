# Architecture decision: GitHub-only distribution

Status: **Accepted as the default path** (2026-08-22)

> **Update:** GitHub repository + GitHub Actions + GitHub Pages remains the default and fully supported architecture, but the existing Cloudflare Worker + GitHub App one-click path is now intentionally retained as an **optional** convenience. The Worker-removal sections below are historical research and are superseded by [`optional-cloudflare-public-repo-security.md`](./optional-cloudflare-public-repo-security.md). Cloudflare must never become a dependency of normal Project Map generation or viewing.

## Goal

Minimize the number of services, secrets, authentication paths, runtime implementations, and long-lived operational responsibilities required to use Project Map while preserving the product's core behavior: a profile SVG, a user-owned `graph.json`, scheduled refreshes, the 12 GitHub Pages viewers, Stable Auto `@v1`, and optional immutable pinning.

## Current proven path

The recommended path is already static-first and GitHub-owned:

```text
GitHub Pages setup generator
  -> USERNAME/USERNAME/.github/workflows/project-map.yml
  -> GitHub Actions
  -> public reusable workflow @v1
  -> user-owned project-map/galaxy.svg + project-map/graph.json
  -> GitHub Pages viewer reads raw.githubusercontent.com/USERNAME/USERNAME/HEAD/project-map/graph.json
```

The Pages deployment itself is also GitHub Actions -> GitHub Pages. Normal viewer traffic does not require the hosted Worker.

The Cloudflare Worker is therefore an optional second implementation of home/viewer/graph/SVG generation plus the GitHub App installer, not a dependency of the main path.

## Options investigated

### A. Keep Cloudflare Worker + GitHub App one-click

**Benefit:** the installer can write `.github/workflows/project-map.yml` and dispatch it after GitHub authorization.

**Cost:** separate deployment, four secrets, OAuth callback state/nonce handling, rate limiters, a second TypeScript runtime, Worker-specific tests, App registration/permissions, and an additional production acceptance surface. This infrastructure exists almost entirely to remove a few setup clicks.

**Decision:** reject as the default/product path. The value is too small relative to the permanent operational and security surface. It is nevertheless retained as an optional convenience under the separate public-repository security boundary linked above.

### B. GitHub Pages + OAuth/PKCE with no backend

GitHub supports PKCE parameters, but the documented OAuth web-flow token exchange still requires `client_secret`. GitHub also explicitly states that OAuth CORS preflight requests are not supported. A secret cannot be embedded in GitHub Pages/client-side JavaScript.

**Decision:** reject. There is no documented, secure browser-only OAuth web flow that gives Pages a token capable of writing the user's workflow.

References:
- https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
- https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app

### C. GitHub App/OAuth device flow

Device flow does not require a client secret, but GitHub documents it for headless clients such as CLIs, simple devices, and desktop-style clients. It adds a verification code, a second GitHub page, polling, and token handling. It is worse UX than committing one workflow file, and the OAuth endpoint is not a supported browser CORS API.

**Decision:** reject for the web setup path.

### D. Ask the user for a PAT/fine-grained token in the browser

The Pages app could call GitHub's REST API because `api.github.com` supports CORS, but the user would first need to mint and paste a write-capable token. GitHub explicitly warns not to expose application secrets client-side; asking users to handle a personal write token is also substantially worse than committing a workflow through GitHub's own UI.

**Decision:** reject.

References:
- https://docs.github.com/en/rest/using-the-rest-api/using-cors-and-jsonp-to-make-cross-origin-requests
- https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api

### E. Render everything live from unauthenticated GitHub REST in Pages

Public REST calls work cross-origin, but unauthenticated requests are limited to 60/hour per originating IP. More importantly, this does not produce a stable SVG for the GitHub profile README and abandons the user-owned static artifact architecture.

**Decision:** reject as the canonical path. Static `graph.json` remains the source of truth.

### F. GitHub workflow templates

GitHub workflow templates are an organization feature. They are useful for repositories governed by the same organization, but do not provide a universal external template that automatically appears in arbitrary personal profile repositories.

**Decision:** reject for general onboarding.

References:
- https://docs.github.com/en/actions/how-tos/reuse-automations/create-workflow-templates
- https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations

### G. Repository template

A repository template can provide a workflow when a profile repository does not exist yet. It does not install files into an already-existing `USERNAME/USERNAME` repository, which is the common case for users who already have a profile README. Maintaining a second profile-template repository would also add another release surface.

**Decision:** do not add a separate template repository. GitHub's repository-template URL parameters remain a possible future convenience only for users with no profile repository.

Reference:
- https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository

### H. GitHub CLI

`gh` can create/update the workflow file with an authenticated command, but requiring local CLI installation/authentication is more setup than the browser workflow for the target audience.

**Decision:** optional documentation at most; not the primary path.

### I. GitHub new-file editor deep link

GitHub supports creating files in the web UI, and GitHub has documented filename prefill via a `?filename=` link. Content prefill through `value=` is not part of the current supported documentation and has historical UI bugs. Depending on an undocumented query parameter would make onboarding brittle.

**Decision:** adopt only as a convenience for opening the correct new-file location/name. Do **not** make undocumented content prefill a correctness dependency. The generated workflow remains visible/copyable and the user commits it through GitHub.

References:
- https://docs.github.com/en/repositories/working-with-files/managing-files/creating-new-files
- https://github.blog/news-insights/the-library/creating-files-on-github/

## Ecosystem precedent

Mature GitHub-profile generators commonly use the same durable boundary: the user adds a workflow to the profile repository, and GitHub Actions performs recurring generation. Examples inspected include:

- `lowlighter/metrics` - profile-repository GitHub Action setup; MIT license. Its hosted/shared instance is explicitly a convenience with tradeoffs, while Actions provides the full/high-availability path.
- `Platane/snk` - GitHub Action usage for recurring profile generation.
- `yoshi389111/github-profile-3d-contrib` - explicitly instructs creating a workflow in `USERNAME/USERNAME` and manually running it once.

No implementation code is copied from these projects; they are architecture/onboarding precedent only.

References:
- https://github.com/lowlighter/metrics
- https://github.com/Platane/snk
- https://github.com/yoshi389111/github-profile-3d-contrib

## Decision

**Project Map defaults to GitHub-only.**

The supported default production architecture is:

```text
GitHub repository
+ GitHub Actions
+ GitHub Pages
```

The initial workflow commit is an intentional trust boundary, not a defect to hide behind another service. The user can inspect exactly what gains write permission before committing it. After that one-time commit, scheduled generation is automatic.

The normal workflow continues to use the caller repository's `GITHUB_TOKEN`; Project Map does not require a user PAT, GitHub App, OAuth app, database, KV store, webhook, or external scheduler. The optional Cloudflare/GitHub App path may automate that initial step, but it is not required.

## Consequences

### Keep

- static GitHub Pages setup generator;
- generated minimal caller workflow;
- reusable read-only generator `@v1`;
- Advanced full-SHA pinning;
- write-capable publish job only in the user's repository;
- user-owned `galaxy.svg` and `graph.json`;
- all 12 viewers and current view controls;
- optional Cloudflare/GitHub App one-click implementation, isolated from the default path and governed by `optional-cloudflare-public-repo-security.md`.

### Historical removal plan — superseded

The earlier plan to remove the Worker, GitHub App installer, OAuth callback, rate-limit infrastructure, and Wrangler dependencies is **not active**. These components remain optional and must stay isolated so the GitHub-only path works when every Worker/App secret is absent.

## Implementation sequence

1. Keep improving the GitHub-only onboarding independently of Cloudflare.
2. Keep the optional one-click path stateless and secret-safe; never embed its credentials in the public repository or Pages JavaScript.
3. Validate both paths only when changes affect them; do not make Worker CI failures block unrelated static viewer work unless the Worker surface changed.
4. Move `v1` only after relevant generator/runtime changes are GREEN.

## Regression guard

Do not make a backend mandatory solely to automate the first workflow commit. The optional Worker can remain available, but GitHub repository + Actions + Pages must always be sufficient to install, generate, update, and view Project Map.
