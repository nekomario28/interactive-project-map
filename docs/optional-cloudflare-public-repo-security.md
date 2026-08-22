# Optional Cloudflare path and public-repository security

Status: **Accepted** (2026-08-22). This supersedes only the removal portion of `github-only-architecture-decision.md`.

## Product policy

GitHub repository + GitHub Actions + GitHub Pages remains the default and fully supported Project Map path. The existing Cloudflare Worker + GitHub App installer is retained as an **optional one-click path** for users who prefer it. It is never required for normal generation, viewing, scheduled refreshes, or Stable `@v1` use.

Keeping the optional Worker does not change the static-first authority: generated `project-map/graph.json` and `project-map/galaxy.svg` remain owned by the user's profile repository, and recurring work remains repository-local GitHub Actions.

## Public repository audit

The tracked public source was reviewed for the current Worker/App secret boundary.

Safe to keep public:

- Worker source, route definitions and tests;
- GitHub App permission/callback requirements;
- secret **names** such as `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_SLUG`, and `INSTALL_STATE_SECRET`;
- `wrangler.jsonc` rate-limit namespace identifiers and non-secret deployment metadata;
- `.dev.vars.example` containing obvious placeholder values only;
- token-prefix validation such as checking that an ephemeral GitHub App user token begins with `ghu_`.

Never commit:

- an actual GitHub App client secret;
- a real `INSTALL_STATE_SECRET`;
- GitHub PATs, `ghu_` user access tokens, installation tokens, OAuth codes, session cookies, or signed installer state captured from a live browser;
- `.dev.vars`, `.dev.vars.<environment>`, `.env`, `.env.local`, `.env.<environment>`, or similar local secret files;
- Cloudflare API tokens/account credentials or exported dashboard secret values;
- logs, screenshots, fixtures, or Actions artifacts containing any of the above.

Cloudflare's current Workers documentation explicitly requires sensitive values to use secrets rather than plaintext `vars` and recommends ignoring `.dev.vars*` and `.env*`. The repository therefore ignores those complete families while explicitly allowing the placeholder `.dev.vars.example` (and a future placeholder `.env.example`).

## Current code properties

The optional installer remains stateless with respect to the GitHub user access token:

- OAuth code exchange sends the client secret only in the server-side Worker request;
- the returned `ghu_` token is used only for the callback flow and is not persisted;
- signed installer state contains normalized install options, nonce and timestamps, not credentials;
- the nonce cookie is `HttpOnly`, `Secure`, `SameSite=Lax`, callback-path scoped, and short-lived;
- installer errors are generic and do not intentionally interpolate token/secret values;
- recurring Project Map generation does not depend on the GitHub App after the workflow exists.

## Operational rule

Production secrets belong only in Cloudflare Worker secrets (`wrangler secret put` / dashboard secret storage). Local development uses an ignored `.dev.vars` **or** `.env`, never both as a source-controlled configuration mechanism. Do not put credentials in `wrangler.jsonc`, committed docs, examples, test fixtures, or GitHub Pages JavaScript.

If the optional Worker is not configured, the beginner-friendly GitHub Pages setup remains the fallback and canonical default.

## Architecture relationship

`docs/github-only-architecture-decision.md` remains useful for the research comparing browser OAuth, device flow, PATs, templates, CLI, and the durable GitHub-only path. Its former cleanup direction to delete the Worker is superseded by this decision: **retain but isolate the Worker; do not make it a dependency of the default path**.
