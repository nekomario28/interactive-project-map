# FTBPublicClaims live Quality admission — 2026-08-25

Status: **bounded repository-snapshot admission candidate / exact-head CI required / consumer publication not yet proven**

## Subject and authority

```text
repository       nekomario28/FTBPublicClaims
default branch   public-claim-context
revision         8caaab65266a94e7bdedc6ad2f66030c7e394edf
snapshot date    2026-08-25
```

Only the frozen default-branch snapshot is admitted. Open NeoForge port PR #1 and stacked dependency-range PR #2 remain unmerged and are excluded from this Quality evidence. Their runtime evidence is not copied onto the default-branch repository identity.

## Quality interpretation

Target game-mod dimensions:

```text
Understandability  supports
Verification       unknown
Reproducibility    supports
Maintainability    supports
Interoperability   supports
Stewardship        supports
```

Optional dimension:

```text
Security / Safety  optional + supports
```

Target coverage remains `5 / 6 interpreted`. Verification stays unknown because the default snapshot has no accepted exact-head runtime receipt. Optional Security/Safety does not inflate the target denominator.

## Live selection change

The bounded live source manifest adds one source:

```text
repositoryKey        nekomario28/FTBPublicClaims
mode                 repository-snapshot
case                  ftbpublicclaims-game-mod-default-8caaab
presentationExpected available
```

Expected assessment/presentation cardinality becomes:

```text
repository membership         15 unchanged
bounded assessment sources     7
Quality available              6
Quality unavailable            9
```

Evidence freshness remains truthful:

```text
snapshot dates   2026-07-25, 2026-08-25
oldest           2026-07-25
newest           2026-08-25
automaticRefresh false
```

BuyClaimChunks remains the older `2026-07-25` local-delta source; this FTBPublicClaims admission does not refresh it.

## Preserved boundaries

- `productionScoring=false` and every production score remains null.
- No composite Quality score, Confidence score, tier, ranking, Portfolio Prominence, node size, placement, label-priority, Impact-halo, Structure-default, or stable-v1 authority is introduced.
- `gz-sim` remains unavailable/local-delta because no attributable local delta was observed in scope.
- `turing-smart-screen-python-owl` remains available/local-delta; inherited stewardship is not converted into personal Quality.
- BuyClaimChunks remains available/local-delta and excludes inherited upstream Quality plus its unmerged feature carrier.
- AntiFullbright remains available/repository-snapshot with Maintainability unknown and optional Security/Safety support.

## Remaining gate

Before consumer publication:

1. run the full exact-head IPM Verify gate for this live selection;
2. require full Verify, twelve-preset comparison, Chromium E2E, iPhone WebKit smoke, and browser evidence upload to pass;
3. pin that exact tested producer revision in the profile publisher;
4. generate from the real profile graph and validate `15 joined / 6 available / 9 unavailable` plus the attribution, freshness, scoring, and Structure invariants;
5. only then allow the profile workflow to publish `assessment.json` and `quality-presentation.json`.
