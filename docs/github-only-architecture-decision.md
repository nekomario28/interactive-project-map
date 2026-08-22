# Architecture decision: GitHub-only distribution

Status: **Accepted** (2026-08-22)

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

**Decision:** reject as the default/product path. The value is too small relative to the permanent operational and security surface.

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

**Project Map will be GitHub-only.**

The supported production architecture is:

```text
GitHub repository
+ GitHub Actions
+ GitHub Pages
```

The initial workflow commit is an intentional trust boundary, not a defect to hide behind another service. The user can inspect exactly what gains write permission before committing it. After that one-time commit, scheduled generation is automatic.

The normal workflow continues to use the caller repository's `GITHUB_TOKEN`; Project Map does not require a user PAT, GitHub App, OAuth app, database, KV store, webhook, or external scheduler.

## Consequences

### Keep

- static GitHub Pages setup generator;
- generated minimal caller workflow;
- reusable read-only generator `@v1`;
- Advanced full-SHA pinning;
- write-capable publish job only in the user's repository;
- user-owned `galaxy.svg` and `graph.json`;
- all 12 viewers and current view controls.

### Remove from the supported product

- Cloudflare Worker deployment/configuration;
- GitHub App installer and registration helper;
- OAuth callback/state/nonce/token handling;
- Worker rate-limit infrastructure;
- hosted `/api/graph`, `/api/galaxy.svg`, and duplicate Worker viewer/home routes;
- Worker-only TypeScript/Wrangler verification and dependencies once their remaining parity value is migrated or shown redundant.

Git history is sufficient archival storage; do not keep a permanent legacy branch solely for the removed Worker.

## Implementation sequence

1. Improve the Pages setup CTA so it opens the target GitHub new-workflow path and keeps the generated YAML one-click copyable. Do not depend on undocumented `value=` prefill.
2. Remove GitHub App/one-click UI and installer-specific feedback/contracts.
3. Remove Worker routes/config/secrets/docs and Worker-only tests.
4. Remove `wrangler` and, if no remaining non-Worker TypeScript consumer exists, `typescript`/`tsconfig.json` too.
5. Update README/security/architecture docs so GitHub-only is the only supported deployment path.
6. Run affected static/unit gates during cleanup; run full Verify + Chromium + iPhone WebKit once on the final head.
7. Move `v1` only after the final GitHub-only head is GREEN.

## Rejected future regression

Do not reintroduce a backend solely to make the first workflow commit automatic. A backend should return only if a future feature has demonstrated value that cannot be provided by GitHub repository + Actions + Pages and justifies its own security/operations budget.
