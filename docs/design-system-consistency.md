# Design-system consistency detection

Status: **measured reference / detection-only / no renderer rewrite**

This gate records the current design authority of the public 2D viewer and the Three.js cosmic viewer without forcing them to share one visual skin.

The measured grammar is `design/ui-reference-grammar.json`. `scripts/validate-design-system.mjs` checks it before screenshots and browser E2E.

## What is authoritative now

The shared 2D viewer already uses fourteen semantic CSS custom properties for surface, text, border, accent, repository status and shadow roles. Its Obsidian override supplies the same role vocabulary with a different palette.

The Three.js viewer declares eight namespaced `--three-*` custom properties. Current source evidence shows only `--three-cyan` is consumed through `var(...)`; the other seven declarations are intentionally recorded as **observed unconsumed**, not promoted as renderer authority merely because they look token-like.

Raw Three.js color literals remain outside semantic authority. The linter counts them but does not ban them. A future cleanup must first establish which repeated values actually represent stable semantic roles.

## Neutral semantic-role mapping

`docs/ui-semantic-token-mapping.json` records a value-free interoperability view over a bounded subset of the already-authoritative shared 2D tokens.

It does not create new CSS tokens, change either measured palette, or replace `design/ui-reference-grammar.json` as local design authority.

The current mapping is intentionally `EXPLICIT` and covers eight neutral roles across both owner modes:

```text
default
obsidian
```

Only owner tokens with clear cross-project semantics are mapped:

```text
--bg             -> color.bg.canvas
--panel          -> color.bg.surface
--panel-elevated -> color.bg.surfaceRaised
--text           -> color.text.primary
--muted          -> color.text.muted
--border         -> color.border.subtle
--accent         -> color.border.focus
--accent         -> color.selection.selected
```

Reusing `--accent` for two neutral roles reflects current owner behavior: the same token already drives focus treatment and committed `aria-pressed` emphasis. The mapping does not split or rename the owner token merely to fit an external vocabulary.

The repository-specific `--owner`, `--group`, `--original`, `--fork`, `--archived`, and `--relation` roles remain outside the neutral mapping. `--shadow` also remains local because it is a resolved shadow color input, not by itself an elevation semantic. No `--three-*` declaration is mapped; current Three.js semantic authority remains exactly as measured by the local grammar.

The external neutral role catalog is therefore an interoperability vocabulary only. Concrete values, palettes, rendering behavior, accessibility acceptance, and theme acceptance remain owned and verified here.

`tests/ui-semantic-token-mapping.test.mjs` fails closed if the manifest expands beyond this boundary, maps a token not measured as consumed, loses either default or Obsidian owner coverage, or promotes repository-specific/Three.js tokens through the neutral manifest.

## Fail-closed boundaries

The gate fails when:

- grammar shape gains an unreviewed key;
- measured semantic role names or values drift;
- a role moves between consumed and unconsumed state without updating the measured grammar;
- the shared 2D role vocabulary or Obsidian override drifts;
- the Three.js `prefers-reduced-motion` boundary disappears;
- reduced motion stops disabling `.three-label` `will-change`.

It deliberately does **not** require 2D and Three.js palette values to be equal, require both surfaces to use identical role names, or reject every raw artistic color literal.

## Promotion rule

A Three.js raw literal or currently unconsumed `--three-*` declaration may become semantic renderer authority only after its role is established by component semantics, a controlled design change, or another independent surface. The change should then update the grammar and preserve browser/accessibility evidence.

This repository is an independent consumer of the broader pattern:

`measured visual authority -> bounded census -> semantic role or explicit non-promotion -> detection-only lint -> controlled renderer migration`

No Profile Envelope implementation code is imported or copied here.
