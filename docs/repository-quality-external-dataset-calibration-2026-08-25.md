# Repository Quality external dataset calibration — 2026-08-25

Status: **frozen external donor calibration / dataset-specific Quality evidence / no composite scores**

This receipt extends the repository Quality calibration beyond application and library artifacts by applying the same evidence/finding/Confidence contracts to a real dataset repository. The donor is external because the current reviewed personal portfolio does not contain a clean dataset-only example; using an external exact-revision donor is preferable to inventing a synthetic repository score.

## Frozen donor

```text
repository   fivethirtyeight/data
revision     4c1ff5e3aef1816ae04af63218015066e186c147
sample path  state-of-the-polls-2024
category     data-analytics
artifact     dataset
lifecycle    snapshot
```

The repository root explains that its datasets and accompanying code back FiveThirtyEight articles/graphics and that datasets are CC-BY-4.0 unless otherwise noted. `index.csv` maps dataset directories to the related published stories. The sampled `state-of-the-polls-2024` directory contains a README plus eight CSV files.

The sampled README documents the story context, poll inclusion window, qualifying poll question types, the 2024 snapshot time, definitions for poll/race columns, and source identities.

## Why this is a dataset calibration rather than an application checklist

The dataset module emphasizes:

```text
understandability
reproducibility
integrity
interoperability
stewardship
```

It does not require CI, unit-test ceremony, releases, or recent commits merely because application repositories commonly expose those mechanisms.

Mechanisms are evidence only when they support a relevant outcome.

## Bounded findings

### Understandability — supports

The sampled dataset README directly documents what the files represent, the selection criteria, timing, field definitions, and sources.

### Reproducibility — supports, bounded to provenance/reconstruction

The README records the selection window, qualifying question types, the as-of timestamp for the 2024 snapshot, and source identities. This is direct evidence that another evaluator can understand the provenance and reconstruct the intended selection logic.

It does **not** prove that a deterministic generation/curation program is present or that regenerating the files from raw upstream data would produce byte-identical outputs.

### Integrity — unknown

This calibration did not inspect a checksum manifest, schema validator, independent row-level validation, or another integrity oracle for the sampled slice.

The existence of CSV files and detailed documentation is not converted into Integrity support by proxy.

### Interoperability — supports

The sampled slice publishes eight CSV files and documents the poll/race fields. CSV plus explicit field definitions is direct repository evidence for machine-readable interchange.

### Stewardship — supports

The repository README states the dataset licensing policy and repository metadata declares CC-BY-4.0.

## Expected Confidence coverage

The dataset route has five REQUIRED/RECOMMENDED target dimensions. Four currently have inspected directional evidence:

```text
target dimensions       5
inspected dimensions    4
directional dimensions  4
inspected coverage      4/5
directional coverage    4/5
```

This is evidence coverage, not a Confidence score.

```text
compositeConfidenceScore = null
```

## Popularity and activity boundary

The donor repository has substantial public popularity, but Stars and Forks are deliberately not included in the Quality evidence vector. They remain Impact evidence.

Likewise, the last commit date is lifecycle/activity context and is not treated as an intrinsic Quality penalty for a published snapshot dataset.

## Claim boundary

This calibration does **not** establish:

- intrinsic scientific/factual validity of the polling data;
- absence of bias or collection error;
- deterministic byte-for-byte regeneration;
- independent external validation;
- universal quality of every dataset directory in the repository;
- a total repository Quality score;
- a Confidence score;
- ranking, tier, or portfolio prominence.

The strongest permitted claim is that this exact repository revision and sampled dataset slice provide direct repository-native evidence supporting Understandability, provenance/reconstruction-oriented Reproducibility, Interoperability, and Stewardship, while Integrity and intrinsic data validity remain unresolved by this calibration.

## Cross-artifact result

The real calibration set now covers:

```text
application
  owned/original-style portfolio cases
  contributed case

library
  fork with observed-absent local default-branch delta
  fork with observed-present local default-branch delta

dataset
  external exact-revision donor
```

This is enough to reject a universal mechanism checklist, but not enough to freeze universal Quality weights.

## Next gate

Before introducing a composite Quality score, compare at least two candidate aggregation families against the frozen real fixtures and counterexamples. Any candidate must:

1. preserve N/A and unknown rather than converting them to zero;
2. avoid rewarding evidence volume twice through both Quality and Confidence;
3. keep weakening evidence capable of lowering a dimension without requiring a universal mechanism;
4. keep Impact, Activity, Scale, Personal Contribution and Confidence out of intrinsic Quality;
5. behave sensibly across application, library/fork, and dataset routes;
6. expose the component vector so no single number becomes the sole authority.

If candidate aggregation cannot satisfy those invariants without arbitrary weights, keep Quality as a dimension vector and move visualization work forward without a composite score.