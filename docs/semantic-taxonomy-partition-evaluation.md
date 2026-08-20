# Taxonomy partition evaluation

`evaluate:semantic` is intentionally strict about stable category IDs. That is correct when measuring assignment against an already-fixed taxonomy, but it is not sufficient for comparing **taxonomy discovery** providers: two providers can discover the same repository grouping with different category IDs/labels.

This evaluator measures the repository partition independently of category names.

## Run

```bash
node scripts/evaluate-taxonomy-partition.mjs \
  --graph project-map/graph.json \
  --expected semantic-expected.json
```

Optional explicit gates:

```bash
node scripts/evaluate-taxonomy-partition.mjs \
  --graph project-map/graph.json \
  --expected semantic-expected.json \
  --min-coverage 0.80 \
  --max-ambiguity-rate 0.20 \
  --min-pairwise-f1 0.80 \
  --min-adjusted-rand-index 0.70 \
  --min-purity 0.80 \
  --max-actual-clusters 10
```

As with the main evaluator, no threshold is enforced unless explicitly supplied. Failed explicit gates exit `2`; invalid input exits `1`.

## Metrics

The partition metrics use only repositories that are both present and assigned. Therefore **coverage and ambiguity must always be read alongside partition quality**.

### Pairwise precision / recall / F1

Consider every pair of evaluated repositories:

- expected-same: human fixture puts the pair in the same category;
- predicted-same: discovered taxonomy puts the pair in the same category;
- true positive: both agree the pair belongs together.

This makes failure mode direction visible:

- splitting one real category into many tiny categories hurts pairwise recall;
- merging unrelated categories into one catch-all hurts pairwise precision.

### Adjusted Rand Index (ARI)

ARI compares the complete pairwise partition while correcting for chance. It is label-permutation invariant. `1` means identical partition structure; values around `0` are chance-like; negative values can occur for systematically conflicting partitions.

### Purity

For every discovered cluster, count the largest human-expected category represented in that cluster, then divide the majority total by evaluated repositories.

Purity is interpretable but can be inflated by over-fragmentation, so never use it alone. Pairwise recall and ARI expose that failure mode.

### Cluster diagnostics

The report also lists:

- expected vs actual cluster count;
- human categories fragmented across multiple discovered clusters;
- discovered clusters that mix multiple human categories;
- exact repository→expected/discovered assignments for review.

## Evaluation sequence

Use the two evaluators for different questions:

1. **Fixed human taxonomy + embedding assignment** → `evaluate-semantic.mjs` exact stable-ID metrics.
2. **Automatic taxonomy discovery** → `evaluate-taxonomy-partition.mjs` ID-invariant partition metrics.
3. Read both with coverage/ambiguity and existing churn/call/cache metrics.
4. Human review still decides whether discovered labels/descriptions are understandable and useful; partition metrics cannot judge wording quality.

This separation prevents a taxonomy provider from being penalized solely for choosing a different stable ID while still detecting real split/merge/catch-all failures.
