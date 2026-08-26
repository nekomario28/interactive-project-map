# Design-system consistency detection

Status: **measured reference / detection-only / no renderer rewrite**

This gate records the current design authority of the public 2D viewer and the Three.js cosmic viewer without forcing them to share one visual skin.

The measured grammar is `design/ui-reference-grammar.json`. `scripts/validate-design-system.mjs` checks it before screenshots and browser E2E.

## What is authoritative now

The shared 2D viewer already uses fourteen semantic CSS custom properties for surface, text, border, accent, repository status and shadow roles. Its Obsidian override supplies the same role vocabulary with a different palette.

The Three.js viewer declares eight namespaced `--three-*` custom properties. Current source evidence shows only `--three-cyan` is consumed through `var(...)`; the other seven declarations are intentionally recorded as **observed unconsumed**, not promoted as renderer authority merely because they look token-like.

Raw Three.js color literals remain outside semantic authority. The linter counts them but does not ban them. A future cleanup must first establish which repeated values actually represent stable semantic roles.

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
