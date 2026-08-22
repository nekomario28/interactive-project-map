# Mobile footer overflow regression

Status: fix candidate (2026-08-22)

## Symptom

At a 390 px phone viewport, the viewer footer note extends past the right edge and is clipped by `body { overflow: hidden; }`. The existing document `scrollWidth` smoke stayed green because the clipping occurs inside the fixed viewport rather than creating page-level horizontal scrolling.

## Root cause

The footer is a flex row. Its first text span retained its intrinsic minimum width, while the shortcuts span was a second flex item. On narrow viewports the note therefore did not shrink to the available footer width and was clipped at the viewport edge.

## Fix

- allow the footer note to shrink with `min-width: 0`;
- keep it one line and make truncation intentional with `overflow: hidden`, `text-overflow: ellipsis`, and `white-space: nowrap`;
- keep desktop shortcuts non-shrinking and single-line;
- do not change viewer layout, Category Navigator, renderers, or graph state.

## Regression gate

A browser E2E at 390×844 checks both a shared Galaxy viewer and a dedicated Treemap viewer. It asserts that the footer and note remain inside the viewport and that the note uses the intentional ellipsis contract. This catches the visual clipping that the previous page-level `scrollWidth` assertion missed.
