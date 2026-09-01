# Three.js Galaxy — astronomy boundary

Status: **2026-09-02**

The Three.js `Galaxy` style is a semantic project map rendered with a spiral-galaxy visual model. It should be astronomically plausible where that improves spatial intuition, but it must not claim that repository/category semantics are literal astrophysical objects.

## Physical principles adopted

The visual/motion model follows these broad spiral-galaxy properties:

- a spiral galaxy is dominated by a flattened stellar disc plus a dense central concentration;
- the qualified Galaxy presentation now includes a **subtle warm central stellar concentration** behind the semantic owner. It is deliberately low-opacity, non-pickable and non-semantic: its role is generic spiral-galaxy morphology, not a physical bulge mass/scale model;
- stars and gas in the disc orbit the galactic centre;
- disc material is predominantly co-rotating rather than arbitrarily alternating orbital direction;
- observed spiral-galaxy rotation curves are much flatter than a luminous-matter-only Kepler-like falloff. The renderer therefore keeps visual tangential speed broadly comparable across most of the semantic disc. With `v ≈ constant`, `T = 2πr / v`, so the visual galactocentric period grows approximately in proportion to radius and outer systems have lower angular speed. This is a **bounded generic optical-disc approximation**, not an assertion that a Milky-Way rotation curve stays exactly flat indefinitely; Gaia DR3 analyses can show a decline beyond the optical disc;
- spiral arms are treated as density/presentation patterns rather than rigid material arms, so the dust/arm pattern has a separate slower pattern speed while semantic systems can move through it;
- the adopted arm chirality is **trailing** relative to the co-rotation direction. Most spiral galaxies are observed with trailing arms, although rare leading-arm systems exist;
- the adopted Galaxy arm geometry is a **logarithmic spiral** with a constant visual pitch angle of **22°**. Logarithmic spirals are a standard approximation for observed galactic arms and pitch angle is the usual measure of how tightly they wind. The 22° value is intentionally a readable generic-spiral choice, not a claim that the Milky Way has that pitch; published Milky Way global estimates are commonly tighter, around the low-teens, while observed spiral galaxies span substantially different pitch angles;
- category-system initial positions and the spiral-dust density pattern use the same pitch convention, so the semantic arm skeleton and the visible arm morphology start coherent before differential rotation shears the semantic systems through the slower pattern;
- the disc has finite vertical thickness. IPM still exaggerates it for readability, but the Galaxy-specific layout is kept substantially flatter than the generic 3D layout;
- the style uses a 2–4 arm visual grammar rather than a one-arm minimum. This is still a semantic visualization, not a literal Milky Way reconstruction, but it better matches the common multi-arm morphology of disk galaxies and current Gaia-informed Milky Way depictions.

Reference background:

- NASA, *Types of Galaxies*: https://science.nasa.gov/universe/galaxies/types/
- NASA, *Barred Spiral Galaxy NGC 1300*: https://science.nasa.gov/asset/hubble/barred-spiral-galaxy-ngc-1300/
- NASA, *Hubble Comes Face-to-Face with Spiral's Arms*: https://science.nasa.gov/missions/hubble/hubble-comes-face-to-face-with-spirals-arms/
- NASA, *Spiral Galaxy NGC 4622 Spins “Backwards”*: https://science.nasa.gov/asset/hubble/spiral-galaxy-ngc-4622-spins-backwards/
- NASA APOD, *Unwinding M51*: https://apod.nasa.gov/apod/ap200821.html
- NASA/JPL, *Astronomers Find a ‘Break’ in One of the Milky Way’s Spiral Arms*: https://www.nasa.gov/centers-and-facilities/jpl/astronomers-find-a-break-in-one-of-the-milky-ways-spiral-arms/
- ESA, *Guide to our galaxy*: https://www.esa.int/Science_Exploration/Space_Science/Gaia/Guide_to_our_galaxy
- ESA/Gaia, *Milky Way*: https://www.cosmos.esa.int/web/gaia/milky-way
- ESA/Gaia, *The rotation curve of the Milky Way based on Gaia DR3*: https://www.cosmos.esa.int/web/gaia/iow_20230927
- ESA, *Anatomy of the Milky Way*: https://www.esa.int/ESA_Multimedia/Images/2016/09/Anatomy_of_the_Milky_Way
- Shen & Zheng, *The Bar and Spiral Arms in the Milky Way: Structure and Kinematics*: https://arxiv.org/abs/2012.10130
- Davis et al., *Measurement of Galactic Logarithmic Spiral Arm Pitch Angle Using Two-Dimensional Fast Fourier Transform Decomposition*: https://arxiv.org/abs/1202.4780

