# GitHub App one-click installer

This document fixes the production boundary for the optional one-click installer. The normal Project Map runtime remains distributed: after installation, each user's own GitHub Actions workflow fetches metadata, generates `project-map/galaxy.svg` and `project-map/graph.json`, and publishes those files. The GitHub App is not in the recurring generation path.

## Why a GitHub App

The existing manual installer is intentionally safe but still asks users to copy a workflow file. A GitHub App can reduce that to GitHub's own install/authorization confirmation, one workflow write, and one initial `workflow_dispatch`.

The implementation deliberately does **not** add:

- a database or KV store;
- a long-lived user token store;
- an installation-token service;
- a GitHub App private key;
- webhooks;
- a background scheduler;
- any dependency in the user's twice-daily generation path.

The OAuth user access token exists only for the callback request and is discarded after the workflow is installed and dispatched.

## GitHub App registration

Register a public GitHub App with:

- **Homepage URL:** the deployed Worker root.
- **Callback URL:** `https://<worker-origin>/api/install/callback`.
- **Request user authorization (OAuth) during installation:** enabled.
- **Webhook:** disabled.
- **Repository permissions:**
  - Contents: **Read and write**
  - Workflows: **Read and write**
  - Actions: **Read and write**
- Do not request unrelated organization/account permissions.

GitHub's documentation states that editing `.github/workflows` requires the Workflows permission in addition to the content-write capability, and creating a workflow dispatch requires Actions write. User access tokens are additionally limited by the authorizing user's own repository access.

With “Request user authorization during installation” enabled, GitHub redirects to the OAuth callback rather than a separate setup URL.

References:

- https://docs.github.com/en/apps/maintaining-github-apps/modifying-a-github-app-registration
- https://docs.github.com/en/apps/sharing-github-apps/sharing-your-github-app
- https://docs.github.com/en/rest/apps/installations
- https://docs.github.com/en/rest/repos/contents
- https://docs.github.com/en/rest/actions/workflows

## Worker secrets

Set all four values before exposing the one-click control:

```sh
wrangler secret put GITHUB_APP_CLIENT_ID
wrangler secret put GITHUB_APP_CLIENT_SECRET
wrangler secret put GITHUB_APP_SLUG
wrangler secret put INSTALL_STATE_SECRET
```

`INSTALL_STATE_SECRET` must contain at least 32 bytes of secret material. A suitable value can be generated with:

```sh
openssl rand -hex 32
```

No private key is required by this architecture because the callback uses a GitHub App **user access token**, not an installation access token.

## Request flow

```text
browser
  |
  | GET /api/install/start?username=...&theme=...
  v
Worker
  |-- validate options
  |-- create 15-minute HMAC-signed state
  |-- create random browser nonce
  |-- Set-Cookie: HttpOnly; Secure; SameSite=Lax
  v
https://github.com/apps/<slug>/installations/new?state=...
  |
  | GitHub install + user OAuth authorization
  v
GET /api/install/callback?code=...&state=...
  |
  |-- verify HMAC, expiry and nonce cookie
  |-- exchange code for ephemeral GitHub App user token
  |-- GET /user/installations
  |-- require a User installation whose login == requested username
  |-- GET /user/installations/{id}/repositories
  |-- require explicit USERNAME/USERNAME access + push/admin capability
  |-- GET .github/workflows/project-map.yml
  |-- create it, or update it only when it contains our managed marker
  |-- POST workflow_dispatch (short retry only for just-created 404 race)
  |-- discard user token
  v
/u/USERNAME?...&install=created|updated|unchanged
```

## Security invariants

### Never trust `installation_id` from a redirect

GitHub explicitly warns that an `installation_id` query parameter can be spoofed. The implementation therefore does not use callback-supplied installation IDs. It lists installations accessible to the authorized user token and independently verifies the account and profile repository.

### State is browser-bound, not merely signed

The install state is HMAC-signed and expires after 15 minutes. In addition, a random nonce inside the signed state must equal an HttpOnly `SameSite=Lax` cookie set when installation begins. A copied callback URL is therefore insufficient on its own.

### Existing workflows are not blindly replaced

`.github/workflows/project-map.yml` is updated only when it contains:

```text
# Managed by interactive-project-map one-click installer v1
```

An unrelated file at that path produces a conflict instead of being overwritten. Repair/migration of legacy workflow names is a separate explicit phase.

### The recurring path stays App-independent

The installed workflow calls the reviewed reusable generator by immutable commit SHA. The GitHub App is used only for install/update/repair operations; scheduled generation continues with the target repository's own `GITHUB_TOKEN`.

## Validation gates

Code-only gates, which require no GitHub App credentials:

1. HMAC state round-trip.
2. tamper rejection.
3. expiry rejection.
4. nonce-cookie mismatch rejection.
5. installation account verification.
6. explicit `USERNAME/USERNAME` repository verification.
7. unmanaged-workflow overwrite refusal.
8. immutable reusable-workflow SHA retained in installed YAML.
9. first-run dispatch with a bounded retry for GitHub's just-created workflow visibility race.
10. Worker typecheck/dry-run and the existing full project verification suite.

The final production gate requires a real GitHub App registration and Worker secrets:

1. start from the hosted UI;
2. install the App on a disposable/public profile repository;
3. return through the OAuth callback;
4. confirm exactly one managed workflow file is created;
5. confirm its first workflow run starts;
6. confirm only `project-map/galaxy.svg` and `project-map/graph.json` are published;
7. remove App access and confirm the already-installed scheduled workflow continues independently.

Do not weaken the code-only gates to compensate for a registration or permission error. Use GitHub's `X-Accepted-GitHub-Permissions` response header to diagnose missing App permissions.
