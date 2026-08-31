# Three.js Galaxy — astronomy boundary

Status: **2026-09-01**

The Three.js `Galaxy` style is a semantic project map rendered with a spiral-galaxy visual model. It should be astronomically plausible where that improves spatial intuition, but it must not claim that repository/category semantics are literal astrophysical objects.

## Physical principles adopted

The visual/motion model follows these broad spiral-galaxy properties:

- a spiral galaxy is dominated by a flattened stellar disc plus a dense central concentration;
- stars and gas in the disc orbit the galactic centre;
- disc material is predominantly co-rotating rather than arbitrarily alternating orbital direction;
- outer disc material has lower angular speed than inner material; the implementation uses a bounded, flat-rotation-curve-inspired visual period that increases with radius while keeping the visual tangential speed broadly comparable across most of the disc;
- spiral arms are treated as density/presentation patterns rather than rigid material arms, so the dust/arm pattern has a separate slower pattern speed while semantic systems can move through it;
- the disc has finite vertical thickness, but IPM exaggerates that thickness slightly so overlapping repositories remain readable in an interactive 3D view.

Reference background:

- NASA, *Types of Galaxies*: https://science.nasa.gov/universe/galaxies/types/
- NASA, *Dark Matter 101: Looking for the Missing Mass*: https://science.nasa.gov/universe/stories/quick-reads/dark-matter-101-looking-for-the-missing-mass/
- ESA, *Guide to our galaxy*: https://www.esa.int/Science_Exploration/Space_Science/Gaia/Guide_to_our_galaxy
- ESA/Hubble, *Face to face with a spiral’s arms*: https://www.esa.int/ESA_Multimedia/Images/2025/05/Face_to_face_with_a_spiral_s_arms
- ESA/Hubble, *Seeing things sideways*: https://www.esa.int/ESA_Multimedia/Images/2017/03/Seeing_things_sideways

## Product-semantic metaphors kept intentionally

These are **not** astrophysical claims:

- the portfolio owner occupies the nucleus because it is the semantic root, not because a GitHub user represents a black hole or bulge;
- categories are coherent local systems so repository membership remains readable;
- repositories orbiting a category are a 3D continuation of the 2D Galaxy Hybrid interaction metaphor, not a claim that galactic stars orbit spiral-arm labels;
- Contributed repositories remain on clearly external outer lanes because authority/ownership semantics require separation; this is not intended as a literal stellar halo model;
- repository/category size, color and luminosity encode project metadata and interaction state, not stellar mass, age or spectrum.

## Motion contract

When `style3d=galaxy` and Motion is enabled:

1. category systems co-rotate around the owner/nucleus;
2. their visual orbital period increases with galactocentric radius;
3. repositories keep their category membership while following slower local orbits around that category;
4. Contributed repositories co-rotate on external lanes with the same radial period rule;
5. spiral dust rotates as a separate slower pattern;
6. group/repository labels, selection targets and edge endpoints follow the moving meshes;
7. Motion Off freezes these semantic node orbits;
8. the existing reduced-motion-derived default remains respected.

The model is deliberately slow. It should read as a living galaxy over seconds rather than as a mechanical solar-system animation.

## Arm-count contract

The Galaxy semantic layout uses:

- 1 arm for 1–3 categories;
- 2 arms for 4–8 categories;
- 3 arms above 8 categories.

Galaxy spiral dust must use the same arm count. Other Three.js styles keep their existing generic four-arm dust treatment.

## Non-goals

- N-body gravity simulation;
- physically scaled galactic time;
- claiming repository metadata maps to astrophysical observables;
- sacrificing category/ownership readability for strict Milky-Way scale ratios;
- adding large autonomous camera motion.
