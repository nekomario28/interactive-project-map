# Obsidian text-fade research

## Scope

This note records phase 2B of the Obsidian fidelity pass: repository labels should fade with zoom instead of crossing the Project Map viewer's previous hard visibility cutoff. Spawn/settling was handled in #73 and connectivity-derived node size in #74.

## Primary evidence

### Obsidian Help

Obsidian's Graph view Display settings describe **Text fade threshold** as controlling the text transparency for the name of each note. It is separate from the Node size control.

- https://obsidian.md/help/plugins/graph
- source mirror: https://github.com/obsidianmd/obsidian-help/blob/master/en/Plugins/Graph%20view.md

The important implementation consequence is that the Obsidian-like preset should transition label alpha continuously rather than simply omit every repository label below one zoom value.

### Observed user-facing behavior

Long-standing Obsidian forum examples describe and show the native progression: at a normal zoom titles are visible, after zooming out they become shaded, and farther out they disappear. This matches a transparency curve rather than a binary cutoff.

- https://forum.obsidian.md/t/graph-view-show-note-titles-even-when-zoomed-out/22510

### Node-size-aware fading is not the native contract

A separate feature request asks for the text-fade threshold to consider node size so larger nodes would retain labels from farther away. That request is useful evidence precisely because it distinguishes the desired enhancement from the existing native behavior.

- https://forum.obsidian.md/t/graph-text-fade-threshold-consider-node-size/6737

Decision: do **not** couple the fade threshold to the degree-based node size added in #74. Connectivity controls circle size; zoom controls ordinary label transparency.

## Project Map mapping

The old shared viewer used a hard Obsidian repository-label threshold around zoom `0.58`: below it normal repository labels were absent, above it they appeared at their normal opacity.

The adopted Obsidian-only fade uses a bounded smoothstep:

- zoom `<= 0.36`: ordinary repository labels are omitted;
- zoom `0.36 .. 0.72`: alpha rises continuously with smoothstep;
- zoom `>= 0.72`: ordinary labels reach full label alpha.

The exact numeric interval is a Project Map preset calibration, not a claim about Obsidian's private renderer constant. The fidelity target is the documented/observed **continuous transparency behavior**.

## Exploration exemptions

Three interactions deliberately keep a repository label readable even below the ordinary fade range:

- selected repository;
- hovered repository;
- direct repository search hit.

This preserves the existing Project Map exploration contract while keeping passive overview labels Obsidian-like. Context-only search members are not force-promoted, avoiding a wall of overlapping labels.

## Label priority

When labels compete for space, Obsidian repository priority now uses the connectivity degree already adopted in #74 instead of GitHub stars. This removes the final star-derived importance signal from Obsidian repository label placement without making the fade threshold itself degree-dependent.

## Explicit non-goal: motion fading

Label alpha depends on zoom and interaction state only. Camera pan, pointer movement, simulation velocity, elapsed time, and animation-frame timing are not inputs. This prevents reintroducing the previously rejected behavior where tiny camera motion could dim text.

## Validation

Browser evidence samples the same repository at three fixed zoom levels and requires alpha to be monotonic from absent to partially transparent to effectively full. Separate checks verify that selection, hover, and a direct search hit remain readable at low zoom. The full Chromium and iPhone WebKit suites continue to protect the non-Obsidian presets.

## Deferred

The next isolated fidelity change is incident-link and neighboring-node emphasis on hover. Performance architecture remains unchanged unless measured high-node-count frame cost justifies a worker or Barnes-Hut approximation.
