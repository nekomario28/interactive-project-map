# Repository assessment candidate CLI v1

Status: **explicit experimental generator / not wired into default Action output / assessment.json candidate only**

The assessment contracts now support a full graph-derived L0 artifact, bounded Quality enrichment, and score-free Quality projection. This CLI provides an explicit way to write that candidate artifact without changing the existing project-map generation workflow.

Implementation:

```text
scripts/repository-assessment-candidate.mjs
```

## Explicit invocation only

Minimum invocation:

```bash
node scripts/repository-assessment-candidate.mjs \
  --graph path/to/graph.json \
  --out path/to/assessment.json \
  --generator-revision <exact-40-hex-revision>
```

Optional arguments:

```text
--quality-enrichments <bundle.json>
--diagnostics-out <diagnostics.json>
--generated-at <ISO timestamp>
--prominence-candidate-id <experimental candidate id>
```

There is intentionally no default Action output change and no production `quality.json` file.

## Generation pipeline

```text
input graph.json
  ↓ validate basic graph shape
buildL0RepositoryAssessmentFromGraph()
  ↓
validated L0 assessment artifact
  ↓ optional
bounded Quality enrichment bundle
  ↓ enrichAssessmentArtifactQuality()
validated assessment candidate
  ↓
write explicit --out path
```

The input graph is never modified.

## Output overwrite safety

The CLI rejects:

```text
assessment output == graph input
diagnostics output == graph input
diagnostics output == assessment output
assessment output == Quality enrichment bundle
diagnostics output == Quality enrichment bundle
```

Output directories may be created, but input files are not rewritten.

## Optional Quality enrichment bundle

The CLI accepts a bundle with this experimental envelope:

```json
{
  "schemaVersion": 1,
  "assessmentPolicyId": "ipm-repository-assessment-v1",
  "enrichments": [
    {
      "repositoryKey": "owner/repository",
      "state": "partial",
      "value": { "...canonical Quality vector...": true }
    }
  ]
}
```

The bundle is an input to candidate generation, not a second packaged assessment authority.

It must use the same assessment policy as the generator. Each repository key must already exist in the graph-derived assessment artifact, and every Quality artifact route must match the repository's packaged semantic context.

Therefore the CLI inherits the fail-closed invariants:

```text
unknown repository key -> reject
artifact-route mismatch -> reject
unknown artifact context -> reject
duplicate canonical key -> reject
```

An external calibration donor cannot be inserted by the Quality bundle unless it is already a truthful member of the source assessment artifact.

## Diagnostics

If `--diagnostics-out` is provided, the CLI writes separate generation diagnostics:

```text
l0
  repositories
  owned / contributed
  forks
  category/artifact coverage
  Impact coverage
  Personal Contribution coverage

quality
  requested / applied
  observed / partial
  acquisitionElevated
  repositoriesBefore / repositoriesAfter
```

Diagnostics are generation evidence, not part of repository Quality.

## GeneratedAt behavior

By default, the L0 adapter uses the source graph's `generatedAt` as the assessment observation/generation time.

`--generated-at` may explicitly override the generated artifact time for controlled experiments. A production pipeline should define its observation-time policy separately before publication.

## Generator revision

`--generator-revision` is mandatory.

The caller must provide the exact generator revision used to produce the assessment candidate. The CLI does not infer Git state from the working directory, because implicit local Git discovery would make container/Action provenance less deterministic.

## No hidden Quality scoring

Candidate generation does not introduce:

```text
composite Quality score
Confidence score
Personal Contribution score
Portfolio Prominence score
rank
tier
node size change
```

Existing score fields remain null/unfrozen under the current experimental contracts.

## Regression coverage

Tests verify:

- L0-only candidate generation;
- optional bounded Quality enrichment;
- repository membership remains unchanged;
- existing L0 Impact remains intact;
- explicit CLI writes assessment + diagnostics;
- graph input bytes remain unchanged;
- output overwrite attempts fail;
- policy-mismatched Quality bundle fails;
- absent external donor key fails before output is written.

## Integration boundary

This CLI is preparation for an experimental Quality view, not production integration.

A safe next step after current-profile live receipt validation is:

```text
frozen current graph projection
  -> explicit assessment candidate CLI
  -> validate candidate
  -> derive Quality overlay projection
  -> render non-default experimental Quality view
```

Only after that path is stable should the default project-map Action consider an opt-in assessment output. Default Structure mode and existing graph/render outputs remain authoritative until explicitly migrated.
