# BuyClaimChunks live Quality admission — 2026-08-25

Status: **bounded fork-local-delta admission candidate / exact-head CI required / consumer publication not yet proven**

## Subject and authority

```text
repository       nekomario28/BuyClaimChunks
consumer scope   repository default branch
branch           main
default branch   main
revision         22d7adcbe5f711a3bc7e2cb8593c60e19838dce1
upstream         SkyAdri-mc/BuyClaimChunks
upstream base    3ff3da62fd8addf319165d8018d1b795be7f5187
compare          21 commits ahead / 0 behind
```

The Quality overlay is attributable only to the observed fork-local delta. Inherited upstream Quality is not person-side Quality evidence.

The unmerged universal FTB/OpenPAC feature PR #8 is outside this admission. Its stronger feature-carrier evidence is not copied onto the current default-main identity.

## Frozen evidence

Evidence event date:

```text
2026-07-25
```

Calibration observation date:

```text
2026-08-25
```

These dates remain distinct. Assembling or admitting the calibration on August 25 does not refresh the July 25 runtime evidence.

Exact default-main push validation:

```text
BuyClaimChunks Build #37
run 30166821071
head 22d7adcbe5f711a3bc7e2cb8593c60e19838dce1
result SUCCESS
```

The run explicitly checked out the exact revision and passed:

- Java 21 unit tests and clean build;
- packaged release-JAR verification;
- all six required NeoForge GameTests;
- real `/buyclaim` purchase with FTB Chunks quota `0 -> 1` and payment `4 -> 0`;
- normal shutdown persistence;
- second-JVM reload of the persisted personal quota;
- clean dedicated-server startup to Minecraft `Done`;
- build/evidence artifact upload.

Recorded build artifact upload digest:

```text
sha256:3fbaa4eecba431bafdf24b051c0353395f83477c6f144c39bc37062ce03aac88
```

This proves bounded artifact identity for that successful run. It does not prove byte-identical independent rebuild determinism.

## Calibration producer proof

The frozen local-delta calibration was added in:

```text
interactive-project-map 1f5b2f42c4a15688ead7502779511fa72a299481
```

Exact-head probe:

```text
PR #231
Verify #945
run 32820983150
```

The full producer gate passed:

- full Verify;
- twelve-preset comparison;
- Chromium browser E2E;
- iPhone WebKit smoke;
- browser evidence upload.

## Quality interpretation

Target game-mod dimensions:

```text
Understandability  supports
Verification       supports
Reproducibility    supports
Maintainability    unknown
Interoperability   supports
Stewardship        supports
```

Optional dimension:

```text
Security / Safety  optional + supports
```

Target coverage remains `5 / 6 interpreted`. Optional Security/Safety evidence does not inflate the target denominator.

No composite Quality score, Confidence score, tier, ranking, Portfolio Prominence, node size, placement, or Structure authority is introduced.

## Live selection change

The bounded live source manifest deliberately adds one new source:

```text
repositoryKey        nekomario28/BuyClaimChunks
mode                 fork-local-delta
case                  buyclaimchunks-fork-local-default-main-1.1.1
presentationExpected available
```

Expected assessment/presentation cardinality becomes:

```text
repository membership         15 unchanged
bounded assessment sources     6
Quality available              5
Quality unavailable           10
```

Because BuyClaimChunks evidence is older than the other currently presented sources, the truthful presentation freshness becomes:

```text
snapshot dates   2026-07-25, 2026-08-25
oldest           2026-07-25
newest           2026-08-25
automaticRefresh false
```

This is intentional. Adding a source must not launder its evidence date to the admission or publication date.

## Remaining gate

This producer-side admission candidate is not yet proof of production publication.

Before production publication:

1. run the full exact-head IPM Verify gate with this live selection;
2. pin that exact tested IPM revision in the real profile Quality workflow;
3. generate from the real profile graph;
4. validate 15 joined / 5 available / 10 unavailable;
5. validate BuyClaimChunks remains `local-delta`, Maintainability remains unknown, Security/Safety remains optional, and its freshness remains `2026-07-25`;
6. validate existing four available overlays retain their prior semantics and `2026-08-25` frozen evidence dates;
7. only then allow the profile workflow to publish the sidecars.

BuyClaimChunks PR #8 remains untouched and requires its own explicit merge/release authorization.
