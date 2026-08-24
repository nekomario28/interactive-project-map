# Repository fork Quality provenance v1

Status: **experimental contract / attribution-safe / no composite score / no production ranking**

Fork repositories need a different Quality contract because a current fork snapshot may contain documentation, tests, CI, release metadata, license terms, architecture and popularity created almost entirely by upstream contributors. Those properties can describe the artifact a user currently holds, but they do not automatically describe the user's own work.

## Three separate layers

A fork assessment therefore keeps three layers separate:

1. **Upstream context** — upstream project Quality, Impact, maturity and ecosystem scale. Context only.
2. **Fork snapshot Quality** — Quality of the current fork contents as delivered. This may mix inherited and local evidence.
3. **Local-delta Quality** — Quality evidence attributable to the locally observed delta or accepted upstream contribution. This is the only fork Quality source eligible for person-side portfolio presentation.

The implementation contract is `ipm-repository-fork-quality-v1`.

## Evidence origin

Fork Quality records provenance independently from Evidence State, Finding Direction and Assessment Authority:

- `local`
- `upstream-inherited`
- `upstream-accepted`
- `mixed`
- `unknown`

Examples:

```text
README exists
origin = upstream-inherited
state = observed
finding = supports
=> snapshot understandability context; not personal Quality

local regression test for fork change
origin = local
state = observed
finding = supports
=> eligible local-delta verification evidence

patch accepted upstream
origin = upstream-accepted
state = observed
finding = supports
=> eligible person-side evidence
```

Per-evidence provenance is retained alongside the derived Quality vector so a later audit can trace the origin of each source claim.

## Portfolio presentation rule

For `lineage=fork`:

```text
fork snapshot Quality
        !=
portfolio Quality ring

portfolio Quality ring
        =
local-delta Quality only
```

A generic repository-snapshot Quality vector is rejected by fork enrichment. A provenance-aware fork bundle is required.

If local delta is unknown, fork portfolio Quality is unavailable rather than zero. If a bounded comparison observes no local delta, portfolio Quality is unavailable for that comparison scope; this does not prove that no non-default branch, review, issue, upstreamed PR, historical change or other contribution exists.

## Current real calibration

### `nekomario28/gz-sim`

The current fork snapshot carries understandable/reproducible/stewarded upstream material, but the bounded default-branch comparison recorded:

```text
gazebosim/main...nekomario28/main
0 commits ahead
2 commits behind
no local-ahead changed files
```

Snapshot Quality remains useful context. The person-side Quality ring is unavailable with reason `no-local-delta-observed-in-comparison-scope`.

### `nekomario28/turing-smart-screen-python-owl`

The bounded comparison recorded a local delta:

```text
mathoudebine/main...nekomario28/main
3 commits ahead
24 commits behind
```

Local-ahead README and dependency changes directly support local-delta Understandability and Reproducibility. The inherited GPL license remains snapshot stewardship context and therefore does **not** become local-delta Stewardship support. The portfolio ring is available from the local-delta vector only.

## Impact and Scale boundary

Upstream Stars/Forks, adoption, release history and ecosystem size remain upstream context. They never become local Impact merely because the repository is forked. Large-upstream context may matter when interpreting contribution difficulty or ecosystem reach, but it must remain explicitly contextual.

## Invariants

- fork snapshot Quality does not imply personal merit;
- inherited evidence cannot enter local-delta Quality;
- accepted upstream evidence may enter person-side evidence;
- local-delta Quality requires observed local work before becoming available;
- unknown local delta is not zero;
- an observed absent delta is bounded to the exact comparison scope;
- no Quality scalar, tier or production ranking is produced;
- Structure geometry, Impact halo and Portfolio Prominence remain separate authorities.

## Migration effect on the current profile

The previous experimental profile sidecar exposed four Quality rings, including two forks evaluated from current snapshot evidence. Under this contract the same four assessment evidence sources remain stored, but presentation becomes:

```text
15 repositories joined
3 portfolio Quality overlays available
12 unavailable
```

The available overlays are the two non-fork calibrated repositories plus the `turing...` local-delta Quality. `gz-sim` keeps snapshot context internally but no person-side Quality ring for the bounded default-branch comparison.
