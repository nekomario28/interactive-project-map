# Future UI TODOs

This file records deferred cross-preset interaction work that should remain compatible with the static-first architecture and the shared standard taxonomy.

## Search-aware repository/category highlighting

Status: **planned, not implemented**.

Add one shared interactive search contract for all browser viewers that expose repository/category nodes.

### Desired behavior

- Search repository names, descriptions, standard-category labels/aliases, topics, and namespaced facets.
- A repository hit highlights the matching repository **and its standard primary category**.
- A category hit highlights the category and gives its member repositories a softer contextual highlight.
- Direct repository hits must remain visually stronger than repositories shown only because their category matched.
- Non-matching nodes should normally be **dimmed rather than removed**, preserving spatial context and avoiding layout jumps.
- Selected and hovered nodes keep precedence over passive search highlighting.
- Search results should expose the reason for a match where practical, for example `repo name`, `category`, `ecosystem:github`, or `topic:project-visualization`.
- Keyboard navigation should be able to move through direct repository hits without forcing a graph relayout.
- Clearing search must restore the exact pre-search visual/physics state.

### Preset policy

- Galaxy Classic / Systems / Hybrid: highlight matched repository systems while preserving existing LOD and orbit behavior.
- Obsidian-like: change visual emphasis only; search must not rewrite the historical global force law or pin nodes.
- Tree / Radial / Sunburst / Treemap / Cluster: emphasize the matched category path/region while keeping hierarchy geometry stable.
- Matrix / Sankey / Timeline: highlight the relevant category/repository contribution without changing aggregation semantics.
- Static SVGs remain static; this TODO targets interactive viewers unless a separate non-interactive search/export concept is designed later.

### Standard-taxonomy interaction

Search should use the shared `ipm-standard-v1` primary category IDs as the stable cross-user vocabulary. Technology/ecosystem matches such as GitHub, ROS, Minecraft, React, Python, or Java belong in facets/evidence and should not silently become new primary categories.

Example:

```text
query: project visualization
  → direct repo hit: interactive-project-map
  → primary category context: visualization-knowledge
  → optional facet reasons: ecosystem:github, topic:project-visualization
```

### Implementation guardrails

- Implement the search/highlight state in a shared browser layer rather than separately in 12 runtimes where possible.
- Do not mutate generated `graph.json` merely because the user searched.
- Do not trigger embedding/LLM requests from the browser.
- Keep search deterministic and local over already-generated graph data.
- Add Chromium + iPhone WebKit regression coverage for repo-hit, category-hit, clear-search, selected-node precedence, and no-layout-jump behavior.