## Product-semantic metaphors kept intentionally

These are **not** astrophysical claims:

- the portfolio owner occupies the nucleus because it is the semantic root, not because a GitHub user represents a black hole or bulge;
- categories are coherent local systems so repository membership remains readable;
- repositories orbiting a category are a 3D continuation of the 2D Galaxy Hybrid interaction metaphor, not a claim that galactic stars orbit spiral-arm labels;
- repository-to-category local orbits intentionally do **not** claim Keplerian gravity. PR #335 makes their UI grammar more explicit: the local path is an ellipse with axis ratio **0.68**, the period family is **`480 + lane×240 s`**, and each category reuses the 2D Hybrid `:hybrid-direction` sign. Three.js deliberately keeps its own compact local packing/radii and maps the existing repository offset onto the ellipse at phase zero, so this is cross-renderer interaction consistency rather than a physical orbit or a literal copy of 2D geometry;
- Contributed repositories remain on clearly external outer lanes because authority/ownership semantics require separation; this is not intended as a literal stellar halo model, and the shared visual period rule must not be read as an extrapolated physical outer-galaxy rotation curve;
- repository/category size, color and luminosity encode project metadata and interaction state, not stellar mass, age or spectrum;
- the decorative central stellar concentration is not the semantic owner, does not encode owner authority, and must not be interpreted as an assigned black-hole/bulge mass;
- graph membership/ownership/contribution relations remain semantic data even though Galaxy no longer draws persistent straight node-to-node lines;
- the style does not force a central stellar bar or Milky-Way-specific warp, because `Galaxy` is a generic semantic spiral style rather than an asserted scale model of our own galaxy.

## Motion contract

When `style3d=galaxy` and Motion is enabled:

1. category systems co-rotate around the owner/nucleus;
2. their visual orbital period increases with galactocentric radius using the bounded flat-curve-inspired rule;
3. owned repositories keep their category membership while following deliberately slow local **0.68-axis-ratio ellipses**. Their period family is **`480 + lane×240 s`** and the per-category local direction uses the same deterministic `:hybrid-direction` seed as 2D Galaxy Hybrid. The 3D renderer retains its existing compact ring/packing as the local lane analogue, and phase zero reproduces the existing repository position rather than causing a re-layout jump;
4. Contributed repositories co-rotate on external lanes with the same radial period rule as a semantic animation policy, not a physical outer-halo claim;
5. spiral dust rotates as a separate, slower visual pattern so systems are not glued rigidly to an arm;
6. the far/mid/near decorative star shells remain in an inertial world frame instead of counter-rotating autonomously. Camera movement can still create perspective/depth change, but the background does not compete with or contradict the semantic disc rotation;
7. group/repository labels, selection targets and selected-camera target follow the moving meshes;
8. Motion Off freezes the semantic node orbits;
9. the existing reduced-motion-derived default remains respected.

`ProjectMapThreejsGalaxyMotion.snapshot()` identifies this local semantic model as `localOrbitModel: "2d-galaxy-hybrid-ellipse"`, with `localOrbitAxisRatio: 0.68` and `localOrbitPeriodModel: "480+lane*240"`. These fields are evidence for renderer behavior, not physical orbital parameters.

The model is deliberately slow. It should read as a living galaxy over seconds and minutes rather than as a fast mechanical solar-system animation.

## Arm-orientation and pitch contract

