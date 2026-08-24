# Repository assessment Quality enrichment v1

Status: **experimental full-L0 enrichment contract / no production publication / no repository membership mutation**

The existing L0 graph adapter already builds a complete assessment skeleton for every repository represented by the generated graph. Quality evidence can then be acquired selectively at L1/L2.

The safe composition is:

```text
graph.json
  ↓ buildL0RepositoryAssessmentFromGraph()
full repository assessment skeleton
  ├ existing Impact partial evidence
  ├ existing Contributed activity evidence
  └ Quality not-collected
       ↓ enrichAssessmentArtifactQuality()
select existing repositoryKey entries only
       ↓
Quality observed/partial on bounded repositories
unassessed repositories remain not-collected
```

Implementation:

```text
scripts/repository-assessment-quality-enrichment.mjs
```

Tests:

```text
tests/repository-assessment-quality-enrichment.test.mjs
```

## Membership is immutable during Quality enrichment

Quality acquisition is not repository discovery.

An enrichment request must name a canonical repository key that already exists in the validated assessment artifact.

```text
existing key
  -> may update Quality section

missing key
  -> reject
```

The repository count before and after enrichment must be identical.

This is important for attribution safety: an external calibration donor cannot be smuggled into a personal portfolio merely because Quality evidence exists for it.

## Quality enrichment changes only the owning section and acquisition level

The enrichment step may update:

```text
repository.quality
repository.acquisition.level
```

It must not infer or rewrite:

```text
repository identity
category
artifact facets
ownership
collaboration
lineage
lifecycle
Impact
Scale
Personal Contribution
Prominence
productionScore
```

If L1 evidence also resolves collaboration, fork lineage detail, lifecycle or another axis, that evidence belongs to the corresponding owning enrichment path rather than being hidden inside Quality enrichment.

## Artifact-route compatibility

A Quality vector is accepted only when every artifact used by its assessment route is already present in the repository's assessment context.

```text
context artifacts = [tool]
Quality artifacts  = [tool]
  -> allowed

context artifacts = [tool]
Quality artifacts  = [application]
  -> reject

context artifacts = unknown
Quality artifacts  = [application]
  -> reject until semantic context is resolved
```

A Quality acquisition step cannot silently invent the artifact route required to score itself.

## Section state

Accepted enrichment states are:

```text
observed
partial
```

Default is `partial`, because bounded real assessment commonly leaves relevant target dimensions unresolved.

`not-collected`, `unknown`, and `not-applicable` are availability states, not enrichment payload states.

## Acquisition level

Quality enrichment defaults to requesting `L1` and can request `L2` for deeper evidence.

Acquisition level is monotonic:

```text
L0 -> L1 -> L2
```

Enrichment does not downgrade a repository already inspected at a deeper level.

## Confidence validation without a second authority

The enrichment pass derives the canonical Confidence coverage vector as a structural validation step. It does not persist a separate Confidence score or duplicate presentation summary.

This checks that the Quality vector has a usable dimension/evidence structure while preserving:

```text
Confidence != Quality
```

## Source artifact is not mutated

The function returns an enriched clone. A failed enrichment, duplicate request, unknown repository key or artifact mismatch leaves the source artifact unchanged.

This supports fail-closed generation pipelines where a bad L1 payload must not partially corrupt an otherwise valid L0 artifact.

## Projection behavior

After enrichment, the existing assessment-to-Quality overlay projection can consume the whole artifact:

```text
Quality observed/partial
  -> overlay available

Quality not-collected
  -> overlay unavailable
```

No renderer needs to infer which repositories were scanned.

## Current bounded test

The regression fixture begins from a graph with:

```text
owned original tool
owned fork library
external contributed repository with unresolved semantic context
```

It verifies:

- L0 Impact evidence survives Quality enrichment;
- only the selected tool receives Quality;
- unassessed repositories remain not-collected;
- projection yields one available overlay and two unavailable entries;
- an absent external donor key is rejected;
- artifact-route mismatch is rejected;
- unresolved artifact context is rejected;
- duplicate canonical keys fail closed;
- the original L0 artifact remains unchanged on failure.

## Next gate

Run this exact composition against the current personal `graph.json`:

```text
live graph snapshot
  ↓ L0 adapter
all current repository assessment entries
  ↓ bounded enrichments for frozen real portfolio cases
validated assessment candidate
  ↓ Quality projection
join diagnostics + overlay coverage
```

The live receipt should record:

```text
source graph revision / generatedAt
repository count
repositoryKey join count
Quality available count
Quality unavailable count
category/artifact unresolved count
enrichment rejects, if any
```

Do not publish the candidate as production `project-map/assessment.json` until live join diagnostics, exact-head CI and renderer-side feature gating are all verified.
