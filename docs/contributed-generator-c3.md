# Contributed generator C3

Status: **Direct production proof GREEN; release-chain promotion in progress** (2026-08-23)

## Action contract

The Project Map Action accepts an opt-in `contributed` boolean, default **false**. When disabled, generation stays on the existing owned-repository path apart from ordinary timestamps.

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

## Direct Action F production proof

The final C4 implementation commit is **F = `e5dafc86bec1cee6d913deaf040a2631599afb53`**. Before advancing any reusable-workflow pin or `v1`, the public `nekomario28/nekomario28` profile ran Action F directly with `contributed: true` under a `contents: read` generation job.

Proof run `32631530792` completed GREEN. Its safe receipt records:

- 13 owned repositories;
- 6 Contributed repositories;
- 6 direct `contribution` edges;
- 0 serialized privacy-marker keys;
- 0 ownership/membership violations;
- a bounded 365-day public contribution window.

The full proof artifact was independently inspected as well: Contributed nodes retained full external `owner/repo` identity, had no `groupId` / `groupLabel`, did not enter owned semantic edges, and were reachable only through direct `contribution` edges from the profile owner. The proof workflow did not publish this experimental graph into the canonical `project-map/` output.

## Release-chain promotion

The direct-F proof satisfies step 2 of `docs/release-chain.md`. The current release step is now:

1. keep **F** fixed at `e5dafc86bec1cee6d913deaf040a2631599afb53`;
2. update the reusable workflow inner Action pin and both public metadata mirrors to F;
3. forward `contributed: ${{ inputs.contributed }}` in that same reviewed release change;
4. run the exact release-head verification gates;
5. after merge, call the reusable workflow at exact release commit **R** and prove that it executes F and emits the same safe Contributed contract;
6. only then move `v1` to R and regenerate the canonical profile through `@v1`.

Pages and Cloudflare stable setup generators still do not expose Contributed as a default-on user choice. Stable-channel exposure follows the release boundary rather than preceding it.

## C4 boundary

C4 is complete. Shared Galaxy/Obsidian plus all eight dedicated viewers agree on the fourth Contributed status, strict external identity, filtering and aggregate semantics. C5 now owns release-chain proof, stable promotion and the final live profile UX/privacy acceptance.
