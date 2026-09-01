# Three.js Galaxy — save checkpoint

Status: **2026-09-02**

This checkpoint preserves the qualified state of the native Three.js `Galaxy` style and the next user-directed work. It is not authority to resume from this SHA blindly: every restart must first refresh `main` and forward-reconcile any newer qualified Galaxy work.

## Qualified cut at save time

- repository: `nekomario28/interactive-project-map`
- latest `main` observed: **`db568c4bb718e6f8887c6f482304239ccdda3457`**
- that main includes PR #331, which reconciles the visual corotation model after PR #329
- stable reusable `v1` remains independent and was not moved by Galaxy Pages work
- open visual experiment at save time: **PR #332 `Add a subtle stellar bulge to Three.js Galaxy`**, head `8386e1040fc44fa151e0b9b43953db006e636a94`; it is not part of the saved main cut and must not be assumed merged on restart

## What is already implemented / adopted

Do not reimplement these from old prompts.

### Native Galaxy 3D style

- `View: 2D | 3D Lab` remains separate from Style
- renderer-local 3D styles include Cosmic / Galaxy / Aurora / Wireframe
- Galaxy is a native 3D interpretation, not a flat 2D copy and not a literal Milky Way simulator

### Morphology / astronomy-inspired model

- flattened finite-thickness semantic disc
- owner at the semantic nucleus
- 2 / 3 / 4 trailing arms depending on category count
- logarithmic spiral geometry
- generic visual pitch angle: 22 degrees
- category-arm skeleton and spiral dust use the same pitch convention initially
- trailing-arm orientation is covered by runtime evidence
- far/mid/near decorative star shells are inertial in Galaxy

### Motion

The earlier request to give Galaxy 3D motion comparable to 2D is already substantially implemented.

- category systems co-rotate around the nucleus
- visual galactocentric period increases approximately with radius (`T ~ r`, bounded), giving lower outer angular speed
- owned repositories retain category membership while moving on deliberately slow local category orbits
- local repository periods are intentionally on the same several-minute interaction scale as 2D Galaxy Hybrid; this is a semantic animation metaphor, not Keplerian gravity
- external Contributed repositories co-rotate on separate outer lanes without acquiring owned membership
- spiral/dust arms have an independent slower visual pattern
- current pattern period: 2400 s, deliberately aligned with the 2D Galaxy Hybrid global-turn scale
- current visual corotation radius: `r = 150` renderer units under the visual material rule `T ~ 16r`
- Motion Off freezes semantic node orbits
- reduced-motion behavior remains respected
- moving labels, selection targets and selected-camera target follow moving meshes

### Scientific boundary

Current Galaxy is **qualitatively astronomy-informed**, not physically scaled.

It is reasonable as a visual spiral-galaxy metaphor because it has a flattened disc, trailing logarithmic arms, co-rotation, differential angular speed, an independent arm pattern, finite thickness, inertial background stars and a central semantic concentration.

It must not be described as astrophysically exact because it has no physical units, no mass model, no N-body gravity, no literal stellar dynamics, semantic external lanes, fixed generic pitch, a chosen rigid presentation pattern/corotation point, and deliberately non-physical category-local repository orbits.

Read before changing morphology/motion:

- `docs/threejs-galaxy-astronomy.md`
- `docs/threejs-galaxy-corotation.md`
- `docs/current-roadmap.md`
- `docs/research-decision-ledger.md`

## New user decision at this checkpoint: remove persistent node-to-node lines in Galaxy

The saved main still retains faint persistent **category -> repository membership** lines in Galaxy. Earlier ownership/contribution/other persistent spokes were already removed.

The user has now made the visual decision that **Galaxy looks cleaner with no persistent straight lines between nodes at all**.

This supersedes the current Galaxy `membership-only` persistent-line presentation as the next implementation target.

Desired result:

- `style3d=galaxy`: no always-on node-to-node straight graph lines
- do not remove graph semantics from the model
- do not change 2D edge semantics
- do not change Cosmic / Aurora / Wireframe unless separate evidence says to
- category membership must remain understandable through spatial grouping, category labels/navigation, selection/details, search/focus and other existing semantic UI
- if exact relations need exposure, prefer contextual selected/focused presentation rather than persistent chords across the Galaxy
- update Galaxy evidence snapshot/tests/docs so they no longer claim `membership-only` persistent lines
- remove any per-frame Galaxy edge-endpoint synchronization that becomes dead after the visual lines are disabled, but only if it is genuinely Galaxy-only and no longer required by contextual rendering

This is a **presentation decision**, not a graph-schema or authority change.

## Open visual experiment: central bulge

PR #332 is an evidence-gated Galaxy-only central stellar concentration experiment.

It adds a non-pickable, non-semantic warm central bulge/glow behind the owner and is intended to improve spiral-galaxy morphology without changing node positions, motion, lines or semantics.

On restart:

1. refresh main first;
2. check whether #332 is still open, merged, superseded or failed;
3. inspect its rendered evidence before accepting it;
4. do not let the bulge obscure the semantic owner or arm structure;
5. the line-free Galaxy decision is independent and remains required even if #332 merges.

## Next qualified work order

1. Refresh latest `main` and forward-reconcile everything newer than this save.
2. Re-read Galaxy astronomy/corotation and current rendered evidence.
3. Resolve the current state of PR #332 without assuming this checkpoint is latest.
4. Implement **Galaxy no-persistent-lines** as the first explicit user-directed visual change not yet represented in the saved main.
5. Update tests/evidence:
   - no Galaxy persistent LineSegments / edge draw objects after scene build, or an equivalent renderer-level proof;
   - semantic counts/search/category navigation/selection remain unchanged;
   - motion still works with lines absent;
   - Motion Off still freezes semantic nodes;
   - rich Chromium Galaxy screenshot regenerated and visually inspected.
6. Re-evaluate astronomy/readability after lines are gone. Do not add more physical machinery just because it is possible.
7. Only then decide whether the central bulge or any further morphology refinement materially improves the map.

## Explicit non-goals

- no N-body simulation
- no literal Milky Way claim
- no forced exact Milky Way pitch/rotation curve/bar/warp model
- no fast/chaotic node motion
- no autonomous camera animation
- no InstancedMesh/halo optimization based only on synthetic CI FPS
- no render-density control resurrection
- no duplicate 2D starfield back-port runtime; 2D already has layered star depth/parallax/haze/galaxy-envelope behavior

## Verification discipline

`fresh main -> reconcile newer Galaxy work -> smallest delta -> focused unit/model gate -> rich Chromium rendered evidence -> WebKit smoke -> Pages deploy proof if runtime changes -> update astronomy/roadmap/ledger only after behavior is qualified`

Do not infer visual success from source/build success alone.