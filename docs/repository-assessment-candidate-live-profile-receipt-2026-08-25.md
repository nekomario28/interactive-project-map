# Current-profile assessment candidate CLI receipt — 2026-08-25

Status: **executable frozen-profile candidate-generation receipt / exact-head CI required / no production publication**

This receipt verifies the explicit experimental assessment candidate CLI against the same frozen current-profile projection that already passed the full L0 + bounded Quality enrichment receipt.

## Frozen inputs

Profile source:

```text
repository   nekomario28/nekomario28
revision     f86924fc5f713003dea2634748a7931169e638f1
path         project-map/graph.json
graph blob   3a362464cbbf8cef5c94770e813154fef8777780
generatedAt  2026-08-24T18:19:46.396Z
```

Candidate generator revision:

```text
0b4caf1dcdd2f67fe35f772afce45b8782112209
```

The regression uses `fixtures/repository-assessment-live-profile-minimal-2026-08-25.json`, which is the projection-equivalent frozen subset of the source graph containing exactly the fields consumed by the L0 assessment adapter.

## Why the Quality bundle is temporary

The four current portfolio Quality vectors already have canonical frozen evidence fixtures:

```text
repository-quality-real-calibration.v1.json
repository-quality-fork-library-calibration.v1.json
```

The CLI regression derives the Quality vectors from those existing fixtures and writes a temporary bundle during the test.

This avoids committing another long-lived copy of the same Quality vectors while still exercising the actual file-based CLI path:

```text
frozen graph input file
       +
temporary policy-matched Quality bundle file
       ↓
repository-assessment-candidate.mjs
       ↓
assessment.json candidate
       +
diagnostics.json
```

The temporary bundle is an input transport envelope only. `assessment.json` remains the sole packaged assessment sidecar candidate.

## Expected candidate

The generated assessment candidate must preserve:

```text
owner                 nekomario28
repositories          15
owned                  14
contributed             1
forks                  10
Impact partial         15
Personal Contribution partial 1
productionScoring     false
productionScore       null for every repository
```

Quality enrichment is limited to four repository keys already present in the graph-derived assessment membership:

```text
nekomario28/interactive-project-map
nekomario28/projexd_group10
nekomario28/gz-sim
nekomario28/turing-smart-screen-python-owl
```

Expected Quality diagnostics:

```text
repositoriesBefore     15
repositoriesAfter      15
requested                4
applied                  4
partial                  4
acquisitionElevated      4
```

No repository may be added or removed by Quality enrichment.

## Expected presentation projection

The generated candidate is then passed through the canonical assessment-to-Quality overlay projection.

Expected result:

```text
projection repositories 15
overlay available         4
overlay unavailable      11
```

The contributed repository:

```text
c0c25034/projexd_4
```

must remain:

```text
category              unknown
artifacts             unknown
Quality               not-collected
Personal Contribution partial
```

because Quality enrichment does not own semantic-context or relation enrichment.

## Attribution boundary

The personal candidate must not contain:

```text
fivethirtyeight/data
```

The external dataset remains a calibration donor under its own owner context. File-based candidate generation does not weaken the donor-vs-portfolio boundary.

## Input immutability

The CLI regression records the graph input bytes before execution and requires them to be byte-identical afterward.

This verifies that the explicit generator remains a projection step rather than an in-place graph migration.

## Determinism

For identical:

```text
frozen graph
Quality bundle
generator revision
```

the generated assessment JSON and diagnostics JSON must be byte-identical across repeated executions.

This is important before introducing any opt-in Action output because a static portfolio artifact should not change when its evidence inputs do not change.

## Claim boundary

If the exact-head CI probe passes, this receipt establishes an end-to-end experimental path:

```text
current frozen profile semantics
  -> explicit graph input file
  -> explicit bounded Quality bundle file
  -> candidate CLI
  -> validated 15-repository assessment artifact
  -> Quality overlay projection
  -> 4 available / 11 unavailable overlays
```

It does **not** establish:

- production publication of `project-map/assessment.json`;
- a default GitHub Action assessment output;
- Quality acquisition for the remaining 11 repositories;
- L1 relation/lifecycle enrichment for the full profile;
- final viewer accessibility or responsive geometry;
- Quality scalar scoring, ranking, tiers, or Portfolio Prominence.

## Next gate

After exact-head validation, the next bounded integration should be a renderer-neutral experimental Quality presentation artifact produced from the validated candidate:

```text
assessment candidate
  -> assessment-to-overlay projection
  -> experimental Quality presentation model / SVG fixture
```

Keep Structure mode and all current default outputs unchanged. The first renderer integration should be explicitly non-default and must preserve unavailable Quality as unavailable rather than fabricating all-unknown rings.
