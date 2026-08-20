# P3 provider benchmark matrix

Survey date: **2026-08-20**

Status: **benchmark candidates, not production selection**.

This document defines the comparison order after the public-portfolio expected fixture has been human-reviewed. It deliberately starts with local/open embedding models so README/metadata evidence does not need to leave the generation machine merely to obtain embeddings.

## 1. Separate the questions

Do not benchmark the whole semantic stack as one opaque score.

1. **Fixed human taxonomy + assignment:** compare embedding models while taxonomy is fixed to the reviewed categories. Use exact-ID `evaluate-semantic.mjs` metrics.
2. **Automatic taxonomy discovery:** compare discovery providers separately. Use ID-invariant `evaluate-taxonomy-partition.mjs` plus human review of generated labels/descriptions.
3. **Ambiguity-only adjudication:** only after deterministic/embedding assignment is measured; report how many ambiguous cases are sent and how many are correctly resolved.

This prevents a strong embedding model from hiding weak taxonomy discovery, or a large adjudicator from hiding poor embedding thresholds.

## 2. Initial local embedding candidates

| Order | Model | Size | Multilingual / context | Vector | License / access | Why test it |
|---|---|---:|---|---|---|---|
| A0 | deterministic-only control | — | — | — | project code | Establish coverage/accuracy without any embedding provider. |
| A1 | `google/embeddinggemma-300m` | 300M | 100+ spoken languages; 2048 tokens | 768, MRL 512/256/128 | Gemma terms; Hugging Face gated acceptance | Smallest serious local baseline; designed for on-device embedding. |
| A2 | `Qwen/Qwen3-Embedding-0.6B` | 0.6B | 100+ languages; 32K | up to 1024, MRL 32–1024 | Apache-2.0 | Strong multilingual/text+code candidate at modest size; instruction-aware. |
| A3 | `BAAI/bge-m3` | ~0.6B-class XLM-R family | multilingual; 8192 tokens | 1024 | MIT | Mature multilingual baseline with dense/sparse/multi-vector support; use dense output first for parity. |
| A4 | `Qwen/Qwen3-Embedding-4B` | 4B | 100+ languages; 32K | up to 2560, MRL | Apache-2.0 | Local quality ceiling only if smaller models fail the portfolio Gate. |

### Deferred reference

`jinaai/jina-embeddings-v4` is a 3.8B multilingual **multimodal** model with 32K context and 2048-dimensional single-vector output, but the current repository semantic documents are text-only. Its larger runtime and Qwen Research License make it a lower-priority benchmark unless future PDF/image/screenshot evidence becomes part of the corpus.

## 3. Primary sources

- Qwen3-Embedding-0.6B model card: https://huggingface.co/Qwen/Qwen3-Embedding-0.6B
- Qwen3-Embedding-4B model card: https://huggingface.co/Qwen/Qwen3-Embedding-4B
- EmbeddingGemma model card: https://huggingface.co/google/embeddinggemma-300m
- EmbeddingGemma release overview: https://developers.googleblog.com/introducing-embeddinggemma/
- BGE-M3 model card: https://huggingface.co/BAAI/bge-m3
- Jina Embeddings v4 overview: https://jina.ai/models/jina-embeddings-v4/

Re-check model cards/licenses before a production release; this matrix is a dated benchmark plan, not a permanent license assertion.

## 4. Fixed-taxonomy embedding benchmark

Use the **same reviewed 12-repository fixture, same semantic documents, same taxonomy descriptions, and same P3B1 thresholds** for the first pass.

Do not tune `score >= 0.62` / `margin >= 0.08` independently for each model before the baseline comparison. First measure the current policy unchanged.

Record for every model:

- assigned accuracy;
- end-to-end accuracy;
- coverage;
- ambiguity rate;
- mismatch list;
- method contribution;
- per-category accuracy/coverage;
- embedding dimension;
- repository/category cache hits and new embeddings;
- wall-clock generation time when the local benchmark runner is added;
- peak process memory when practical;
- serialized cache size.

Because the real public fixture is only 12 repositories, treat results as a **portfolio acceptance test**, not evidence of general-purpose model superiority.

## 5. Threshold sensitivity only after baseline

If no small model clears the desired coverage/accuracy balance, run a bounded sensitivity table rather than hand-tuning one lucky threshold:

```text
score:  0.55 / 0.60 / 0.62 / 0.65 / 0.70
margin: 0.04 / 0.06 / 0.08 / 0.10 / 0.12
```

For each cell record assigned accuracy, coverage, ambiguity and mismatches. Reject settings that gain coverage mainly by adding wrong assignments.

Do not select thresholds solely from this one 12-repository corpus if the intended project later becomes a general public service; add additional independently labelled portfolios first.

## 6. Automatic taxonomy discovery benchmark

After embedding assignment is isolated, evaluate discovery separately.

Required outputs per discovery configuration:

- category count;
- generated labels/descriptions/aliases;
- partition pairwise precision / recall / F1;
- Adjusted Rand Index;
- purity;
- coverage / ambiguity;
- fragmented expected categories;
- mixed discovered categories;
- largest category share / singleton count;
- exact-corpus reuse behavior;
- small-drift taxonomy churn;
- provider calls and latency/cost if remote.

Category IDs are **not** required to match the human fixture. Partition metrics added in PR #46 are the structural score. A human still reviews whether labels are understandable and semantically appropriate.

## 7. Adjudicator benchmark

P3B2 remains last in the chain.

Compare only the unresolved cases produced by a fixed embedding/discovery configuration. Keep the hard maximum of 20 cases and current minimum accepted confidence 0.70.

Record:

- eligible ambiguous cases;
- attempted cases;
- accepted / declined / invalid;
- final accuracy/coverage change;
- newly introduced mistakes;
- calls and latency/cost;
- structured-output failure rate.

A configuration is not better if an adjudicator merely forces every ambiguous repository into a category.

## 8. Recommended first benchmark order

Once the candidate expected fixture is human-reviewed:

1. A0 deterministic-only control.
2. A1 EmbeddingGemma 300M.
3. A2 Qwen3-Embedding-0.6B.
4. A3 BGE-M3.
5. Stop if one of A1–A3 clearly satisfies the portfolio Gate with acceptable local cost.
6. Run A4 Qwen3-Embedding-4B only as a quality ceiling if the smaller models leave meaningful errors/ambiguity.
7. Only then benchmark automatic taxonomy discovery.
8. Add ambiguity-only adjudication last.

This ordering minimizes privacy exposure and avoids paying model/runtime complexity before measurement shows it is necessary.

## 9. Production-selection rule

No model in this document is selected by default. Production selection requires all of:

- human-reviewed expected fixture;
- measured assignment quality and coverage;
- acceptable ID-invariant discovery partition quality;
- acceptable taxonomy/assignment churn;
- bounded runtime/memory/cache size;
- explicit license review;
- explicit privacy/cost review for any remote provider;
- no regression of the static-first/browser-independent architecture.
