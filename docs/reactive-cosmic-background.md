# Reactive cosmic background contract

Status: implemented on interactive Pages `main` via PR #170 (2026-08-24).

## Intent

The shared Galaxy / Obsidian viewer should feel like one continuous spatial scene rather than a graph drawn over a screen-fixed star texture. Background motion is secondary interaction feedback: it must reinforce camera movement without competing with repositories, labels, or semantic edges.

This follows the earlier profile Project Map design principle that stellar decoration belongs to the same galaxy/world as the project map instead of behaving like unrelated screen-space noise.

## Production contract

- Scope is the shared interactive `/u/` surface only. Static SVG generation and the eight dedicated viewers are intentionally unchanged.
- Background layers use deterministic username-seeded coordinates so redraws do not shimmer or regenerate stars.
- Stars are rendered from a repeating common tile and wrap across viewport edges. A star must not abruptly disappear simply because the camera crossed a screen boundary.
- Camera pan drives three depth layers at `0.08`, `0.18`, and `0.32` of `state.pan`. The subtle haze uses a still slower depth response.
- Galaxy-specific nucleus / system decoration remains above the cosmic base background. Script order is therefore `viewer.js` → `cosmic-background.js` → style runtimes.
- Meteors are ambience, not graph data. At most one may be active, normal idle delay is approximately 22–56 seconds, and it is drawn inside the background pass so graph content remains visually authoritative above it.
- Hidden tabs do not keep scheduling meteors.
- Native `prefers-reduced-motion: reduce` and the existing interactive Motion Off control freeze parallax and suppress meteors.
- Narrow/mobile viewports reduce star density rather than increasing canvas work.
- No repository/category/contribution semantics, graph layout coordinates, or static Action output are derived from the cosmic runtime.

## Evidence

PR #170 final head `004d517a47811da204df9cbe0e70c7f60108706d` passed Verify run `32728358618` / #773:

- full Verify and twelve-preset comparison: GREEN;
- Chromium browser suite: GREEN;
- iPhone WebKit smoke: GREEN;
- browser Gate samples real starfield pixels before and after camera pan and verifies the same near-layer star moves by `pan × 0.32` modulo the shared tile;
- browser Gate explicitly spawns and samples a real meteor during visible mid-flight;
- reduced-motion browser Gate proves effective parallax becomes zero and meteor spawning is rejected.

The reusable static Action and stable `v1` are not promoted for this feature because their output contract did not change.
