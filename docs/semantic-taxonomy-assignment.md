# Taxonomy Assignment (P3B1)

P3B1 assigns repositories against the frozen P3A portfolio taxonomy without yet replacing the existing P1 compatibility hierarchy.

The migration rule is intentional:

> `taxonomyAssignment` is measured first; `classification` / `groupId` remain the current compatibility source until assignment quality is evaluated.

## Assignment order

For each repository:

1. explicit repository override from `taxonomy-overrides.json`;
2. exact P1 deterministic category match when confidence is at least `0.90`;
3. repository embedding vs frozen taxonomy-category embeddings;
4. otherwise remain explicitly ambiguous.

Embedding assignment defaults:

```text
minimum top cosine score = 0.62
minimum top1 - top2 margin = 0.08
```

A low score or narrow margin does not force a category.

## Graph data

A repository may receive:

```ts
interface RepositoryTaxonomyAssignment {
  categoryId: string;
  categoryLabel: string;
  secondaryTags: string[];
  confidence: number;
  method: "override" | "deterministic" | "semantic";
  evidence: ClassificationEvidence[];
  score?: number;
  margin?: number;
}
```

Stored as:

```text
repository.taxonomyAssignment
```

and the graph records:

```text
taxonomyAssignmentVersion = 1
```

P3B1 does not rewrite the repository's P1 `classification`, `groupId`, or `groupLabel`.

## Human repository overrides

The same human-owned `project-map/taxonomy-overrides.json` may contain repository assignments:

```json
{
  "version": 1,
  "categories": [
    {
      "id": "robotics",
      "label": "Robotics",
      "description": "Robot simulation, control, navigation, manipulation, and sim-to-real projects",
      "aliases": ["ROS2", "Gazebo"]
    }
  ],
  "repositories": {
    "dual-scorpion-sim": {
      "categoryId": "robotics",
      "secondaryTags": ["manipulation", "sim-to-real"]
    }
  }
}
```

Repository names are normalized case-insensitively. Category IDs must reference a category in the frozen/authoritative taxonomy. Overrides win before deterministic or embedding assignment.

The Action never rewrites `taxonomy-overrides.json`.

## Category embeddings

Taxonomy categories are embedded from a bounded text representation containing:

- stable category ID;
- label;
- description;
- aliases;
- optional parent ID.

Category embedding cache identity is separate from repository semantic-document identity:

```text
embedding:taxonomy-category-v1:<provider>:<model>:<sha256(category-content)>
```

Changing a category description/label/aliases therefore invalidates only the affected category vector.

## Shared repository embedding cache

When one generation run has an embedding provider and no explicit cache, the Action creates one shared in-memory cache for:

1. P2 semantic-edge repository embeddings;
2. P3B1 repository assignment embeddings;
3. P3B1 category embeddings.

Repository vectors produced for semantic edges are reused by taxonomy assignment in the same run. The assignment stage should not make a second provider request for unchanged repository documents.

A caller may provide a persistent `EmbeddingCache`; that same cache is used throughout the semantic pipeline.

## Failure behavior

If the embedding provider is disabled or fails:

- explicit repository overrides still apply;
- high-confidence exact P1→taxonomy matches still apply;
- unresolved repositories remain ambiguous;
- existing P1 classification/grouping remains usable;
- graph generation does not fail because semantic assignment is unavailable.

## Static migration/security

Static sanitization accepts `taxonomyAssignment` only when:

- a valid sanitized taxonomy exists;
- `categoryId` exists in that taxonomy;
- method is one of `override`, `deterministic`, `semantic`;
- confidence is finite in `[0,1]`;
- optional score is finite in `[-1,1]`;
- optional margin is finite in `[0,2]`;
- evidence is valid and refers to the selected category.

The visible category label is taken from the sanitized taxonomy, not trusted from static input.

## Next boundary

P3B1 intentionally stops before changing visual grouping. After assignment precision/ambiguity is measured on a fixed portfolio fixture, the next boundary is P3B2:

- optional ambiguity-only structured judge;
- no unconditional per-repository LLM calls;
- strict output validation;
- call/cost cap;
- deterministic fallback;
- then, only with evidence, consider promoting `taxonomyAssignment` into the primary category hierarchy.
