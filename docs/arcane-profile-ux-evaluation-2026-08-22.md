# Arcane / Profile Galaxy UX evaluation — 2026-08-22

Status: **experimental, implementation-backed**

Branch: `experiment/arcane-ipm-styles`

Implementation: `experiments/arcane-styles/v2/index.html`

## Why this experiment exists

The first Arcane Circle / Detonation Array / Techno Arcana / Celestial Orrery sketches established visual direction but were too decoration-heavy to treat as production candidates. The second pass starts from the actual GitHub profile target size, **740×420**, and tests readability plus navigation rather than visual atmosphere alone.

The experiment intentionally keeps the existing Project Map semantic level: **Owner → Category → Repository**. It does not add file/function/class graphs or RepoGraph-style code analysis.

## Implemented v2 candidates

### Arcane Circle v2

- Category sectors are the primary structure.
- Decorative magic-circle geometry is reduced by roughly 60–70% compared with the first sketch.
- Category labels and repository labels have higher contrast and more whitespace.
- The magic circle is now a framing device for the hierarchy instead of competing with it.

### Techno Arcana v2

- Side telemetry/HUD panels are removed.
- Owner, category hubs, repositories and their direct hierarchy are the only first-class information.
- Circuit/arcane styling remains as a restrained visual language.

### Celestial Orrery v2

- Category = star/system center.
- Repository = planet.
- Category → Repository is therefore explicit spatial parent/child structure rather than decorative orbiting.
- This is the clearest of the three candidates for communicating hierarchy without following many edges.

### Detonation

Detonation is no longer treated as a standalone preset candidate. It is implemented as a **focus effect** over the readable Techno Arcana base.

For the `Civitas` focus proof, unrelated nodes remain visible but dimmed while the selected repository receives a bounded burst and its strong contextual relations (`Minecraft`, `AI/RAG`) are disclosed.

## Category navigator experiment

The 740×420 implementation adds a persistent category list beside the map.

Each category has two deliberately separate actions:

1. **Category label click → focus that category.**
2. **+/− disclosure control → expand/collapse the repository list without changing focus.**

Repository rows then provide persistent repository focus.

This separation is important. An earlier local revision coupled category focus and expansion to the same click. That worked mechanically but made the interaction ambiguous: users could not know whether clicking the row was navigation or disclosure. The final prototype separates them.

## Interaction gate executed

The prototype was rendered in a real Chromium browser at a **740×420 viewport** and the following interaction sequence was executed:

1. Start with no category expanded and no focus.
2. Press `+` on `Systems`.
   - `Systems` repository list becomes visible.
   - focus remains unchanged.
3. Click the `Systems` category label.
   - focus becomes `Systems`.
   - unrelated category/repository content is dimmed, not removed.
4. Click `microfactory-lab` from the expanded list.
   - focus becomes `microfactory-lab`.
   - global context remains visible.
5. Clear focus.
   - full map returns without destroying the expanded/collapsed category state.

Result: **PASS for the small-profile usability hypothesis.**

## What appears worth keeping

### Strong candidate: persistent category navigator

The category list solves a real graph-navigation problem rather than merely adding decoration. It gives users a stable textual index when spatial labels become dense or when a category is visually distant.

Recommended semantics:

- category list remains visible on interactive desktop layouts when space permits;
- disclosure state is independent from focus state;
- category focus dims unrelated content instead of filtering it away;
- repository selection is persistent until clear/select another item;
- search results should eventually be able to expand the relevant category and focus the matching repository using the same state model.

### Strong candidate: Detonation as focus-only feedback

The bounded focus burst is useful because it answers “what did I just select?” and can reveal strong relations without turning the idle graph into a spaghetti graph.

Do **not** run the burst continuously and do not use it as the idle visual language.

### Promising candidate: Celestial Orrery hierarchy

At 740×420, category-star → repository-planet mapping is easier to parse than the first Orrery sketch. It deserves a real-data comparison against Galaxy Systems/Hybrid.

### Conditional candidate: Arcane Circle v2

The sector model is much more readable than v1, but it needs a real 20–80 repository test before promotion. The key question is whether sector allocation stays readable without shrinking repository labels below the profile threshold.

### Conditional candidate: Techno Arcana v2

The stripped version is substantially cleaner, but its value over existing graph presets may be mostly visual. It should only become a preset if real-data tests show a readability or navigation advantage, not merely because it looks different.

## Non-goals / rejected directions

- Do not restore large telemetry/HUD panels to the README-sized view.
- Do not make Detonation an always-on standalone preset.
- Do not let decorative rings, runes, bloom or circuit traces outrank repository labels.
- Do not couple expand/collapse with category focus.
- Do not hide all unrelated nodes during focus; preserve global context.
- Do not add a new `graph.json` schema solely for these visual experiments.

## Next evidence gate before any production preset work

No v2 candidate is production-approved yet. The next useful gate is:

1. drive the prototypes from the same real `graph.json` used by existing presets;
2. compare at **740×420** with representative small and medium profiles;
3. run the existing 100/300-repository dense stress where applicable;
4. compare category/repository identification time against Galaxy Systems, Galaxy Hybrid and Obsidian-like;
5. verify keyboard/touch behavior for category disclosure and focus;
6. verify reduced-motion behavior for Detonation;
7. only then decide whether Arcane Circle, Techno Arcana or Orrery deserves a production preset ID.

The current decision is therefore:

> **Keep the category navigator and focus-state ideas as real product candidates; keep the three visual styles experimental until real-graph readability evidence exists.**
