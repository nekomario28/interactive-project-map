# Repository Quality presentation SVG prototype — 2026-08-25

Status: **experimental standalone renderer fixture / consumes presentation model only / not integrated into production galaxy**

This prototype is the first rendering layer that consumes the renderer-neutral repository Quality presentation model instead of reading assessment evidence directly.

Implementation:

```text
scripts/repository-quality-presentation-prototype-svg.mjs
```

Regression coverage:

```text
tests/repository-quality-presentation-prototype-svg.test.mjs
```

## Input boundary

The renderer accepts only:

```text
ipm-repository-quality-presentation-v1
```

It does not read:

```text
raw GitHub metadata
README evidence
CI configuration
Quality evidence providers
assessment policy routing
Stars / Forks
Portfolio Prominence
```

Those concerns remain upstream.

## Current-profile fixture

The regression builds the frozen current-profile assessment candidate, derives the Quality presentation model, and renders all 15 repositories.

Expected state:

```text
repository cards       15
Quality available       4
Quality unavailable    11
repository core radius 14 for all cards
```

The four assessed repositories receive semantic Quality rings. The eleven unassessed repositories receive an explicit dashed `quality-unavailable` ring and remain visible.

No repository disappears merely because Quality evidence is absent.

## Compact mode

Compact mode is intended for small profile-scale presentation.

```text
view = compact
```

It renders:

```text
target-finding-distribution
```

and intentionally does not emit dimension identity attributes.

This avoids pretending that tiny ring segments remain readable as named dimensions.

## Detail mode

Detail mode renders:

```text
full-fixed-dimension-ring
```

For the four currently assessed repositories this produces eight stable semantic dimension slots each, for 32 dimension-bearing segments in the frozen current-profile regression.

The eleven unavailable repositories still use the explicit unavailable ring instead of an eight-slot unknown ring.

## Equal repository cores

The prototype uses the same repository-core radius for every card:

```text
r = 14
```

This is deliberate. Quality does not change node size at this stage.

The later Portfolio Prominence layer, once separately calibrated, may determine how project significance influences size or label priority. This prototype does not pre-empt that decision.

## Assessment-owned artifact labels

Artifact labels come from the validated assessment context carried into the presentation model.

The renderer does not infer artifact type from repository name, language, README, or layout.

If artifact context is unknown, the renderer displays:

```text
artifact unknown
```

rather than fabricating a fallback type.

## Attribution boundary

The current personal canvas must not include the external FiveThirtyEight dataset calibration donor.

The donor continues to exist only in its separate calibration context and is not rendered as a portfolio repository.

## No popularity geometry

The SVG contains no score, Stars, Forks, or Prominence inputs.

Current Structure renderers may continue to use their existing visual rules. This standalone Quality fixture proves only Quality evidence presentation semantics.

## Accessibility boundary

The SVG includes an image role, title/aria label, textual repository labels, artifact labels, and textual Quality availability/coverage.

This is a structural accessibility baseline, not final visual accessibility acceptance. Dark/light contrast, zoom behavior, mobile scale, and interactive detail remain separate browser-level gates.

## Claim boundary

If exact-head CI passes, the prototype establishes:

```text
validated current-profile assessment candidate
  -> strict renderer-neutral Quality presentation model
  -> standalone SVG fixture
  -> all 15 repositories preserved
  -> 4 semantic Quality rings
  -> 11 explicit unavailable rings
```

It does not establish:

- production galaxy integration;
- default Quality mode;
- responsive viewer controls;
- final visual design;
- Quality ranking or scalar scoring;
- Portfolio Prominence sizing;
- full portfolio Quality acquisition.

## Next gate

After exact-head structural validation, render this fixture in browser evidence at compact and detail scales and inspect readability/contrast. Only then should a feature-gated Quality overlay be attached to a real viewer surface.
