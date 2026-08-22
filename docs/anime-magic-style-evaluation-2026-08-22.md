# Anime-magic IPM style evaluation — 2026-08-22

Status: **experimental, implementation-backed**

Branch: `experiment/anime-magic-ipm-styles`

Implementation: `experiments/anime-magic-styles/v3/index.html`

## Why the previous four visual candidates were reset

The Arcane Circle v2 / Techno Arcana v2 / Celestial Orrery v2 / Detonation-focus pass improved readability, but none of the four visual styles was strong enough to promote as a new Project Map preset. Their useful product ideas survive separately:

- persistent Category navigator;
- disclosure independent from focus;
- Category focus and Repository focus;
- context-preserving dimming;
- bounded focus feedback rather than always-on visual noise.

The visual language itself is being restarted rather than incrementally polishing those four candidates.

## Reference principles used in this pass

This experiment takes **high-level visual/interaction principles**, not characters, logos, copied frames, or exact proprietary layouts.

### Dramatic spell-casting reference

KONOSUBA / Explosion imagery is useful for the idea of a spell that visibly **charges, forms, locks, and releases**, with strong red/orange concentric geometry and a deliberately theatrical build-up. The new `Crimson Cast` candidate maps that staging to Project Map focus/navigation rather than reproducing an anime scene.

Reference:

- Crunchyroll News, *Megumin Shines in New KONOSUBA -An Explosion on This Wonderful World! Anime Visual* — https://www.crunchyroll.com/news/latest/2023/5/13/megumin-shines-in-new-konosuba-an-explosion-on-this-wonderful-world-anime-visual

### Engineering-magic reference

The Irregular at Magic High School is useful for the opposite design principle: magic as **structured information processing**. Official terminology describes an Activation Sequence as a blueprint/program for constructing magic, stored and expanded by a CAD. This suggests a Project Map UI where Category/Repository navigation can be expressed as blocks, stages, and an execution sequence rather than as ornamental rings.

References:

- Mahouka 10th anniversary official keywords — https://dengekibunko.jp/title/mahouka/keywords/
- CAD / Activation Sequence explanatory note — https://note.com/mahokouch/n/n145d0479afb6

## Implemented 740×420 candidates

All four candidates run in one real browser implementation and reuse the same Category navigator/focus state.

### 1. Crimson Cast

Design idea:

- red/orange outer ritual ring;
- four category casting nodes;
- repository labels stay outside the ring instead of becoming decorative glyphs;
- a vertical `CHARGE → FORM → LOCK → CAST` build-up is visible in the center;
- visual drama is concentrated in the framing layer, not in the repository labels.

Current result:

- visually much stronger than Arcane Circle v2;
- 8-repository readability remains acceptable at 740×420;
- still needs real-data and 20–80 repository tests before it can be considered a production preset.

Verdict: **promising visual candidate, not approved**.

### 2. CAD Sequence

Design idea:

- precise dark grid and cyan execution rail;
- `LOAD → DECODE → COMPILE → EXEC` stages;
- each Category is an `ACTIVATION BLOCK`;
- repositories remain explicit text nodes attached to the block;
- focus adds a compact sequence/status ribbon rather than bloom-heavy effects.

Current result:

- clearest hierarchy of the four new candidates;
- strongest compatibility with the persistent Category navigator;
- conceptually explains navigation/state rather than merely decorating it;
- works well with context-preserving dimming.

Verdict: **strongest candidate from this pass for further product testing**.

### 3. Layered Formula

Design idea:

- each Category owns one formula ring;
- repositories are fixed ports on that ring;
- focused Category can gain formula ticks without changing the global layout;
- spatial depth communicates separate domains while keeping the owner at the center.

Current result:

- visually distinct and reasonably readable at eight repositories;
- more scale-sensitive than CAD Sequence;
- repository labels will need explicit collision/LOD rules with real profiles.

Verdict: **conditional candidate**.

### 4. Arcane Compiler

Design idea:

- base structure uses precise module cards and a dark engineering grid;
- Repository selection receives a small red/orange release ring;
- bottom strip explicitly shows `COMPILE category → repository → CAST`;
- the dramatic spell-release language is used only after a selection.

Current result:

- combines the useful parts of theatrical casting and CAD-like structure;
- the bounded release ring is more useful as selection feedback than as idle decoration;
- likely better as an interaction layer shared by another base layout than as an independent preset.

Verdict: **strong focus/selection interaction candidate; standalone-preset value unproven**.

## Category navigator re-validation

The same interaction model from the v2 experiment was retained:

1. Category disclosure `+/−` only expands/collapses repositories.
2. Category label focuses that Category.
3. Repository row focuses that Repository.
4. Unrelated content is dimmed instead of removed.
5. Clear focus preserves disclosure state.

A real Chromium interaction gate was re-run on `CAD Sequence`:

- expand `Systems`;
- focus `Systems`;
- focus `microfactory-lab` from the expanded list;
- verify the focus chip changes to `Focus: microfactory-lab` and unrelated categories remain visible but dimmed.

Result: **PASS**.

The Category navigator remains a product-level candidate independently of whichever visual preset eventually wins.

## Current ranking

For the next evidence pass:

1. **CAD Sequence** — strongest information architecture candidate.
2. **Crimson Cast** — strongest atmospheric/profile candidate.
3. **Arcane Compiler** — strongest focus-state/selection-feedback candidate.
4. **Layered Formula** — visually interesting but the most scale-sensitive.

This ranking is provisional and based only on the fixed eight-repository 740×420 proof.

## Next gate

Do not add production preset IDs yet.

Next useful work:

1. drive all candidates from the same real `graph.json` as production presets;
2. test representative real small/medium profiles;
3. run 20–80 repository readability tests before the 100/300 dense fallback tests;
4. compare time-to-identify Category and Repository against Galaxy Systems / Hybrid / Obsidian-like;
5. keep Category navigator visible where layout width permits;
6. verify keyboard/touch/reduced-motion behavior;
7. for Crimson/Compiler effects, confirm the first static SVG frame remains complete even when animation is unavailable;
8. only promote a style if it improves either comprehension or profile identity enough to justify another production renderer.

## Decision

> The previous four visual styles are not being promoted. Keep their Category/focus UX lessons, and move the visual experiment to the new `Crimson Cast`, `CAD Sequence`, `Layered Formula`, and `Arcane Compiler` line. `CAD Sequence` is currently the best candidate to challenge the existing production layouts; `Crimson Cast` is the best candidate for a distinctive profile-facing identity.
