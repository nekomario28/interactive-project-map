# Optional Cloudflare path and public-repository security

Status: **Accepted security boundary; one-click exposure superseded to DORMANT on 2026-08-23.** This document still defines the retained Worker/App secret boundary. `docs/current-roadmap.md` is authoritative for whether the one-click product surface is active.

## Product policy

GitHub repository + GitHub Actions + GitHub Pages is the default and fully supported Project Map path. The Cloudflare Worker may remain useful for hosted previews/fallback, while the retained GitHub App installer is **DORMANT / NOT_PRODUCTION_EXPOSED**. Its implementation and security tests remain in `main`, but normal UI does not advertise it and credentials alone do not activate it. Public installer exposure additionally requires the explicit `ENABLE_ONE_CLICK_INSTALLER=true` gate, which stays off unless the roadmap reactivation condition is met and real-credential acceptance is deliberately completed.

Keeping the dormant Worker/App code does not change the static-first authority: generated `project-map/graph.json` and `project-map/galaxy.svg` remain owned by the user's profile repository, and recurring work remains repository-local GitHub Actions.

## Public repository audit

The tracked public source was reviewed for the current Worker/App secret boundary.

Safe to keep public:

- Worker source, route definitions and tests;
- GitHub App permission/callback requirements;
- secret **names** such as `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_SLUG`, and `INSTALL_STATE_SECRET`;
- the non-secret exposure default `ENABLE_ONE_CLICK_INSTALLER=false`;
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

The dormant installer remains stateless with respect to the GitHub user access token when explicitly enabled for tests/reactivation:

- normal exposure is gated separately from credential configuration;
- while the gate is absent/false, the UI omits one-click and installer start/callback routes fail closed;
- OAuth code exchange sends the client secret only in the server-side Worker request;
- the returned `ghu_` token is used only for the callback flow and is not persisted;
- signed installer state contains normalized install options, nonce and timestamps, not credentials;
- the nonce cookie is `HttpOnly`, `Secure`, `SameSite=Lax`, callback-path scoped, and short-lived;
- installer errors are generic and do not intentionally interpolate token/secret values;
- recurring Project Map generation does not depend on the GitHub App after the workflow exists.

## Operational rule

Production secrets belong only in Cloudflare Worker secrets (`wrangler secret put` / dashboard secret storage). Local development uses an ignored `.dev.vars` **or** `.env`, never both as a source-controlled configuration mechanism. Do not put credentials in `wrangler.jsonc`, committed docs, examples, test fixtures, or GitHub Pages JavaScript.

Keep `ENABLE_ONE_CLICK_INSTALLER=false` for normal/public operation. If a future reviewed reactivation is justified, set it true only in the deliberate acceptance environment first; credentials must never be treated as an implicit feature flag.

The beginner-friendly GitHub Pages setup remains the canonical production onboarding path regardless of whether dormant Worker/App code is present.

## Architecture relationship

`docs/github-only-architecture-decision.md` remains useful for the research comparing browser OAuth, device flow, PATs, templates, CLI, and the durable GitHub-only path. Its former cleanup direction to delete the Worker remains superseded: retain the small Worker/App implementation and security tests, but keep one-click dormant and isolated unless evidence justifies reactivation.
