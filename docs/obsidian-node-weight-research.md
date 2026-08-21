# Obsidian repository node-weight research

## Scope

This note records the phase-2A decision for repository node size in the `obsidian` preset. Spawn and force lifecycle were handled separately in PR #73; this change only replaces GitHub-popularity sizing with graph-connectivity sizing and makes the physics collision radius follow the same source of truth.

## Evidence

### Obsidian Help

Obsidian documents node-size controls and states that files referenced by more files appear larger in Graph view. This makes link structure, rather than an external popularity metric, the appropriate semantic source for Obsidian-like node importance.

- https://obsidian.md/help/plugins/graph

### Node Factor (`CalfMoon/node-factor`)

The MIT-licensed Node Factor plugin modifies Obsidian renderer node `weight`. Its calculator derives weight from reverse links and forward links (or a forward-link tree), with optional file-size contribution. This is useful implementation evidence that Obsidian graph size can be treated as a function of graph connectivity and written independently of node identity or external popularity.

- https://github.com/CalfMoon/node-factor
- License: MIT
- Relevant files: `src/main.ts`, `src/calculator.ts`

No Node Factor code is copied into Project Map. The adopted calculation is smaller and tailored to Project Map's visible graph model.

## Project Map mapping

Project Map has synthetic `owner` and `group` nodes in addition to repositories, so copying a note-only Obsidian weight formula literally would overstate synthetic hierarchy nodes. The adopted rule is therefore:

- owner radius remains fixed;
- group radius remains fixed;
- repository weight is the number of **unique visible incident neighbors**;
- membership gives each categorized repository its structural baseline connection;
- explicit relation and sanitized semantic relation edges add connectivity;
- duplicate edges to the same neighbor count once;
- GitHub stars do not contribute to Obsidian repository radius.

The visual radius is bounded and logarithmic:

`radius = clamp(5.5 + log2(degree + 1) * 1.65, 5.5, 12)`

The Obsidian force collision radius uses the same visual radius plus a small fixed margin. This avoids a renderer/physics mismatch where a visually important node is still treated as a small particle by the force solver.

## Isolation

The shared viewer's original star-based radius remains the fallback for Galaxy presentations. The Obsidian runtime wraps `nodeRadius` only while `state.style === "obsidian"`; switching to a Galaxy preset restores the existing behavior automatically.

## Validation contract

Browser validation uses repositories with deliberately conflicting signals: a zero-star repository with multiple graph neighbors and a 1024-star repository with fewer neighbors. The Obsidian preset must render the connected zero-star repository larger, while Galaxy Classic must still render the high-star repository larger. The fixture also contains a duplicate relation and a semantic relation so the test verifies unique-neighbor deduplication and the existing semantic-edge bridge.

## Deferred

This change intentionally does not alter label visibility or edge hover styling. Those remain separate fidelity passes:

1. Obsidian-style zoom-dependent text fade, with selected/hovered/search-relevant labels protected;
2. incident-link and neighbor emphasis on hover;
3. only after measurements, performance changes such as a worker or Barnes-Hut approximation.
