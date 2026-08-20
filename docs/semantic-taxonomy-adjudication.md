# Ambiguity-only taxonomy adjudication (P3B2)

P3B2 adds a provider-neutral structured adjudication boundary for repositories that remain ambiguous after P3B1.

It does **not** select a production LLM vendor and does not call any provider by default.

## Invocation boundary

The adjudicator receives only repositories that P3B1 left in `ambiguous`.

Repositories already assigned by:

- human override;
- high-confidence deterministic taxonomy match;
- embedding score+margin;

are never sent to the adjudicator.

This is enforced by tests.

## Hard cost bounds

Defaults:

```text
maximum adjudication cases per generation = 20
batch size = 8
minimum accepted confidence = 0.70
```

The maximum case count has a hard cap of 20 even if callers request more. Cases beyond the cap remain ambiguous.

## Provider boundary

```ts
interface TaxonomyAdjudicationProvider {
  id: string;
  model: string;
  adjudicate(cases: TaxonomyAdjudicationCase[]): Promise<unknown>;
}
```

The default provider is explicitly `disabled`.

No browser viewer has access to this boundary.

## Bounded input

Each case contains:

- exact repository name;
- bounded semantic-document fields;
- bounded P1 classification summary when available;
- the frozen taxonomy category IDs, labels, descriptions, aliases, and optional parent IDs.

The adjudicator does not receive arbitrary filesystem/repository content.

## Strict decision contract

A provider decision is accepted only when:

- the returned `repoName` exactly matches the requested case;
- confidence is finite in `[0,1]`;
- category is either `null`/empty to decline or a category present in the frozen taxonomy;
- accepted category confidence is at least `0.70` by default;
- accepted decisions contain a non-empty bounded reason.

Optional secondary tags are normalized/deduplicated and capped.

Unknown categories, mismatched repository names, malformed confidence, and missing accepted-decision reason are invalid and remain ambiguous.

A provider cannot spoof the visible category label: output uses the frozen taxonomy label.

## Result

An accepted decision becomes:

```text
repository.taxonomyAssignment.method = "llm"
```

with bounded `llm` evidence and confidence.

P3B2 still does not replace P1 `classification`, `groupId`, or `groupLabel`. Promotion into the visible hierarchy requires separate evaluation.

## Failure behavior

On timeout/error/invalid batch cardinality:

- existing P3B1 assignments remain intact;
- unresolved repositories remain ambiguous;
- graph generation succeeds;
- diagnostics record attempted/accepted/declined/invalid/remaining/capped/calls.

## Production provider remains a separate choice

P3B2 completes the safe architecture for an ambiguity-only judge, but choosing a hosted or local LLM provider requires a separate decision about:

- privacy/data handling;
- authentication/secrets;
- cost/rate limits;
- timeout/retry policy;
- model capability and multilingual quality.

Until configured, the adjudicator remains disabled and performs zero calls.
