# Contributed generator C3

Status: **Staged implementation** (2026-08-22)

## Action contract

The Project Map Action now accepts an opt-in `contributed` boolean, default **false**. When disabled, generation is byte-for-byte on the existing owned-repository path apart from ordinary timestamps.

When enabled, generation keeps owned taxonomy/semantic processing authoritative, then performs exactly one bounded public external-contribution query, applies C1 ranking/cap, classifies the selected external repositories for metadata/search, and attaches them using the C2 `contribution` relation.

The order is intentional:

```text
owned public repositories
→ owned graph
→ owned semantic/taxonomy processing
→ optional public external contribution fetch
→ C1 deterministic rank/cap
→ C2 Contributed attachment
→ graph.json + selected SVG renderer
```

External repositories therefore do not participate in taxonomy discovery or owned category membership.

## Failure semantics

`contributed: true` is an explicit data request. If the authenticated GitHub GraphQL contribution query fails or is rate-limited, generation fails rather than silently emitting an owned-only graph that looks complete.

No PAT, GitHub App credential, Cloudflare dependency, browser fetch, or additional contribution source is introduced.

## Release-chain staging

The reusable workflow source defines a `contributed` input now, but deliberately does **not** pass it to the current immutable inner Action `caeca4b7…`, which predates C3.

This is not dead wiring. It enforces the release protocol from `docs/release-chain.md`:

1. C3/C4 produce final implementation commit **F** containing Action support.
2. Real-profile/privacy proof calls Action **F directly** with `contributed: true`.
3. The later inner-pin release commit changes the reusable workflow to Action **F** and adds `contributed: ${{ inputs.contributed }}` in the same commit.
4. Exact reusable-workflow proof runs before `v1` moves.

Pages and Cloudflare stable setup generators do not emit the new input yet. Doing so before `v1` is promoted would create workflows that call an older stable reusable workflow which does not know the input. User-facing setup exposure follows the stable release boundary rather than preceding it.

## C4 boundary

C3 guarantees correct data collection and serialization, not complete visual semantics. C4 is responsible for making all 12 presets, fourth-status filtering, tooltips/search, Focus and aggregations understand Contributed consistently before F is accepted.
