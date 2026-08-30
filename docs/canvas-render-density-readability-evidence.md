# Canvas render-density readability evidence

This evidence slice follows issue #285 without changing any viewer default or exposing a new product control.

## Question

Does the existing opt-in `render=auto` policy materially damage Canvas text/readability at DPR 3 compared with the current native-DPR default?

## Method

- Chromium at 1280×720 CSS pixels and DPR 3.
- Same deterministic dense Radial graph and camera/layout state.
- Capture canvas-only screenshots for:
  - native mode (no `render` query, current production default),
  - explicit `render=auto` (desktop cap 1.45×).
- Persist backing-store metrics beside both screenshots.
- Treat screenshots as rendered visual evidence, not as a reason to change the default by themselves.

## Promotion boundary

This slice does **not**:

- change the 2D default;
- expose `Render` in the 2D UI;
- change layout, hit-testing, labels, taxonomy, or SVG output;
- claim visual equivalence before the artifact is reviewed.

A later default/UI decision still requires the rendered evidence plus measured performance/readability benefit to be judged together.
