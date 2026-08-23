# GitHub App registration helper

**Status: DORMANT / NOT_PRODUCTION_EXPOSED.** The one-click implementation is retained for possible future reuse, but normal users should use the GitHub-only generated-workflow path. Do not register or expose a production GitHub App merely because this helper exists.

If one-click is deliberately reactivated after the roadmap condition is met, it requires one GitHub App registration plus four Worker secrets. Do not use the GitHub App manifest flow for this project: that flow returns a private key and webhook secret that this architecture deliberately does not need.

GitHub supports pre-filling the normal registration form with URL parameters. Generate the exact Project Map registration URL with:

```sh
node scripts/github-app-registration-url.mjs https://YOUR-WORKER.workers.dev
```

Open the printed GitHub URL while signed in as the account that should own the App. Review the pre-filled values before creating it.

The helper fixes these settings from the reviewed one-click contract:

- public GitHub App;
- homepage = the exact Worker origin;
- callback = `<worker-origin>/api/install/callback`;
- request user authorization during installation = enabled;
- webhook = disabled;
- Contents = read/write;
- Workflows = read/write;
- Actions = read/write;
- no webhook events or unrelated permissions.

After GitHub creates the App, copy only the values required by the existing Worker design and set them with Wrangler:

```sh
wrangler secret put GITHUB_APP_CLIENT_ID
wrangler secret put GITHUB_APP_CLIENT_SECRET
wrangler secret put GITHUB_APP_SLUG
wrangler secret put INSTALL_STATE_SECRET
```

Generate `INSTALL_STATE_SECRET` independently with at least 32 random bytes, for example:

```sh
openssl rand -hex 32
```

The App private key and webhook secret are not used. Do not add them to Worker configuration.

Credential presence does not expose the installer. The Worker additionally requires the explicit non-secret gate `ENABLE_ONE_CLICK_INSTALLER=true`; keep it false for normal/public operation. Use `true` only in a deliberate reactivation/acceptance environment after reviewing the current roadmap and one-click installer contract.

This helper is an operator-only dormant recovery/reactivation tool, not an end-user setup path.

Official GitHub reference: `Registering a GitHub App using URL parameters` in GitHub Docs.
