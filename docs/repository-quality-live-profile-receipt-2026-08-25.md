# Repository Quality live-profile receipt — 2026-08-25

Status: **frozen current-profile projection-equivalent snapshot / CI execution pending / no production assessment publication**

This receipt moves the Quality assessment path from bounded synthetic/envelope cases to the current generated personal profile graph while keeping the source graph and assessment artifact contracts separate.

## Frozen source

```text
profile repository  nekomario28/nekomario28
profile revision    f86924fc5f713003dea2634748a7931169e638f1
source path         project-map/graph.json
graph blob          3a362464cbbf8cef5c94770e813154fef8777780
graph generatedAt   2026-08-24T18:19:46.396Z
```

The source graph reports 14 owned repositories and also contains one explicit contributed repository node, giving 15 repository nodes in the adapter input.

## Why the fixture is projection-equivalent rather than a copy of graph.json

The regression fixture stores only fields consumed by `buildL0RepositoryAssessmentFromGraph()`:

```text
repository identity fields needed by the adapter
stars / forks
fork / archived
Standard Taxonomy category + artifact tags
Contributed relation identity
Contributed commit / merged-PR activity
```

Presentation-only graph fields, long classifier evidence arrays, edges, and taxonomy corpus metadata are omitted because they do not affect the L0 assessment projection.

This keeps the receipt bounded while freezing the exact semantic inputs that drive the adapter. The source commit, graph blob SHA, and generatedAt remain recorded so the projection can be re-derived against the full source when external execution is available.

## Expected L0 diagnostics

The frozen current-profile projection yields:

```text
repositories                       15
owned                              14
contributed                          1
forks                               10
collaboration unknown               15
category observed                   14
category unknown                     1
artifacts observed                  14
artifacts unknown                    1
archived                             0
lifecycle unknown                   15
Impact partial                      15
Impact not-collected                 0
Personal Contribution partial        1
Personal Contribution not-collected 14
```

The only L0 category/artifact hole remains the contributed `c0c25034/ProjExD_4` entry. Existing graph contribution counters still provide partial person-side activity evidence there.

## Bounded Quality enrichment set

Quality enrichment is requested only for repository keys already present in the personal L0 artifact:

```text
nekomario28/interactive-project-map
nekomario28/projexd_group10
nekomario28/gz-sim
nekomario28/turing-smart-screen-python-owl
```

All four have current graph artifact facets compatible with their frozen Quality calibration routes:

```text
interactive-project-map          application
ProjExD_Group10                  application
gz-sim                           library
turing-smart-screen-python-owl   library
```

No external dataset donor is inserted into the personal artifact.

## Expected enrichment diagnostics

```text
repositories before       15
repositories after        15
requested enrichments      4
applied enrichments        4
partial Quality            4
acquisition elevated       4
```

Membership must remain unchanged.

## Expected overlay availability

After Quality enrichment and assessment-to-overlay projection:

```text
projection repositories   15
overlay available           4
overlay unavailable        11
```

Bounded summaries:

```text
interactive-project-map
  targets       6
  interpreted   4
  supports      4
  unknown       2

ProjExD_Group10
  targets       6
  supports      2
  weakens       1
  unknown       3

gz-sim
  targets       6
  supports      3
  unknown       3

turing-smart-screen-python-owl
  targets       6
  supports      3
  unknown       3
```

These are Quality evidence findings and coverage, not repository ranks.

## Relation boundary remains explicit

The current L0 graph does not prove collaboration state. Therefore the L0 assessment sidecar still has:

```text
ProjExD_Group10
  owned × unknown × original

gz-sim
  owned × unknown × fork

turing-smart-screen-python-owl
  owned × unknown × fork
```

Separate L1 receipts have stronger relation evidence for some repositories, but Quality enrichment does not own relation mutation and therefore must not smuggle that evidence into the sidecar.

A later relation-enrichment path can update collaboration/local-delta evidence under its own validation contract.

## Contributed ProjExD_4 boundary

The current graph still exposes the contributed repository without Standard Taxonomy category/artifact facets:

```text
c0c25034/projexd_4
  category   unknown
  artifacts  unknown
```

It does contain partial person-side activity:

```text
commits             1
merged pull requests 1
```

Although a separate L1 semantic receipt has identified this project as game-development + application, the live L0 Quality enrichment path must reject its application Quality vector until that semantic context is updated through its owning enrichment path.

This is intentional fail-closed behavior.

## External donor boundary

The personal current-profile assessment contains no:

```text
fivethirtyeight/data
```

The FiveThirtyEight dataset remains a separate donor-owned calibration artifact. Calibration diversity must not create false personal portfolio membership.

## Claim boundary

If the CI regression passes, this receipt establishes that the fields consumed from the frozen current profile can flow through:

```text
current graph semantic projection
  -> L0 assessment artifact
  -> bounded Quality enrichment
  -> score-free overlay projection
```

while preserving all 15 memberships and making exactly four currently calibrated portfolio overlays available.

It still does not establish:

- production publication of `project-map/assessment.json`;
- live network acquisition inside the default workflow;
- Quality coverage for the remaining 11 repositories;
- L1 relation/lifecycle resolution for the full portfolio;
- final visual accessibility in every renderer/theme;
- Quality ranking, tiers, or Portfolio Prominence.

## Next gate

After exact-head CI validates the frozen live receipt:

1. add a generation path that can write an experimental `assessment.json` candidate without changing default Action outputs;
2. add a non-default Quality feature gate that consumes the validated sidecar projection;
3. keep current Structure mode as default;
4. use compact finding distribution for small static nodes and full dimension identity only in detail/interactive contexts;
5. separately calibrate Portfolio Prominence before allowing Quality to affect node size or label priority.
