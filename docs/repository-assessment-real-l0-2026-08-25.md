# Repository assessment real L0 receipt — 2026-08-25

Status: **observed portfolio snapshot / no Quality, Impact, Scale, Personal Contribution, or Prominence score claimed**

This receipt records the first real-profile pass through the experimental repository-assessment L0 contract. It exists to choose the next bounded acquisition work from evidence rather than deep-scanning every repository.

## Source identity

- portfolio repository: `nekomario28/nekomario28`
- graph path: `project-map/graph.json`
- graph blob: `775b3803bca4dae9c271517b7ac08adecf421bf8`
- graph `generatedAt`: `2026-08-24T15:37:16.907Z`
- graph declared owned `repositoryCount`: `14`
- graph declared `contributedRepositoryCount`: `1`
- assessment adapter: `scripts/repository-assessment-from-graph.mjs`

The graph contains 15 repository nodes total: 14 owned and 1 explicit Contributed repository.

## L0 diagnostics after Standard Taxonomy authority hardening

```text
repositories          15
owned                 14
contributed             1
fork lineage           10
collaboration unknown  15
category observed      14
category unknown        1
artifacts observed     14
artifacts unknown       1
archived                0
lifecycle unknown      15
```

L0 therefore has strong semantic-routing coverage but intentionally weak authorship/lifecycle coverage.

### Observed Standard Taxonomy categories

```text
game-modding             7
robotics-automation       3
ai-ml                     1
game-development          1
hardware-embedded         1
visualization-knowledge   1
```

### Observed artifact facets

```text
game-mod        7
library         3
application     3
documentation   1
```

The single category/artifact unknown is the explicit Contributed repository `c0c25034/ProjExD_4`. Its legacy classifier says `uncategorized`; that is not a Standard Taxonomy v1 category and must remain unknown rather than being promoted into assessment context.

## Bug found by the real pass

The first L0 adapter version accepted any non-empty legacy `classification.categoryId` when `taxonomyAssignment` was absent. On this real graph that would have counted `uncategorized` as an observed Standard Taxonomy category for the Contributed repository.

The corrected rule is:

```text
taxonomyAssignment.categoryId
  use only when id exists in Standard Taxonomy v1

legacy classification.categoryId fallback
  use only when id itself exists in Standard Taxonomy v1

otherwise
  category = unknown
```

Legacy ids such as `uncategorized`, `minecraft`, `robotics`, `hardware`, and `web-apps` are not silently converted into assessment categories.

## What L0 does not establish

All 15 repositories retain `collaboration = unknown`. Namespace ownership is therefore not proof of solo authorship.

All 15 repositories are non-archived in this snapshot, but non-archived does not establish `active`, `stable`, `maintenance`, `frozen`, or another lifecycle. Their lifecycle remains unknown at L0.

The ten forks require local-delta/upstream separation before personal attribution. The one Contributed repository requires person-side contribution evidence before personal prominence.

No repository receives a Quality, Impact, Scale, Personal Contribution, project-prominence, personal-prominence, or production score from this receipt.

## Bounded L1 sample

Do not deep-scan all 15 by default. Start with a structurally diverse sample that exercises the attribution and artifact boundaries:

| Repository | L0 shape | Why L1 matters |
| --- | --- | --- |
| `interactive-project-map` | owned / original / application / visualization | owned-original baseline; resolve collaboration and lifecycle without assuming solo |
| `ProjExD_Group10` | owned / original / application / game-development | non-fork with stars/forks; likely collaboration-sensitive baseline |
| `FTBPublicClaims` | owned / original / game-mod | zero-star original artifact; protects Quality-vs-Impact separation |
| `antifullbright` | owned / original / game-mod | second original mod with different verification/security context |
| `gz-sim` | owned / fork / library / robotics | large-upstream fork; local delta must not inherit upstream reputation |
| `turing-smart-screen-python-owl` | owned / fork / library / hardware | fork in a different artifact/domain boundary |
| `FreeToken` | owned / fork / application / ai-ml | forked application/AI boundary |
| `c0c25034/ProjExD_4` | contributed / original / category+artifact unknown | explicit non-ownership; contribution gate and missing semantic context |

This is a calibration sample, not a ranking shortlist.

## L1 acquisition priorities

For the bounded sample, acquire only evidence that resolves a material decision:

1. collaboration state: solo / team / still unknown;
2. lifecycle declaration/evidence where available;
3. fork parent identity and local-delta evidence for fork lineage;
4. direct person-side contribution/responsibility for team/fork/contributed work;
5. missing Standard Taxonomy category/artifact context for Contributed work when trustworthy evidence exists;
6. Quality evidence mechanisms only according to artifact applicability;
7. Impact inputs such as stars/forks remain project-side and separate from Quality;
8. Scale evidence remains breadth/coordination, not LOC/commit mass.

Only after those evidence vectors exist should `balanced-v1` or another prominence candidate be evaluated on real normalized components.

## Reopen / next gate

The next gate is complete when the bounded sample can produce inspectable evidence vectors with explicit unknown/N/A states and no attribution leakage. Production tier thresholds, SVG geometry, and stable `v1` promotion remain out of scope until that calibration exists.
