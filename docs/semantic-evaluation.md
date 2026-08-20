# Semantic Evaluation Harness

This harness measures the P3 semantic pipeline without coupling evaluation to one embedding, taxonomy-discovery, or LLM vendor.

## Inputs

Required:

- generated `graph.json`;
- a separate **human-labelled** expected fixture.

Optional:

- a previous `graph.json` for taxonomy/assignment churn;
- generation diagnostics for provider/cache/call counts.

Do not use the pipeline's own discovered taxonomy assignments as ground truth. That would only measure agreement with itself.

## Expected fixture

Version 1 uses repository names as stable human-review keys:

```json
{
  "version": 1,
  "repositories": {
    "dual-scorpion-sim": {
      "categoryId": "robotics",
      "secondaryTags": ["manipulation", "simulation"]
    }
  }
}
```

Repository names are matched case-insensitively. Category IDs are normalized to lowercase and must use the same stable ID contract as the frozen taxonomy.

## Run

Report only:

```bash
npm run evaluate:semantic -- \
  --graph project-map/graph.json \
  --expected semantic-expected.json
```

With churn and diagnostics:

```bash
npm run evaluate:semantic -- \
  --graph project-map/graph.json \
  --expected semantic-expected.json \
  --previous previous-graph.json \
  --diagnostics semantic-run-diagnostics.json \
  --output semantic-evaluation.json
```

No quality threshold is enforced unless explicitly supplied.

Example CI gate:

```bash
npm run evaluate:semantic -- \
  --graph project-map/graph.json \
  --expected semantic-expected.json \
  --min-assigned-accuracy 0.85 \
  --min-end-to-end-accuracy 0.75 \
  --min-coverage 0.80 \
  --max-ambiguity-rate 0.20 \
  --max-taxonomy-churn-rate 0.15 \
  --max-assignment-churn-rate 0.15 \
  --max-largest-category-share 0.70 \
  --max-adjudicator-calls 20
```

A failed explicit gate exits with status `2`. Invalid input/configuration exits with status `1`.

## Metrics

### Assignment quality

- `assignedAccuracy`: correct / assigned expected repositories;
- `coverage`: assigned / present expected repositories;
- `endToEndAccuracy`: correct / present expected repositories;
- `ambiguityRate`: unassigned / present expected repositories;
- `missingRate`: expected repositories absent from the graph;
- mismatches and ambiguity lists;
- method contribution: override / deterministic / semantic / llm;
- per-category coverage and assigned accuracy.

`assignedAccuracy` must never be read without `coverage`. A model can achieve high assigned accuracy by refusing most cases.

### Taxonomy shape

- category count and usage;
- unused categories;
- singleton categories;
- largest assigned category share.

The shape metrics expose unnecessary singleton categories and one giant catch-all category before taxonomy assignments are promoted into the primary hierarchy.

### Stability

With `--previous`:

- added/removed category IDs;
- label changes for stable IDs;
- taxonomy churn rate over the union of category IDs;
- corpus fingerprint change;
- repository assignment churn for repositories present in both graphs.

Taxonomy churn and assignment churn are deliberately separate. A stable schema can still produce unstable repository assignments.

### Provider/cost diagnostics

The pure collector accepts the existing generation result diagnostics and extracts only provider-neutral counts:

- semantic-edge comparisons/retained/emitted;
- repository embedding cache hits/new embeddings;
- taxonomy assignment repository/category cache hits/new embeddings;
- taxonomy discovery/reuse/drift reason;
- ambiguity-only adjudicator eligible/attempted/accepted/declined/invalid/calls.

This does not require selecting a production provider. A future provider integration can serialize these diagnostics and feed them to `--diagnostics` without changing the evaluation format.

## Promotion gate

Do **not** promote `taxonomyAssignment` into `classification/groupId` merely because P3B1/P3B2 are implemented. Promotion should wait until a fixed human-labelled portfolio fixture demonstrates acceptable accuracy, coverage, ambiguity, churn, category balance, generation cost, and adjudicator-call bounds.