The semantic group layout and the dust pattern use the same handedness and logarithmic pitch convention:

- moving semantic systems advance toward decreasing XZ azimuth under the current `rotateXZ` convention;
- successive outward tiers on the same arm start at increasing azimuth;
- therefore the outer part of an arm lies behind the inner part in the direction of rotation: a **trailing spiral**;
- before differential shear, same-arm category radii and azimuths recover the adopted ~22° logarithmic pitch through `tan(p) = ln(r₂/r₁) / Δθ`;
- the inner same-arm system has the shorter visual period and accumulates more angular motion than the outer system, preserving differential rotation instead of rigid-disc rotation;
- the slower spiral-dust pattern means the semantic systems are allowed to drift through the visible arm pattern rather than remaining permanently attached to it.

Chromium motion evidence uses two deterministic category systems on successive tiers of the same arm to prove the initial logarithmic pitch, trailing handedness, co-rotation and differential angular speed directly from runtime positions. This is a morphology contract, not a claim that every observed spiral galaxy must trail or share one pitch angle; unusual leading-arm galaxies and strong arm substructure are known.

## Edge / line contract

Visible graph lines, when used by other renderers/styles, are **semantic navigation aids, not astrophysical structures or orbital trails**.

For `Galaxy` specifically, PR #334 supersedes the earlier membership-only presentation:

- **no persistent node-to-node graph lines are drawn**. Galaxy does not create a persistent `THREE.LineSegments` edge object for membership, ownership, contribution or other graph relations;
- canonical graph relations are unchanged. Category → repository membership, owner/category ownership, owner/Contributed contribution and other admitted relations remain available to Search, Local Graph, Category Navigator, focus, filters and selection/details semantics;
- exact category membership is communicated primarily by spatial grouping around category systems plus the existing category/navigation/detail surfaces. Direct rendered comparison found this cleaner than retaining faint straight membership chords in the oblique spiral scene;
- Contributed authority remains carried by external-lane placement, status/filter presentation and details rather than a cross-galaxy chord;
- Motion On therefore has no Galaxy-specific edge endpoint synchronization to maintain; moving semantic meshes, labels and selected targets remain synchronized normally;
- `ProjectMapThreejsGalaxyMotion.snapshot()` reports `edgePolicy: "no-persistent-lines"`, and browser evidence requires `persistentEdgeObjects: 0` with Motion On and Motion Off;
- Cosmic / Aurora / Wireframe keep their existing edge policy.

If a future concrete navigation problem requires relation visualization, prefer a bounded **selected/focused contextual overlay** and qualify it separately. Do not restore always-on Galaxy chords merely because the semantic graph contains those relations.

## Arm geometry / count contract

The Galaxy semantic layout and its spiral dust use the same bounded arm family:

- 2 arms for 1–4 categories;
- 3 arms for 5–8 categories;
- 4 arms above 8 categories.

Within each arm, radial growth follows the same **22° logarithmic pitch** for the category skeleton and dust field. Small deterministic angular jitter prevents a sterile mathematical diagram while preserving the pitch envelope. Other Three.js styles keep their existing generic four-arm dust treatment.

## Non-goals

- N-body gravity simulation;
- physically scaled galactic time;
- claiming category-local repository motion obeys stellar or planetary gravity;
- treating the 0.68 local ellipse, `480 + lane×240 s` period family, direction seed or renderer-local lane packing as astrophysical truth;
- claiming repository metadata maps to astrophysical observables;
- claiming graph relations or any future contextual relation overlay are gravitational, magnetic-field, gas-flow or orbital structures;
- claiming the central decorative concentration is a physical mass model or a literal black-hole/bulge representation;
- claiming the bounded flat-curve-inspired visual rule is an exact Milky-Way rotation curve at all radii;
- claiming 22° is the exact pitch angle of the Milky Way or of spiral galaxies in general;
- claiming the style is a literal Milky Way reconstruction;
- sacrificing category/ownership readability for strict galactic scale ratios;
- adding large autonomous camera motion.
