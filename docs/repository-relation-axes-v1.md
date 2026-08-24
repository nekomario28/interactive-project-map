# Repository relation axes v1

Status: **experimental assessment contract / separate from production GalaxyGraph relation semantics**

Repository assessment must not encode ownership, collaboration, and fork lineage in one enum. Those facts are independent and can be unknown independently.

## Contract

```text
ownership
  owned
  contributed

collaboration
  solo
  team
  unknown

lineage
  original
  fork
  unknown
```

Examples:

```text
owned solo original
  owned × solo × original

owned team project
  owned × team × original

owned fork with unresolved collaboration
  owned × unknown × fork

external contributed repository
  contributed × unknown × original

external contribution to a fork
  contributed × unknown × fork
```

`fork` is lineage. It does not imply who owns the repository or whether the work is solo/team.

`contributed` is the assessment ownership relation to an externally owned project. It does not imply whether that project itself has one or many collaborators.

## L0 rule

The current public graph can normally establish:

- owned versus contributed;
- original versus fork from the repository fork flag.

It cannot establish solo versus team for every owned repository. Therefore the L0 projection uses:

```text
owned normal repo
  owned × unknown × original

owned fork
  owned × unknown × fork

Contributed normal repo
  contributed × unknown × original

Contributed fork
  contributed × unknown × fork
```

Never default an owned repository to `solo` merely because the portfolio owner owns it.

## Attribution profiles

Prominence calibration reduces validated relation axes to an attribution profile only after preserving the source axes:

```text
direct
  owned × solo × original

team
  owned × team × original

fork
  lineage = fork for owned work

contributed
  ownership = contributed

unresolved
  owned work whose collaboration/lineage still prevents safe direct attribution
```

`direct` is the only profile that can use project prominence directly as personal portfolio prominence without a Personal Contribution gate.

Team, fork, and contributed work require Personal Contribution evidence. Unresolved owned work may retain project-side Quality/Impact/Scale, but personal prominence stays null until attribution is resolved.

## Production graph boundary

This assessment relation object does **not** replace the existing production graph field:

```text
GalaxyNode.relation = contributed
```

The graph field remains the explicit non-ownership presentation/data relation used by current viewers. Assessment consumes it as one source for `ownership = contributed`; it does not mutate graph ownership/membership semantics.

## Invariants

1. ownership, collaboration, and lineage are independently inspectable;
2. unknown never silently becomes solo/team/original;
3. fork lineage never imports upstream merit as authored personal merit;
4. contributed project merit remains visible while personal credit is separately gated;
5. project-side Impact/Scale can be assessed even when collaboration is unresolved;
6. personal prominence is not fabricated from ownership alone;
7. `assessment.json` may carry this richer relation without changing `graph.json`.
