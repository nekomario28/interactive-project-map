# Semantic Classification Evidence

Tracking issue: #20

This document records the concrete observations that motivated the semantic-classification redesign. It exists so future work can reproduce the failure modes instead of relying on memory or subjective claims.

## 1. Current implementation inspected

Relevant files at the time of investigation:

- `src/graph.ts`
- `src/github.ts`
- `src/types.ts`

Observed behavior:

1. `searchableText(repo)` combines `name`, `description`, `language`, and `topics`.
2. `normalizeSearch()` lowercases and replaces characters outside `[a-z0-9+#]` with spaces.
3. `classify(repo)` evaluates six fixed keyword groups.
4. if no keyword group wins, `classify(repo)` returns a language-derived group.
5. `fetchPublicRepos()` retrieves repository-list metadata only; README content is not part of classification input.
6. `GitHubRepo` has no README/dependency/semantic fields.

This means semantic category currently depends heavily on sparse GitHub list metadata.

## 2. Concrete failure cases

### 2.1 `nekomario28/lime_tidyup`

GitHub metadata observed:

- description: `LimeSimulDemoのfork. 音声認識から行き先を指定、画像認識からルービックキューブの角度を取得、掴む。`
- primary language: `Python`
- topics: none

Why current classification is fragile:

- the Japanese description is largely removed by ASCII-only normalization;
- the remaining metadata does not necessarily contain a current robotics keyword;
- language fallback can therefore produce `Python`.

README evidence:

- TurtleBot3
- Jetson GPU
- 6-DOF manipulator
- Gazebo
- Behavior Tree
- Nav2
- MoveIt2
- camera analysis

Expected semantic direction:

- primary: **Robotics / ROS 2**
- useful secondary tags: `simulation`, `navigation`, `manipulation`, `vision`, `behavior-tree`
- language remains `Python` as a technical facet only.

### 2.2 `nekomario28/FTBPublicClaims`

GitHub list metadata observed:

- description: empty
- primary language: `Java`
- topics: empty

Current result without enrichment:

- effectively `Java` via fallback.

README evidence begins with:

- Minecraft Forge 1.20.1
- FTB Chunks addon
- public claim management
- FTB Teams integration

Expected semantic direction:

- primary: **Minecraft Modding**
- secondary tags may include `Forge`, `FTB Chunks`, `server`, `claims`.

This is a strong proof that README enrichment can fix a real misclassification without any LLM.

### 2.3 `nekomario28/BuyClaimChunks`

GitHub list metadata observed:

- description: empty
- primary language: `Java`
- topics: empty

Current result without enrichment:

- effectively `Java` via fallback.

README evidence includes:

- `BuyClaimChunks Continued`
- Minecraft 1.21.1
- NeoForge 21.1
- FTB Chunks
- server-side economy addon

Expected semantic direction:

- primary: **Minecraft Modding**
- secondary tags may include `NeoForge`, `FTB Chunks`, `economy`, `server`.

Again, deterministic README evidence is sufficient.

### 2.4 `nekomario28/turing-smart-screen-python-owl`

GitHub metadata observed:

- description: unofficial Python system monitor/library for small IPS USB-C displays
- primary language: `Rich Text Format`
- topics: empty on the fork

Why language fallback is semantically dangerous:

- GitHub's detected primary language is `Rich Text Format`, which says nothing useful about the project's purpose;
- the upstream project is actually a Python smart-display/system-monitor application.

README evidence includes:

- OWL CPU COOLER DISPLAY fork
- USB serial protocol
- small IPS USB-C displays
- Python 3.x
- Raspberry Pi
- system monitoring

Expected semantic direction:

- primary should be a domain such as **Hardware / Embedded**, **System Monitoring**, or a discovered portfolio-specific equivalent;
- technical language should remain independently visible.

This case demonstrates why `language` must not serve as semantic fallback.

### 2.5 `nekomario28/interactive-project-map`

GitHub list metadata observed:

- description: empty at the time of inspection
- primary language: `JavaScript`
- topics: empty

README evidence clearly describes:

- turning GitHub repositories into a reusable project map;
- GitHub Pages viewers;
- interactive search/details/pan/zoom;
- Radial, Galaxy, Obsidian-like, Tree, Treemap, Timeline, Cluster, Sunburst, Matrix, and Sankey presets.

Important observation:

Simply appending README text to the **current six fixed keyword groups** is still insufficient. The project may continue to fall into a language or overly broad Web category because the desired domain may be closer to `Developer Tools`, `Visualization`, `Portfolio Tooling`, or another category not present in the six hard-coded groups.

