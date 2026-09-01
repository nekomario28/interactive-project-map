# Three.js Galaxy — astronomy boundary

Status: **2026-09-01**

The Three.js `Galaxy` style is a semantic project map rendered with a spiral-galaxy visual model. It should be astronomically plausible where that improves spatial intuition, but it must not claim that repository/category semantics are literal astrophysical objects.

## Physical principles adopted

The visual/motion model follows these broad spiral-galaxy properties:

- a spiral galaxy is dominated by a flattened stellar disc plus a dense central concentration;
- stars and gas in the disc orbit the galactic centre;
- disc material is predominantly co-rotating rather than arbitrarily alternating orbital direction;
- observed spiral-galaxy rotation curves are much flatter than a luminous-matter-only Kepler-like falloff. The renderer therefore keeps visual tangential speed broadly comparable across most of the semantic disc. With `v ≈ constant`, `T = 2πr / v`, so the visual galactocentric period grows approximately in proportion to radius and outer systems have lower angular speed;
- spiral arms are treated as density/presentation patterns rather than rigid material arms, so the dust/arm pattern has a separate slower pattern speed while semantic systems can move through it;
- the adopted arm chirality is **trailing** relative to the co-rotation direction. Most spiral galaxies are observed with trailing arms, although rare leading-arm systems exist;
- the disc has finite vertical thickness. IPM still exaggerates it for readability, but the Galaxy-specific layout is kept substantially flatter than the generic 3D layout;
- the style uses a 2–4 arm visual grammar rather than a one-arm minimum. This is still a semantic visualization, not a literal Milky Way reconstruction, but it better matches the common multi-arm morphology of disk galaxies and current Gaia-informed Milky Way depictions.

Reference background:

- NASA, *Types of Galaxies*: https://science.nasa.gov/universe/galaxies/types/
- NASA, *Barred Spiral Galaxy NGC 1300*: https://science.nasa.gov/asset/hubble/barred-spiral-galaxy-ngc-1300/
- NASA, *Hubble Comes Face-to-Face with Spiral's Arms*: https://science.nasa.gov/missions/hubble/hubble-comes-face-to-face-with-spirals-arms/
- NASA, *Spiral Galaxy NGC 4622 Spins “Backwards”*: https://science.nasa.gov/asset/hubble/spiral-galaxy-ngc-4622-spins-backwards/
- ESA, *Guide to our galaxy*: https://www.esa.int/Science_Exploration/Space_Science/Gaia/Guide_to_our_galaxy
- ESA/Gaia, *Milky Way*: https://www.cosmos.esa.int/web/gaia/milky-way
- ESA, *Anatomy of the Milky Way*: https://www.esa.int/ESA_Multimedia/Images/2016/09/Anatomy_of_the_Milky_Way
- Shen & Zheng, *The Bar and Spiral Arms in the Milky Way: Structure and Kinematics*: https://arxiv.org/abs/2012.10130

## Product-semantic metaphors kept intentionally

These are **not** astrophysical claims:

- the portfolio owner occupies the nucleus because it is the semantic root, not because a GitHub user represents a black hole or bulge;
- categories are coherent local systems so repository membership remains readable;
- repositories orbiting a category are a 3D continuation of the 2D Galaxy Hybrid interaction metaphor, not a claim that galactic stars orbit spiral-arm labels;
- therefore repository-to-category local orbits intentionally do **not** claim Keplerian gravity. Their slow 2D-like periods preserve category membership and make the map feel alive without inventing a physical mass model for semantic nodes;
- Contributed repositories remain on clearly external outer lanes because authority/ownership semantics require separation; this is not intended as a literal stellar halo model;
- repository/category size, color and luminosity encode project metadata and interaction state, not stellar mass, age or spectrum;
- the style does not force a central stellar bar or Milky-Way-specific warp, because `Galaxy` is a generic semantic spiral style rather than an asserted scale model of our own galaxy.

## Motion contract

When `style3d=galaxy` and Motion is enabled:

1. category systems co-rotate around the owner/nucleus;
2. their visual orbital period increases with galactocentric radius using the bounded flat-curve-inspired rule;
3. repositories keep their category membership while following deliberately slow local category orbits, on the same several-minute scale as the 2D Galaxy Hybrid metaphor;
4. Contributed repositories co-rotate on external lanes with the same radial period rule;
5. spiral dust rotates as a separate, slower visual pattern so systems are not glued rigidly to an arm;
6. the far/mid/near decorative star shells remain in an inertial world frame instead of counter-rotating autonomously. Camera movement can still create perspective/depth change, but the background does not compete with or contradict the semantic disc rotation;
7. group/repository labels, selection targets and structural edge endpoints follow the moving meshes;
8. Motion Off freezes the semantic node orbits;
9. the existing reduced-motion-derived default remains respected.

The model is deliberately slow. It should read as a living galaxy over seconds and minutes rather than as a fast mechanical solar-system animation.

## Arm-orientation contract

The semantic group layout and the dust pattern use the same handedness:

- moving semantic systems advance toward decreasing XZ azimuth under the current `rotateXZ` convention;
- successive outward tiers on the same arm start at increasing azimuth;
- therefore the outer part of an arm lies behind the inner part in the direction of rotation: a **trailing spiral**;
- the inner same-arm system has the shorter visual period and accumulates more angular motion than the outer system, preserving differential rotation instead of rigid-disc rotation.

Chromium motion evidence uses two deterministic category systems on successive tiers of the same arm to prove this relationship directly from rendered runtime positions. This is a morphology contract, not a claim that every observed spiral galaxy must trail; unusual leading-arm galaxies are known.

## Edge / line contract

Visible graph lines are **semantic navigation aids, not astrophysical structures or orbital trails**.

For `Galaxy` specifically:

- owner → category ownership and category → repository membership lines remain as very faint structural scaffolding because spatial proximity alone is not always enough to recover exact project membership from an oblique camera angle;
- persistent line opacity is reduced well below the other Three.js styles so the stellar-disc / spiral morphology stays primary;
- long owner → Contributed `contribution` edges are not drawn persistently. Contributed identity is already carried by the external lane, status color/filter and details UI, while a permanent cross-galaxy line can be misread as a physical trajectory and visually cuts across the disc;
- dynamic structural edge endpoints continue to follow moving nodes;
- Cosmic / Aurora / Wireframe keep their existing edge policy.

A future contextual relation highlight may temporarily surface a Contributed relation when its repository is selected or focused, but that is separate from the always-on Galaxy structure.

## Arm-count contract

The Galaxy semantic layout and its spiral dust use the same bounded arm family:

- 2 arms for 1–4 categories;
- 3 arms for 5–8 categories;
- 4 arms above 8 categories.

The dust field uses a more open winding than the generic Cosmic field. This is a visual morphology choice, not a fit to an exact observed pitch angle. Other Three.js styles keep their existing generic four-arm dust treatment.

## Non-goals

- N-body gravity simulation;
- physically scaled galactic time;
- claiming category-local repository motion obeys stellar or planetary gravity;
- claiming repository metadata maps to astrophysical observables;
- claiming graph lines are gravitational, magnetic-field, gas-flow or orbital structures;
- claiming the style is a literal Milky Way reconstruction;
- sacrificing category/ownership readability for strict galactic scale ratios;
- adding large autonomous camera motion.
