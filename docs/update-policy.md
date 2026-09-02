# Project Map update policy

Project Map keeps generation code and profile-repository write permissions separate.

## Production default: Stable Auto

Normal installs use the read-only reusable generator through:

```yaml
uses: nekomario28/interactive-project-map/.github/workflows/generate-project-map.yml@v1
```

`v1` is the reviewed outer compatibility channel. Moving that channel can deliver compatible fixes without asking every user to edit their profile workflow. The reusable workflow separately pins the Project Map Action and GitHub-maintained third-party Actions to reviewed immutable commit SHAs.

This is the recommended mode for normal users.

## Advanced: pin the reusable workflow

Users who require an immutable reusable-workflow definition may replace `v1` with a reviewed full 40-character commit SHA. The public setup generator accepts the same choice through its `generator_ref` URL parameter; the normal homepage intentionally keeps `v1` as the default rather than exposing pin management as primary UI.

Only `v1` or a full 40-character hexadecimal commit SHA is accepted. `main`, short SHAs, and arbitrary refs are rejected instead of silently falling back.

See `docs/release-chain.md` for the distinction between the outer reusable-workflow ref and the immutable inner Action SHA.

## Normal update behavior

The generated profile workflow runs on schedule or manual dispatch. Its generator job is read-only and transfers only the generated Project Map artifact to a separate publish job. The profile repository's publish job alone receives `contents: write`, and it commits only when `project-map/galaxy.svg` or `project-map/graph.json` changed.

There is no shared write-capable backend in the normal setup path.

## Dormant GitHub App installer

The retained Cloudflare/GitHub App one-click installer is **DORMANT / NOT_PRODUCTION_EXPOSED**. Its install/update/repair implementation remains in `main` only for possible future reuse and regression compatibility. It is not the current update path and should not be presented as one.

Do not register, expose, or expand the one-click path merely because the retained code or credentials exist. Reactivation requires the explicit product/reopen conditions documented in `docs/current-roadmap.md`, `docs/github-only-architecture-decision.md`, and `docs/github-app-one-click-installer.md`.