This is the evidence for **taxonomy discovery**, not just README enrichment.

## 3. What the small experiment established

Using README text as additional input to the existing deterministic idea was enough to recover the obvious domain for at least these cases:

| Repository | Sparse-metadata/fallback direction | README-supported direction |
|---|---|---|
| `lime_tidyup` | Python | Robotics / ROS 2 |
| `FTBPublicClaims` | Java | Minecraft Modding |
| `BuyClaimChunks` | Java | Minecraft Modding |
| `turing-smart-screen-python-owl` | RTF | Hardware / System Monitoring |

`interactive-project-map` is the counterexample showing why README enrichment alone is not the final architecture: its semantic purpose is clear, but the fixed taxonomy may not contain the right class.

Therefore the recommended progression is:

1. preserve Unicode;
2. enrich deterministic evidence with README/manifests;
3. separate language from semantic category;
4. introduce semantic embeddings/relationships;
5. only then introduce portfolio-specific taxonomy discovery;
6. use LLM adjudication only where ambiguity remains.

## 4. Candidate-project assessment

### 4.1 Atomic

Repository: <https://github.com/kenforthewin/atomic>
Verified license: MIT

Assessment: **strong conceptual fit**.

Use:

- semantic-unit model;
- embeddings;
- similarity links;
- automatic/hierarchical tag concepts.

Do not use:

- its complete application/storage architecture as a dependency of this project.

### 4.2 sift-kg

Repository: <https://github.com/juanceresa/sift-kg>
Verified license: MIT

Assessment: **strong fit for schema/taxonomy discovery ideas**.

Use:

- whole-corpus inspection before defining schema;
- persistent/editable discovered schema;
- structured output discipline.

Do not use:

- generic entity/relation knowledge-graph expansion.

### 4.3 Microsoft GraphRAG

Repository: <https://github.com/microsoft/graphrag>
Verified license: MIT

Assessment: **useful later, not for P1**.

Use:

- hierarchical community organization as inspiration once a sparse semantic repository graph exists.

Do not use:

- complete GraphRAG indexing and RAG machinery;
- community detection before semantic-edge quality is established.

### 4.4 `rahulnyk/knowledge_graph`

Assessment: **reference only**.

Its text-to-concept relationship graph is useful for understanding extraction/community patterns but introduces the wrong node granularity for this project.

### 4.5 `hanxiao/knowledge-graph-extractor`

Assessment: **reference only**.

Triple extraction and concept deduplication are substantially heavier than repository classification needs.

## 5. Required regression fixture behavior

Future tests should encode local fixture objects; they should not query these repositories live.

Minimum assertions:

```text
fixture: lime_tidyup
assert semantic category != Python
assert expected family includes Robotics

fixture: FTBPublicClaims
assert semantic category != Java
assert expected family includes Minecraft

fixture: BuyClaimChunks
assert semantic category != Java
assert expected family includes Minecraft

fixture: turing-smart-screen-python-owl
assert semantic category != RTF
assert expected family includes Hardware/System Monitoring

fixture: japanese-description
assert normalized evidence retains Japanese semantic text

fixture: unknown-project
assert semantic category == Other/Uncategorized
assert language remains separately available
```

For P1, exact human labels may remain compatible with the existing groups. Once P3 taxonomy discovery lands, tests should assert category semantics/stable IDs rather than brittle exact labels where appropriate.

## 6. Evidence quality rules

When adding more fixtures, classify evidence by reliability:

### High reliability

- explicit GitHub topic;
- manifest/package identity;
- clear README purpose statement;
- explicit framework/dependency.

### Medium reliability

- repository description;
- repository name;
- fork source description/topic.

### Low reliability for semantic domain

- primary programming language;
- stars/forks counts;
- timestamps.

Language, popularity, and recency may be useful visualization facets, but they should not determine project purpose.

## 7. Decision recorded from this investigation

Do not integrate a full memo/knowledge-graph repository into `interactive-project-map`.

The preferred architecture is a hybrid:

- **Atomic-like** semantic unit + embeddings + sparse similarity;
- **sift-kg-like** corpus-level taxonomy discovery and persistence;
- **GraphRAG-like** optional hierarchical community organization only after semantic graph quality is proven;
- local deterministic README/manifest enrichment before any AI stage.

The invariant is:

> **repository = semantic node; category/language/status = facets; semantic similarity = sparse optional edges.**

See `docs/semantic-classification-plan.md` for the implementation sequence and acceptance criteria.
