# Standard Taxonomy v1

`interactive-project-map` is intended for arbitrary GitHub users, so primary project categories must be comparable across users. Portfolio-specific category invention is therefore no longer the preferred primary classification model.

Canonical machine-readable source: [`data/standard-taxonomy.v1.json`](../data/standard-taxonomy.v1.json).

## Design rule

> **Primary category answers what the project is for. Language, platform, artifact form, and ecosystem are separate facets.**

Examples:

- a React dashboard is not automatically `Web`; it may be `Visualization & Knowledge`, with `platform:web`;
- a ROS 2 package is `Robotics & Automation`, with `ecosystem:ros2`;
- a Minecraft mod is `Game Modding`, with `artifact:game-mod` and `ecosystem:minecraft`;
- a GitHub project-map application is `Visualization & Knowledge`, not `Developer Tools`, unless its primary function is actually software development/build/test/debugging.

This avoids the old failure mode where implementation technology (`Java`, `Python`, `Web`) becomes semantic domain.

## Stable v1 primary categories

| ID | Label |
|---|---|
| `ai-ml` | AI & Machine Learning |
| `data-analytics` | Data & Analytics |
| `visualization-knowledge` | Visualization & Knowledge |
| `applications-services` | Applications & Services |
| `developer-tools` | Developer Tools |
| `systems-infrastructure` | Systems & Infrastructure |
| `security-privacy` | Security & Privacy |
| `networking-distributed` | Networking & Distributed Systems |
| `hardware-embedded` | Hardware & Embedded |
| `robotics-automation` | Robotics & Automation |
| `game-development` | Game Development |
| `game-modding` | Game Modding |
| `science-engineering` | Science & Engineering |
| `education-learning` | Education & Learning |
| `media-creative` | Media & Creative |
| `business-productivity` | Business & Productivity |

A repository that cannot be assigned safely remains `Uncategorized`/ambiguous. `general-other` is deliberately not a success category because it hides classifier uncertainty.

## Facets

Primary taxonomy is intentionally small. Additional information belongs in namespaced facets.

### Artifact

Closed vocabulary:

`artifact:application`, `artifact:service`, `artifact:library`, `artifact:framework`, `artifact:tool`, `artifact:game-mod`, `artifact:dataset`, `artifact:model`, `artifact:documentation`, `artifact:template`, `artifact:configuration`, `artifact:firmware`, `artifact:research`, `artifact:other`.

### Platform

Closed vocabulary:

`platform:web`, `platform:desktop`, `platform:mobile`, `platform:cli`, `platform:api`, `platform:server`, `platform:embedded`, `platform:game`, `platform:cross-platform`, `platform:other`.

### Ecosystem and topic

Open but normalized namespaces:

- `ecosystem:github`
- `ecosystem:minecraft`
- `ecosystem:ros2`
- `ecosystem:android`
- `topic:project-visualization`
- `topic:slam`
- `topic:board-game`

GitHub repository Topics are useful evidence for these facets, but Topics are user-defined and do not form the canonical primary hierarchy.

## Relationship to external standards

The taxonomy is pragmatic rather than a copy of one external ontology.

- GitHub Topics are treated as evidence/facets because repositories may define arbitrary topics and GitHub does not expose them as one strict hierarchy.
- ACM CCS is a useful source of vocabulary and hierarchy design, but it is optimized for classifying computing research and is too academic for direct use as a GitHub portfolio UI taxonomy.

The standard should keep stable IDs and may improve labels/descriptions/aliases without breaking graph compatibility. A breaking category split/merge requires a new taxonomy version and an explicit migration table.

## Migration from portfolio-specific taxonomy

The target architecture becomes:

```text
repository evidence
  -> deterministic evidence / semantic document
  -> ipm-standard-v1 primary assignment
  -> namespaced facets
  -> optional local semantic clusters (exploration only)
```

Portfolio-specific discovery may remain useful as an exploratory `localCluster`/community layer, but it must not redefine the canonical primary category for each user.

### Current reviewed 12-repository portfolio mapping

The previous five human-reviewed groups map without losing their useful separation:

- `Minecraft Modding` -> `game-modding` (7)
- `Robotics` -> `robotics-automation` (2)
- `Game Development` -> `game-development` (1)
- `Hardware Integration` -> `hardware-embedded` (1)
- `interactive-project-map` -> `visualization-knowledge` (1)

For `interactive-project-map`, recommended facets are `artifact:application`, `platform:web`, `ecosystem:github`, and `topic:project-visualization`.

## Versioning rules

1. category IDs are API-level stable inside v1;
2. labels may be localized without changing IDs;
3. aliases may grow additively;
4. new facet values may be added additively;
5. changing the semantic meaning of a primary category requires v2;
6. a category should never be added merely to fit one user's portfolio;
7. a portfolio-specific useful grouping belongs in a facet or local cluster until evidence shows it is globally reusable.
